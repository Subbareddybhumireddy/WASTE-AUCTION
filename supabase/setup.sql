-- =========================================================
-- Waste2Worth auction marketplace — Supabase setup
-- Run this ONCE: Supabase dashboard → SQL Editor → New query → paste → Run.
-- It is safe to run again.
-- =========================================================

-- 1) One table holds every record (users, listings, bids, orders, alerts,
--    audit, notes, rates). Each row is one record, so people never
--    overwrite each other's data.
create table if not exists public.wa_docs (
  col        text        not null,          -- collection name, e.g. 'listings'
  id         text        not null,          -- record id
  data       jsonb       not null,          --- the record itself
  updated_at timestamptz not null default now(),
  primary key (col, id)
);

alter table public.wa_docs enable row level security;

-- Logged-in users can read and write marketplace records.
-- (The app logic runs in the browser, like the reference site.)
drop policy if exists "wa_docs read"   on public.wa_docs;
drop policy if exists "wa_docs insert" on public.wa_docs;
drop policy if exists "wa_docs update" on public.wa_docs;
drop policy if exists "wa_docs delete" on public.wa_docs;
create policy "wa_docs read"   on public.wa_docs for select to authenticated using (true);
create policy "wa_docs insert" on public.wa_docs for insert to authenticated with check (true);
create policy "wa_docs update" on public.wa_docs for update to authenticated using (true) with check (true);
create policy "wa_docs delete" on public.wa_docs for delete to authenticated using (true);

-- 2) Live updates: new bids, orders and messages appear without refreshing.
do $$ begin
  alter publication supabase_realtime add table public.wa_docs;
exception when duplicate_object then null; end $$;

-- 3) Public numbers for the home page (shown before anyone logs in).
--    Returns only counts and weights — no names or emails.
create or replace function public.wa_public_stats()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'users',     (select count(*) from wa_docs where col = 'users'),
    'has_admin', exists(select 1 from wa_docs where col = 'users' and data->>'role' = 'admin'),
    'open',      (select count(*) from wa_docs where col = 'listings' and data->>'status' = 'open'),
    'paid',      (select coalesce(json_agg(data->'wts'), '[]'::json)
                    from wa_docs where col = 'orders' and data->'pay'->>'st' = 'Paid')
  );
$$;
grant execute on function public.wa_public_stats() to anon, authenticated;

-- 4) Photo storage (listing photos, pickup proof photos, profile photos).
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

drop policy if exists "wa photos read"   on storage.objects;
drop policy if exists "wa photos upload" on storage.objects;
drop policy if exists "wa photos delete" on storage.objects;
create policy "wa photos read" on storage.objects for select
  using (bucket_id = 'listing-photos');
create policy "wa photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wa photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 5) Admin protection.
--    There is exactly ONE permanent admin account (subbareddybhumireddy7+admin@gmail.com).
--    It can never be demoted, suspended or deleted, and no other account can
--    ever become admin. Only the admin can verify buyers ("ok") or suspend
--    accounts ("sus"); everyone else's changes to those fields are undone.
--    To move admin to another account, change the id in wa_admin_id() and re-run.
create or replace function public.wa_admin_id()
returns text language sql immutable as $$
  select 'c58a5538-f7d5-45e0-9b23-69bc30e76384'::text;
$$;

create or replace function public.wa_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.uid()::text = public.wa_admin_id(), false);
$$;

create or replace function public.wa_guard_users()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.col <> 'users' then
    return new;
  end if;
  -- the permanent admin always stays admin and active
  if new.id = public.wa_admin_id() then
    new.data := new.data || '{"role":"admin","sus":false}'::jsonb;
    return new;
  end if;
  -- nobody else can ever hold the admin role
  if coalesce(new.data->>'role', '') not in ('seller','buyer','collector') then
    new.data := new.data || jsonb_build_object('role',
      case when tg_op = 'UPDATE' and old.data->>'role' in ('seller','buyer','collector')
           then old.data->>'role' else 'seller' end);
  end if;
  if public.wa_is_admin() then
    return new;  -- admin may approve, reject and suspend
  end if;
  if tg_op = 'UPDATE' then
    -- keep the protected fields exactly as they were
    new.data := new.data
      || jsonb_build_object('role', old.data->'role')
      || jsonb_build_object('ok',   coalesce(old.data->'ok',  'false'::jsonb))
      || jsonb_build_object('sus',  coalesce(old.data->'sus', 'false'::jsonb));
  else
    -- brand-new profile: never admin, never pre-verified, never suspended
    new.data := new.data
      || jsonb_build_object('role', case when new.data->>'role' in ('seller','buyer','collector')
                                         then new.data->>'role' else 'seller' end)
      || jsonb_build_object('ok', false)
      || jsonb_build_object('sus', false);
  end if;
  return new;
end $$;

drop trigger if exists wa_guard_users on public.wa_docs;
create trigger wa_guard_users before insert or update on public.wa_docs
  for each row execute function public.wa_guard_users();

-- Only the admin can delete user profiles or the audit trail,
-- and the admin's own profile can never be deleted.
drop policy if exists "wa_docs delete" on public.wa_docs;
create policy "wa_docs delete" on public.wa_docs for delete to authenticated
  using ((col not in ('users', 'audit') or public.wa_is_admin())
         and not (col = 'users' and id = public.wa_admin_id())
         and col <> 'otps');

-- Apply the rules to existing rows: re-assert the admin profile and
-- demote any other profile that somehow holds the admin role.
update public.wa_docs set data = data || '{"role":"admin","sus":false}'::jsonb
  where col = 'users' and id = public.wa_admin_id();
update public.wa_docs set data = data || '{"role":"seller"}'::jsonb
  where col = 'users' and id <> public.wa_admin_id() and data->>'role' = 'admin';

-- 6) One-time handover codes.
--    Two codes per order, each a fresh random 4-digit number:
--      • pickup   (row id = order id)      — seller gives it to the collector at pickup
--      • delivery (row id = order id||':d') — buyer gives it to the collector at delivery
--    Codes live in rows with col = 'otps' that ONLY their owner (seller or
--    buyer) can read. Nobody can write them directly; the two functions below
--    are the only way in. Entries are checked on the server: one use, 5 tries max.
drop policy if exists "wa_docs read"   on public.wa_docs;
drop policy if exists "wa_docs insert" on public.wa_docs;
drop policy if exists "wa_docs update" on public.wa_docs;
create policy "wa_docs read" on public.wa_docs for select to authenticated
  using (col <> 'otps' or coalesce(data->>'owner', data->>'seller') = auth.uid()::text);
create policy "wa_docs insert" on public.wa_docs for insert to authenticated
  with check (col <> 'otps');
create policy "wa_docs update" on public.wa_docs for update to authenticated
  using (col <> 'otps') with check (col <> 'otps');

drop function if exists public.wa_new_otp(text);
drop function if exists public.wa_check_otp(text, text);

-- p_kind: 'pickup' or 'delivery'.
-- Both codes are created as soon as a collector accepts the pickup. The two
-- codes for one order are always different, so a mix-up can be detected.
create or replace function public.wa_new_otp(p_order text, p_kind text default 'pickup')
returns void language plpgsql security definer set search_path = public as $$
declare o jsonb; me text := auth.uid()::text; code text; owner text; rid text; other text;
begin
  select data into o from wa_docs where col = 'orders' and id = p_order;
  if o is null then raise exception 'Order not found'; end if;
  if o->>'coll' is null then raise exception 'No collector has accepted this pickup yet'; end if;
  if p_kind = 'pickup' then
    owner := o->>'seller'; rid := p_order;
    if (o->>'otpOk') = 'true' or coalesce((o->>'step')::int, 0) >= 5 then raise exception 'This pickup is already verified'; end if;
    select data->>'code' into other from wa_docs where col = 'otps' and id = p_order || ':d';
  elsif p_kind = 'delivery' then
    owner := o->>'buyer'; rid := p_order || ':d';
    if (o->>'dlvOk') = 'true' or coalesce((o->>'step')::int, 0) >= 6 then raise exception 'This delivery is already verified'; end if;
    select data->>'code' into other from wa_docs where col = 'otps' and id = p_order;
  else
    raise exception 'Unknown code type';
  end if;
  if me is null or not (me = owner or me = o->>'coll' or public.wa_is_admin()) then
    raise exception 'Not allowed to create this code';
  end if;
  -- crypto-strength random number from gen_random_uuid(), 0000–9999, never equal to the other code
  loop
    code := lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 10000)::text, 4, '0');
    exit when other is null or code <> other;
  end loop;
  insert into wa_docs (col, id, data, updated_at)
  values ('otps', rid, jsonb_build_object('id', rid, 'order', p_order, 'kind', p_kind, 'owner', owner,
          'code', code, 'tries', 0, 'used', false, 'at', floor(extract(epoch from now()) * 1000)), now())
  on conflict (col, id) do update set data = excluded.data, updated_at = now();
end $$;

-- Returns:
--   'ok'     code accepted
--   'wrong'  wrong code (counts towards the 5-try limit)
--   'other'  the collector typed the OTHER person's code (buyer's code at pickup,
--            or seller's code at delivery) — not counted as a wrong try
--   'early'  delivery code entered before the pickup was verified
--   'locked' 5 wrong tries;  'none' no active code
create or replace function public.wa_check_otp(p_order text, p_code text, p_kind text default 'pickup')
returns text language plpgsql security definer set search_path = public as $$
declare o jsonb; t jsonb; x jsonb; me text := auth.uid()::text; rid text; xid text; c text := trim(p_code);
begin
  select data into o from wa_docs where col = 'orders' and id = p_order;
  if o is null then raise exception 'Order not found'; end if;
  if me is null or not (me = o->>'coll' or public.wa_is_admin()) then
    raise exception 'Only the assigned collector can enter this code';
  end if;
  if p_kind = 'delivery' then rid := p_order || ':d'; xid := p_order;
  else rid := p_order; xid := p_order || ':d'; end if;
  if p_kind = 'delivery' and (o->>'otpOk') is distinct from 'true' then return 'early'; end if;
  select data into t from wa_docs where col = 'otps' and id = rid;
  select data into x from wa_docs where col = 'otps' and id = xid;
  if t is null or (t->>'used') = 'true' then return 'none'; end if;
  if coalesce((t->>'tries')::int, 0) >= 5 then return 'locked'; end if;
  if x is not null and x->>'code' = c and c <> t->>'code' then return 'other'; end if;
  if t->>'code' = c then
    -- pickup code is kept (marked used) so a later mix-up at delivery is still detected
    if p_kind = 'delivery' then
      delete from wa_docs where col = 'otps' and id in (rid, xid);
      update wa_docs set data = data || '{"dlvOk": true}'::jsonb, updated_at = now() where col = 'orders' and id = p_order;
    else
      update wa_docs set data = jsonb_set(t, '{used}', 'true'::jsonb), updated_at = now() where col = 'otps' and id = rid;
      update wa_docs set data = data || '{"otpOk": true}'::jsonb, updated_at = now() where col = 'orders' and id = p_order;
    end if;
    return 'ok';
  end if;
  update wa_docs set data = jsonb_set(t, '{tries}', to_jsonb(coalesce((t->>'tries')::int, 0) + 1)), updated_at = now()
    where col = 'otps' and id = rid;
  return 'wrong';
end $$;

revoke all on function public.wa_new_otp(text, text)         from public, anon;
revoke all on function public.wa_check_otp(text, text, text) from public, anon;
grant execute on function public.wa_new_otp(text, text)         to authenticated;
grant execute on function public.wa_check_otp(text, text, text) to authenticated;

-- Remove old plain-text codes that were stored inside orders.
update public.wa_docs set data = data - 'otp' where col = 'orders' and data ? 'otp' and id not like 'demo-%';
