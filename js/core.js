// =========================================================
// Waste2Worth — core: helpers, Supabase data sync, auth, shell, modal, camera
// Data lives in the Supabase table wa_docs (see supabase/setup.sql).
// =========================================================
const SUPABASE_URL = 'https://elnvrseohlokdpqcgdzc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JW2jdBEoACoNNSc0BQa1HA_v6jFDeg0'; // publishable key only
const PHOTO_BUCKET = 'listing-photos';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- helpers ----------
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fx = n => '₹' + (Math.round((+n || 0) * 100) / 100).toLocaleString('en-IN');
const fx0 = n => '₹' + Math.round(+n || 0).toLocaleString('en-IN');
const r1 = n => Math.round((+n || 0) * 10) / 10;
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const when = k => new Date(k || Date.now()).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const firstName = n => String(n || '').split(' ')[0];
const cap = s => String(s || '').replace(/^./, c => c.toUpperCase());
const isDemo = id => String(id || '').startsWith('demo-');
// stable JSON (sorted keys) so local and server copies compare equal
function stab(v) {
 if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
 if (Array.isArray(v)) return '[' + v.map(stab).join(',') + ']';
 return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stab(v[k])).join(',') + '}';
}
function toast(t) {
 const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = t; $('#toasts').append(d);
 setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 300) }, 3200);
 if (/order confirmed|listing published|payment marked as paid|demo marketplace ready/i.test(t)) confetti();
}

// ---------- catalogue lookups (data in catalog.js) ----------
const icon = m => MAT[m]?.i || '♻️';
const unitFor = m => MAT[m]?.u || 'kg';
const unitsOf = m => MAT[m] ? [MAT[m].u, ...(MAT[m].u2 ? [MAT[m].u2] : [])] : ['kg'];
const qtyOf = i => +(i && i.qty) || 0;
const unitOf = i => (i && i.unit) || unitFor(i && i.m);
function rangeFor(m, u = unitFor(m)) {
 const d = MAT[m]; if (!d) return null;
 const o = D.rates.find(x => x.id == m + '::' + u);
 if (o && isFinite(+o.min) && isFinite(+o.max)) return { min: +o.min, max: +o.max, src: 'Admin reference', upd: o.k };
 if (u == d.u) return { min: d.r[0], max: d.r[1], src: 'Indicative range', upd: PRICES_UPDATED };
 if (u == d.u2) return { min: d.r2[0], max: d.r2[1], src: 'Indicative range', upd: PRICES_UPDATED };
 return null;
}
const mid = (m, u) => { const p = rangeFor(m, u); return p ? r1((p.min + p.max) / 2) : 0 };
const fmtRate = (m, u = unitFor(m)) => { const p = rangeFor(m, u); return p ? `${fx0(p.min)}–${fx0(p.max)}/${u}` : 'On quotation' };
const estItem = i => { const p = rangeFor(i.m, unitOf(i)); return p ? qtyOf(i) * (p.min + p.max) / 2 : null };
const listingRef = l => l.items.reduce((s, i) => s + (estItem(i) || 0), 0);
const kgOfItem = i => unitOf(i) == 'kg' ? qtyOf(i) : qtyOf(i) * .35; // pieces ≈ 0.35 kg for impact stats
const optionsFor = sel => CATS.map(c => `<optgroup label="${c}">${MATS.filter(d => d.c == c).map(d => `<option value="${esc(d.m)}" ${d.m == sel ? 'selected' : ''}>${d.i} ${esc(d.m)}</option>`).join('')}</optgroup>`).join('');
const priceDate = t => new Date(t || PRICES_UPDATED).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// ---------- data store ----------
const COLS = ['users', 'listings', 'bids', 'orders', 'alerts', 'audit', 'notes', 'rates'];
const blank = () => Object.fromEntries(COLS.map(c => [c, []]));
let D = blank(), shadow = Object.fromEntries(COLS.map(c => [c, {}]));
let authUser = null, me = null, tab = '', live = null, setupErr = '', booting = true, PUB = null;
const sortC = c => D[c].sort((a, b) => (a.k || 0) - (b.k || 0));
const U = id => D.users.find(u => u.id == id) || { name: 'Unknown user', area: '' };
const Lst = id => D.listings.find(x => x.id == id);
const Bd = id => D.bids.find(x => x.id == id);
const Ord = id => D.orders.find(x => x.id == id);

async function loadAll() {
 const out = blank(), sh = Object.fromEntries(COLS.map(c => [c, {}]));
 for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('wa_docs').select('col,id,data').order('col').order('id').range(from, from + 999);
  if (error) throw error;
  for (const r of data) if (out[r.col]) { out[r.col].push(r.data); sh[r.col][r.id] = stab(r.data) }
  if (data.length < 1000) break;
 }
 D = out; shadow = sh; COLS.forEach(sortC);
}
let flushT = null, flushing = Promise.resolve();
function save() { clearTimeout(flushT); flushT = setTimeout(() => { flushing = flushing.then(flush).catch(e => console.error(e)) }, 150) }
async function flush() {
 if (!authUser) return;
 const ups = [], dels = {};
 for (const c of COLS) {
  const cur = {}; D[c].forEach(x => { if (x && x.id) cur[x.id] = x });
  for (const id in cur) { const j = stab(cur[id]); if (shadow[c][id] !== j) { shadow[c][id] = j; ups.push({ col: c, id, data: cur[id], updated_at: new Date().toISOString() }) } }
  for (const id in shadow[c]) if (!(id in cur)) { delete shadow[c][id]; (dels[c] = dels[c] || []).push(id) }
 }
 for (let i = 0; i < ups.length; i += 400) {
  const part = ups.slice(i, i + 400), { error } = await sb.from('wa_docs').upsert(part);
  if (error) { part.forEach(r => delete shadow[r.col][r.id]); toast('Could not save: ' + error.message) }
 }
 for (const c in dels) for (let i = 0; i < dels[c].length; i += 200) await sb.from('wa_docs').delete().eq('col', c).in('id', dels[c].slice(i, i + 200));
}
function applyRow(type, row, old) {
 const r = row && row.col ? row : old; if (!r || !D[r.col]) return false;
 const c = r.col, id = r.id;
 if (type == 'DELETE') { if (!(id in shadow[c])) return false; delete shadow[c][id]; D[c] = D[c].filter(x => x.id != id); return true }
 const j = stab(row.data); if (shadow[c][id] === j) return false;
 shadow[c][id] = j; const i = D[c].findIndex(x => x.id == id);
 if (i >= 0) D[c][i] = row.data; else { D[c].push(row.data); sortC(c) }
 return true;
}
// ---------- one-time pickup codes ----------
// Codes are private rows (col 'otps') that only their owner can read:
// the seller owns the pickup code (id = orderId), the buyer owns the delivery code (id = orderId + ':d').
// They are created and checked on the server (wa_new_otp / wa_check_otp).
const OTPS = {}; // row id -> { code, tries, kind }
const ownsCodes = () => me && (me.role == 'seller' || me.role == 'buyer');
async function loadOtps() {
 if (!ownsCodes()) return;
 const { data } = await sb.from('wa_docs').select('id,data').eq('col', 'otps');
 Object.keys(OTPS).forEach(k => delete OTPS[k]);
 (data || []).forEach(r => OTPS[r.id] = r.data);
}
async function newOtp(orderId, kind = 'pickup') {
 const { error } = await sb.rpc('wa_new_otp', { p_order: orderId, p_kind: kind });
 if (error) { toast(error.message); return false }
 await loadOtps(); return true;
}

function subscribe() {
 if (live) sb.removeChannel(live);
 live = sb.channel('wa-docs').on('postgres_changes', { event: '*', schema: 'public', table: 'wa_docs' }, p => {
  const r = p.new && p.new.col ? p.new : p.old;
  if (r && r.col == 'otps') { if (ownsCodes()) loadOtps().then(softRender); return }
  if (applyRow(p.eventType, p.new, p.old)) { syncMe(); softRender() }
 }).subscribe();
}
function syncMe() {
 if (!authUser) return; const u = D.users.find(x => x.id == authUser.id); if (u) me = u;
 if (me && me.sus) { toast('This account has been suspended. Please contact support.'); logout() }
}
function notify(to, txt) { if (!to || isDemo(to)) return; D.notes.push({ id: uid('N'), k: Date.now(), to, txt, read: false }) }
function log(m) { D.audit.push({ id: uid('T'), k: Date.now(), m }) }

// ---------- auth ----------
function newUser(id, role, name, email, type, area) {
 const u = { id, k: Date.now(), role, name, email, type, area };
 if (role == 'buyer') Object.assign(u, { ok: false, rsum: 0, rn: 0, rates: {}, rateUnits: {}, fee: 0, minKg: 0, svc: '', auto: false });
 return u;
}
async function enter(u) {
 authUser = u; booting = true; render();
 try { await loadAll(); setupErr = '' } catch (e) { booting = false; setupErr = e.message || String(e); render(); return }
 let doc = D.users.find(x => x.id == u.id);
 if (!doc) {
  const md = u.user_metadata || {};
  // Admin is never self-assigned; it is granted directly in the database.
  const role = ['seller', 'buyer', 'collector'].includes(md.role) ? md.role : 'seller';
  doc = newUser(u.id, role, md.name || u.email.split('@')[0], u.email, md.type || '', md.area || '');
  D.users.push(doc); log(`New ${role} registered: ${doc.name}`); save();
 }
 if (doc.sus) { await sb.auth.signOut(); authUser = null; me = null; booting = false; render(); return toast('This account is suspended. Please contact support.') }
 me = doc; tab = NAV[me.role][0][0]; booting = false; seenNotes = null;
 await loadOtps();
 subscribe(); render(); toast('Welcome, ' + firstName(me.name) + '! 👋');
}
async function logout() {
 try { await flushing; await flush() } catch { }
 if (live) sb.removeChannel(live); live = null;
 await sb.auth.signOut();
 authUser = null; me = null; D = blank(); tab = ''; draft = null; closeModal(true);
 $('#chat').hidden = true; render(); loadPublicStats(); scrollTo(0, 0);
}
async function loadPublicStats() {
 try { const { data, error } = await sb.rpc('wa_public_stats'); PUB = error ? null : data } catch { PUB = null }
 if (!authUser) renderLanding();
}

// ---------- navigation ----------
const NAV = {
 seller: [['new', 'Sell', 'camera'], ['mine', 'My listings', 'list'], ['earn', 'Earnings', 'wallet']],
 buyer: [['market', 'Marketplace', 'store'], ['orders', 'Orders', 'box'], ['biz', 'My business', 'brief']],
 collector: [['avail', 'Available', 'pin'], ['pick', 'My pickups', 'truck']],
 admin: [['dash', 'Overview', 'grid'], ['pay', 'Payments', 'wallet'], ['alerts', 'Alerts', 'alert'], ['users', 'Users', 'users'], ['audit', 'Audit', 'doc']]
};
const ROLE_NAME = { seller: 'Seller', buyer: 'Buyer', collector: 'Collector', admin: 'Admin' };
const ICONS = {
 camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
 list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
 wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7l2-3h12v3"/><circle cx="16.5" cy="13.5" r="1.2"/>',
 store: '<path d="M4 9l1-5h14l1 5"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
 box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
 brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 13h18"/>',
 pin: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
 truck: '<path d="M2 6h11v10H2zM13 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
 grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
 users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.5.6 4 2.5 4 5"/>',
 doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
 bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
 user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
 moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
 out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>'
};
const svgi = (k, n = 22) => `<svg viewBox="0 0 24 24" width="${n}" height="${n}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ''}</svg>`;
const avInner = u => u && u.av ? `<img src="${esc(u.av)}" alt="">` : esc(((u && u.name) || '?')[0].toUpperCase());
const avatar = (u, cls = '') => `<span class="av ${cls}">${avInner(u)}</span>`;
const LOGO = `<span class="mark">♻</span><span>Waste2Worth<small>Waste in. Value out.</small></span>`;
function pageTitle() { if (tab == 'notes') return 'Notifications'; if (tab == 'acct') return 'My account'; const n = NAV[me.role].find(x => x[0] == tab); return n ? n[1] : '' }

// ---------- rendering ----------
let lastKey = '';
function render() {
 const inApp = !!authUser;
 $('#pub').hidden = inApp; $('#shell').hidden = !inApp; $('#fab').hidden = !(inApp && me);
 document.body.dataset.role = me ? me.role : '';
 if (!inApp) { if (booting) { $('#pub').hidden = true; return } renderLanding(); return } // wait for the session check before showing the home page
 if (setupErr || booting || !me) {
  $('#side').innerHTML = `<a class="logo">${LOGO}</a>`; $('#topb').innerHTML = `<a class="logo">${LOGO}</a><div class="r"><button class="btn s sm" data-act="logout">Log out</button></div>`; $('#bnav').innerHTML = '';
  $('#view').innerHTML = setupErr ? setupHTML() : '<div class="skel" style="height:190px;margin-bottom:18px"></div><div class="skel" style="height:320px"></div>';
  return;
 }
 renderChrome();
 const fn = PAGES[me.role][tab] || COMMON[tab] || Object.values(PAGES[me.role])[0];
 const key = me.id + tab;
 paint($('#view'), (tab == 'notes' || tab == 'acct' ? '' : hero()) + fn(), key == lastKey);
 if (key != lastKey) { lastKey = key; const v = $('#view'); v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); scrollTo(0, 0); countUp() }
 tick(); pushCheck();
}
// Replace a container's HTML but keep typed values (data-keep) and keyboard focus.
function paint(el, html, keepVals) {
 const a = document.activeElement, fid = a && el.contains(a) && a.id ? a.id : null;
 let sel = null; try { if (fid && a.selectionStart != null) sel = [a.selectionStart, a.selectionEnd] } catch { }
 const keep = {}; if (keepVals) el.querySelectorAll('[data-keep]').forEach(e => { if (e.id) keep[e.id] = e.type == 'checkbox' ? e.checked : e.value });
 el.innerHTML = html;
 for (const id in keep) { const e = document.getElementById(id); if (e) { if (e.type == 'checkbox') e.checked = keep[id]; else e.value = keep[id] } }
 if (fid) { const e = document.getElementById(fid); if (e) { e.focus({ preventScroll: true }); if (sel) try { e.setSelectionRange(sel[0], sel[1]) } catch { } } }
 if (typeof drawQrs == 'function') drawQrs(el);
}
// Live updates wait while someone is typing, so their input is never wiped.
let pend = false, rt = null;
function softRender() {
 const a = document.activeElement;
 if (a && /INPUT|SELECT|TEXTAREA/.test(a.tagName) && a.closest('#view,#ov,#landing')) { pend = true; renderChromeOnly(); return }
 clearTimeout(rt); rt = setTimeout(render, 120);
}
document.addEventListener('focusout', () => { if (pend) setTimeout(() => { const a = document.activeElement; if (!(a && /INPUT|SELECT|TEXTAREA/.test(a.tagName))) { pend = false; render() } }, 120) });
function renderChromeOnly() { if (me && !booting) { renderChrome(); pushCheck() } }
function renderChrome() {
 const nav = NAV[me.role], unread = D.notes.filter(n => n.to == me.id && !n.read).length;
 const nb = (k, l, ic, cnt) => `<button class="nav-i ${tab == k ? 'on' : ''}" data-act="go" data-tab="${k}" ${tab == k ? 'aria-current="page"' : ''}>${svgi(ic)}${l}${cnt ? `<span class="cnt">${cnt}</span>` : ''}</button>`;
 $('#side').innerHTML = `<a class="logo" data-act="go" data-tab="${nav[0][0]}">${LOGO}</a>
  <div class="rolepill">${avatar(me)}<div><b>${esc(me.name)}</b><span>${ROLE_NAME[me.role]}${me.role == 'buyer' && !me.ok ? ' · unverified' : ''}</span></div></div>
  ${nav.map(([k, l, ic]) => nb(k, l, ic)).join('')}<div class="nav-sep"></div>${nb('notes', 'Notifications', 'bell', unread)}${nb('acct', 'My account', 'user')}
  <div class="grow"></div><button class="nav-i" data-act="theme">${svgi('moon')}Light / dark</button><button class="nav-i" data-act="logout">${svgi('out')}Log out</button>`;
 $('#topb').innerHTML = `<a class="logo" data-act="go" data-tab="${nav[0][0]}">${LOGO}</a><h1>${esc(pageTitle())}</h1>
  <div class="r"><button class="icon-btn hide-s" data-act="theme" aria-label="Switch theme"><span class="i-moon">🌙</span><span class="i-sun">☀️</span></button>
  <button class="icon-btn bell" data-act="go" data-tab="notes" aria-label="Notifications${unread ? ', ' + unread + ' unread' : ''}">🔔${unread ? `<sup>${unread}</sup>` : ''}</button>
  <button class="av" data-act="go" data-tab="acct" aria-label="My account">${avInner(me)}</button></div>`;
 $('#bnav').innerHTML = nav.map(([k, l, ic]) => `<button class="${tab == k ? 'on' : ''}" data-act="go" data-tab="${k}">${svgi(ic)}${l}</button>`).join('') + `<button class="${tab == 'acct' || tab == 'notes' ? 'on' : ''}" data-act="go" data-tab="acct">${svgi('user')}Account</button>`;
}
function setupHTML() {
 return `<div class="card setup"><h2>One-time database setup</h2><p class="mu">The marketplace table isn’t in your Supabase project yet.</p>
 <ol><li>Open your Supabase dashboard → <b>SQL Editor</b> → <b>New query</b>.</li><li>Paste everything from <code>supabase/setup.sql</code> and press <b>Run</b>.</li><li>Come back here and press <b>Retry</b>.</li></ol>
 <div class="note e">${esc(setupErr)}</div><div class="row"><button class="btn" data-act="retry">Retry</button><button class="btn s" data-act="logout">Log out</button></div></div>`;
}
// small UI pieces
const hchip = (v, l) => `<div class="hchip"><b class="cu">${v}</b><span>${l}</span></div>`;
const empty = (i, t, s = '', extra = '') => `<div class="card empty"><div class="ei">${i}</div><b>${t}</b>${s}${extra}</div>`;
const tags = l => l.items.map(i => `<span class="tag n">${icon(i.m)} ${esc(i.m)} · ${qtyOf(i)} ${unitOf(i)}</span>`).join('');
const iconsOf = l => [...new Set(l.items.map(i => icon(i.m)))].slice(0, 3).join('');
const sizeTxt = l => l.items.map(i => `${qtyOf(i)} ${unitOf(i)}`).join(' + ') || '–';
function ticker() {
 const it = MATS.filter((_, i) => i % 3 == 0).map(d => `<span>${d.i} ${esc(d.m)} <b>${fmtRate(d.m)}</b></span>`).join('');
 return `<div class="tick" title="Indicative reference ranges, updated ${priceDate()}. Not live prices."><div>${it}${it}</div></div>`;
}
function countUp() {
 if (RM.matches) return;
 $$('.cu').forEach(e => {
  const t = e.textContent.trim(), m = t.match(/^(₹?)([\d,]+(?:\.\d+)?)(.*)$/); if (!m) return;
  const to = parseFloat(m[2].replace(/,/g, '')), dec = (m[2].split('.')[1] || '').length; if (!to) return;
  const t0 = performance.now();
  (function f(n) { const p = Math.min(1, (n - t0) / 850), v = to * (1 - Math.pow(1 - p, 3)); e.textContent = m[1] + v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3]; if (p < 1) requestAnimationFrame(f) })(t0);
 });
}
function confetti() {
 if (RM.matches) return;
 const c = document.createElement('canvas'); c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
 const x = c.getContext('2d'), cl = ['#0e7a4b', '#2fd08a', '#f2a516', '#38bdc8', '#8b84ff'];
 const p = Array.from({ length: 90 }, () => ({ x: innerWidth / 2, y: innerHeight * .6, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, r: 4 + Math.random() * 5, c: cl[Math.floor(Math.random() * 5)], a: Math.random() * 6 }));
 let n = 0; (function f() { x.clearRect(0, 0, c.width, c.height); p.forEach(q => { q.vy += .35; q.x += q.vx; q.y += q.vy; q.a += .2; x.fillStyle = q.c; x.save(); x.translate(q.x, q.y); x.rotate(q.a); x.fillRect(-q.r / 2, -q.r / 2, q.r, q.r * .6); x.restore() }); if (++n < 110) requestAnimationFrame(f); else c.remove() })();
}

// ---------- notifications banner ----------
let seenNotes = null;
function pushCheck() {
 if (!me) return; const un = D.notes.filter(n => n.to == me.id && !n.read);
 if (!seenNotes) { seenNotes = new Set(un.map(n => n.id)); return }
 const nw = un.filter(n => !seenNotes.has(n.id)); nw.forEach(n => seenNotes.add(n.id)); if (!nw.length) return;
 const n = nw[nw.length - 1], b = $('#nb');
 b.innerHTML = `<i>🔔</i><div><b>Waste2Worth · just now</b><span>${esc(n.txt)}</span></div>`; b.classList.add('on');
 try { navigator.vibrate && navigator.vibrate(60) } catch { }
 try { if (window.Notification && Notification.permission == 'granted' && document.hidden) new Notification('Waste2Worth', { body: n.txt }) } catch { }
 clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('on'), 5000);
}

// ---------- modal ----------
let modalClose = null, lastFocus = null;
function openModal(html, { cls = '', onClose } = {}) {
 closeModal(true); modalClose = onClose || null; lastFocus = document.activeElement;
 $('#ov').innerHTML = `<div class="card modal ${cls}" role="dialog" aria-modal="true" aria-labelledby="mh"><button class="icon-btn x" data-act="closeModal" aria-label="Close">×</button>${html}</div>`;
 $('#ov').hidden = false; setTimeout(() => $('#ov').querySelector('input,select,.btn')?.focus(), 40);
}
function closeModal(silent) {
 if ($('#ov').hidden) return; const f = modalClose; modalClose = null;
 $('#ov').hidden = true; $('#ov').innerHTML = ''; f && f();
 if (!silent && lastFocus && lastFocus.isConnected) lastFocus.focus();
}

// ---------- photos: gallery, camera, resize, upload ----------
function pickFile(cb, capture) {
 const inp = $('#filePick'); inp.value = '';
 if (capture) inp.setAttribute('capture', capture); else inp.removeAttribute('capture');
 inp.onchange = () => { const f = inp.files[0]; if (f) cb(f) }; inp.click();
}
let camStream = null, camDone = null, camFacing = 'environment';
const camOK = () => !!(navigator.mediaDevices?.getUserMedia && isSecureContext);
function camErr(e) {
 const n = e?.name;
 return n == 'NotAllowedError' || n == 'SecurityError' ? 'Camera permission is blocked. Allow camera access for this site in your browser settings.'
  : n == 'NotFoundError' || n == 'OverconstrainedError' ? 'No camera found on this device.'
  : n == 'NotReadableError' ? 'The camera is being used by another app. Close it and try again.' : 'Could not open the camera.';
}
function stopCam(res) { camStream?.getTracks().forEach(t => t.stop()); camStream = null; const d = camDone; camDone = null; d && d(res ?? null) }
const getCam = f => navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: f }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
function openCamera(facing, title) {
 return new Promise(async (res, rej) => {
  try { stopCam(); camFacing = facing; camStream = await getCam(facing) } catch (e) { return rej(new Error(camErr(e))) }
  camDone = res;
  openModal(`<h3 id="mh">${esc(title)}</h3><video id="camv" autoplay playsinline muted></video>
   <div class="acts"><button class="btn" data-act="camShot">📸 Capture</button><button class="btn s" data-act="camFlip">🔄 Switch camera</button><button class="btn s" data-act="closeModal">Cancel</button></div>`, { cls: 'camwin', onClose: () => stopCam(null) });
  const v = $('#camv'); v.srcObject = camStream; v.classList.toggle('mirror', facing == 'user');
 });
}
async function camFlip() {
 const v = $('#camv'); if (!v) return; const next = camFacing == 'user' ? 'environment' : 'user';
 try { camStream.getTracks().forEach(t => t.stop()); camStream = await getCam(next); camFacing = next }
 catch { toast('Only one camera available'); try { camStream = await getCam(camFacing) } catch { } }
 v.srcObject = camStream; v.classList.toggle('mirror', camFacing == 'user');
}
function camShot() {
 const v = $('#camv'); if (!v || !v.videoWidth) return toast('Camera is still starting…');
 const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const g = c.getContext('2d');
 if (camFacing == 'user') { g.translate(c.width, 0); g.scale(-1, 1) } g.drawImage(v, 0, 0);
 c.toBlob(b => { stopCam(b); closeModal() }, 'image/jpeg', .9);
}
// Laptops ignore the file input's camera hint, so use a live preview when we can.
async function takePhoto(facing, title, cb) {
 if (!camOK()) return pickFile(cb, facing);
 try { const b = await openCamera(facing, title); if (b) cb(b) } catch (e) { toast(e.message) }
}
function shrink(f, max = 1024, square = false) {
 return new Promise((res, rej) => {
  const im = new Image(), u = URL.createObjectURL(f);
  im.onload = () => {
   const c = document.createElement('canvas'), g = c.getContext('2d');
   if (square) { const s = Math.min(im.width, im.height); c.width = c.height = max; g.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, max, max) }
   else { const k = Math.min(1, max / Math.max(im.width, im.height)); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); g.drawImage(im, 0, 0, c.width, c.height) }
   URL.revokeObjectURL(u); const url = c.toDataURL('image/jpeg', .8);
   c.toBlob(b => b ? res({ blob: b, url }) : rej(new Error('Could not read that photo')), 'image/jpeg', .82);
  };
  im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('That file is not a photo. Try a JPG or PNG.')) }; im.src = u;
 });
}
async function upload(blob, kind) {
 const path = `${authUser.id}/${kind}-${Date.now()}.jpg`;
 const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
 if (error) { console.warn(error); return null }
 return sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---------- location ----------
function locateInto(id) {
 if (!navigator.geolocation) return toast('Location is not available on this device');
 toast('Finding your location…');
 navigator.geolocation.getCurrentPosition(async p => {
  try {
   const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`), a = (await r.json()).address || {};
   const area = [a.suburb || a.neighbourhood || a.village || a.road, a.city || a.town || a.state_district].filter(Boolean).join(', ');
   const e = document.getElementById(id); if (e && area) { e.value = area; e.dispatchEvent(new Event('input', { bubbles: true })) }
   toast(area ? '📍 Location added' : 'Could not read your address');
  } catch { toast('Could not read your address') }
 }, () => toast('Location permission was blocked'), { timeout: 10000 });
}

// ---------- CSV ----------
function downloadCsv(name, rows) {
 if (rows.length < 2) return toast('Nothing to export yet');
 const csv = rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
 const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click();
 setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
