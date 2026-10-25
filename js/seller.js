// =========================================================
// Waste2Worth — seller pages: Sell, My listings, Earnings
// =========================================================
let draft = null, aiState = 'unknown';
const QUICK = ['Cardboard', 'Newspaper', 'PET bottles', 'Iron scrap', 'Aluminium cans', 'Copper scrap', 'Mixed e-waste', 'Mixed textile waste'];

function sellerNew() {
 const d = draft;
 let h = `<div class="cols"><div><div class="card"><h3>📷 Snap your waste</h3><p class="mu">Take a clear photo of your pile. AI suggests the materials; you confirm them and add rough quantities. The collector weighs or counts everything at pickup.</p>`;
 h += d && d.img
  ? `<div class="drop" tabindex="0" role="button" data-act="pickListing" aria-label="Change photo"><img src="${d.img}" alt="Your waste photo"><div class="chg"><span class="btn s sm">Change photo</span><button class="btn d sm" data-act="rmPhoto">🗑 Remove photo</button></div></div>`
  : `<div class="drop" tabindex="0" role="button" data-act="pickListing" aria-label="Add a photo of your waste"><div><div class="di">📷</div><b>Add a photo of your waste</b><p class="mu sm-t" style="margin:4px 0 0">Tap to choose from gallery, or drag an image here</p></div></div>`;
 h += `<div class="snap"><button class="btn s" data-act="camListing">📷 Camera</button><button class="btn s" data-act="pickListing">🖼 Gallery</button></div>
  <div class="aist ${aiState == 'ready' ? 'ok' : ''}"><i></i>${aiState == 'ready' ? 'AI photo recognition is ready' : aiState == 'off' ? 'AI recognition unavailable — add materials by hand' : 'AI suggests materials from your photo'}</div>
  ${!d ? '<button class="btn ghost sm" style="margin-top:8px" data-act="manualDraft">✍️ Or add materials by hand</button>' : ''}</div>`;
 if (d && d.loading) h += `<div class="card"><h3>✨ Analysing your photo…</h3><p class="mu">${d.retry ? `The AI is busy. Trying again (attempt ${d.retry} of 3)…` : 'Finding every material in the photo. This can take 1–2 minutes — you can start adding quantities once the list appears.'}</p><div class="skel" style="height:14px;width:70%;margin:8px 0"></div><div class="skel" style="height:14px;width:45%"></div></div>`;
 else if (d) h += reviewCard(d);
 h += `</div><div>${tipsCard()}<div class="card soft"><h3>How bidding works</h3><div class="tip">1️⃣ Verified buyers bid on your listing.</div><div class="tip">2️⃣ Offers are ranked by what <b>you take home</b> after pickup fees.</div><div class="tip">3️⃣ A collector weighs at your door and you confirm with a one-time code.</div><div class="tip">4️⃣ You’re paid for the verified quantity, with an itemised receipt.</div></div></div></div>`;
 return h;
}
function reviewCard(d) {
 let h = `<div class="card"><h3>Review and itemise</h3>${d.msg ? `<div class="note ${d.hazard ? 'e' : 'i'}">${esc(d.msg)}${aiState == 'off' && d.img ? '<div style="margin-top:8px"><button class="btn sm" data-act="retryAi">✨ Try AI again</button></div>' : ''}</div>` : ''}${d.ai && d.ai.tip ? `<div class="tip">💡 ${esc(d.ai.tip)}</div>` : ''}`;
 h += d.items.map((i, n) => {
  const u = unitOf(i), us = unitsOf(i.m), q = qtyOf(i);
  return `<div class="mrow"><div><select data-chg="dmat" data-i="${n}" aria-label="Material">${optionsFor(i.m)}</select><div class="mu">${i.conf ? `✨ AI ${i.conf}% · ` : ''}${fmtRate(i.m, u)}</div></div>
  ${us.length > 1 ? `<select data-chg="dunit" data-i="${n}" aria-label="Selling unit">${us.map(x => `<option value="${x}" ${x == u ? 'selected' : ''}>per ${x}</option>`).join('')}</select>` : `<span class="tag n">per ${u}</span>`}
  <input id="dq${n}" type="number" min="0" step="${u == 'piece' ? 1 : .1}" value="${q || ''}" placeholder="${u == 'piece' ? 'Count' : 'kg'}" data-inp="dqty" data-i="${n}" aria-label="${esc(i.m)} quantity">
  <button class="icon-btn" data-act="dRemove" data-i="${n}" aria-label="Remove ${esc(i.m)}">✕</button></div>`;
 }).join('') || '<p class="mu">No materials yet. Add them below.</p>';
 const quick = QUICK.filter(m => !d.items.some(i => i.m == m));
 h += `<div class="row" style="margin-top:14px"><select id="addm" style="flex:1;min-width:200px" aria-label="Material to add">${optionsFor('')}</select><button class="btn s" data-act="dAdd">+ Add</button></div>
  ${quick.length ? `<div class="qadd">${quick.map(m => `<button data-act="qAdd" data-m="${esc(m)}">${icon(m)} ${esc(m)}</button>`).join('')}</div>` : ''}
  <div class="estbox" id="estbox">${estHTML()}</div>
  <label class="f">Pickup address (Locality, City)<div class="inline-btn" style="margin-top:6px"><input id="larea" data-keep value="${esc(me.area)}"><button class="btn s" data-act="locate" data-to="larea" aria-label="Use my location">📍</button></div></label>
  <label class="f">Bidding stays open for<select id="lwin" data-keep><option value="3">3 hours</option><option value="6">6 hours</option><option value="24" selected>24 hours</option><option value="48">2 days</option></select></label>
  <label class="check"><input type="checkbox" id="lgps" data-keep> <span>Share my GPS location with the collector (optional)</span></label>
  <button class="btn w lg" id="pubBtn" data-act="publish" ${d.items.length ? '' : 'disabled'}>Publish for bidding</button></div>`;
 return h;
}
function estHTML() {
 if (!draft || !draft.items.length) return '<div class="mu">Add materials and rough quantities to see an estimate.</div>';
 // One row per material: reference rate × the quantity the seller entered = estimated value.
 let lo = 0, hi = 0, unpriced = false;
 const rows = draft.items.map(i => {
  const u = unitOf(i), q = qtyOf(i), p = rangeFor(i.m, u);
  if (p && q > 0) { lo += q * p.min; hi += q * p.max } else if (!p && q > 0) unpriced = true;
  const val = !p ? '<span class="mu">Buyer quote</span>' : q > 0 ? `<b>${fx0(q * (p.min + p.max) / 2)}</b><div class="mu xs">${fx0(q * p.min)}–${fx0(q * p.max)}</div>` : '<span class="mu">Enter qty</span>';
  return `<tr><td>${icon(i.m)} ${esc(i.m)}</td><td class="num">${p ? `${fx0(p.min)}–${fx0(p.max)}/${u}` : '–'}</td><td class="num">${q > 0 ? `${q} ${u}` : '<span class="mu">–</span>'}</td><td class="num">${val}</td></tr>`;
 }).join('');
 const midTotal = (lo + hi) / 2;
 return `<div class="tw"><table><tr><th>Material</th><th class="num">Est. price</th><th class="num">Quantity</th><th class="num">Est. value</th></tr>${rows}
  <tr><td colspan="3"><b>Estimated total</b>${unpriced ? ' <span class="mu xs">(plus items priced by buyer quote)</span>' : ''}</td><td class="num"><b class="big" style="font-size:1.25rem">${fx0(midTotal)}</b><div class="mu xs">${fx0(lo)}–${fx0(hi)}</div></td></tr></table></div>
  <p class="mu xs" style="margin:8px 0 0">Estimate only, from reference prices — buyers set the real price by bidding. Final payout uses verified quantity, quality and pickup fees.</p>`;
}
function tipsCard() {
 const it = draft && draft.items.length ? draft.items.map(i => i.m).slice(0, 4) : ['Aluminium cans', 'Cardboard', 'Copper scrap'];
 return `<div class="card"><h3>💡 Sell smarter</h3>${it.map(m => `<div class="tip"><b>${icon(m)} ${esc(m)}:</b> ${esc(tipFor(m))}</div>`).join('')}<div class="tip">🤝 Bigger, combined loads attract more bids. Ask a neighbour to list too and share a pickup.</div></div>`;
}
async function setListingPhoto(f) {
 let p; try { p = await shrink(f, 1024) } catch (e) { return toast(e.message) }
 draft = { items: draft ? draft.items : [], img: p.url, blob: p.blob };
 analyse();
}
// The AI describes a mixed photo as one text, e.g. "Mixed Dry Recyclables (Cardboard, Paper, PET, Cans, Glass)".
// Split it into separate material names so every material gets its own row and price.
function splitMaterials(text) {
 const s = String(text || ''), inner = (s.match(/\(([^)]*)\)/) || [])[1];
 const parts = (inner || s).split(/,|;|\/|&|\+|\band\b|\bwith\b/i).map(x => x.trim()).filter(Boolean);
 if (inner) parts.push(s.replace(/\([^)]*\)/, '').trim()); // keep the main label too, in case it is a material
 return parts.length ? parts : [s];
}
// Keywords → catalogue materials, for replies that name materials inside a sentence.
const MAT_WORDS = [
 [/corrugated/i, 'Corrugated cardboard'], [/cardboard|carton box|\bboxes\b/i, 'Cardboard'], [/newspaper/i, 'Newspaper'],
 [/magazine/i, 'Magazines'], [/\bbooks?\b|notebook/i, 'Books and notebooks'], [/tetra ?pa/i, 'Tetra packs'],
 [/\bpaper\b/i, 'Office paper'], [/\bpet\b|plastic bottle|water bottle/i, 'PET bottles'], [/hdpe/i, 'HDPE plastic'],
 [/plastic bag|polythene/i, 'Plastic bags'], [/plastic container/i, 'Plastic containers'],
 [/alumin(i)?um can|\bcans?\b|soda can|beverage can/i, 'Aluminium cans'], [/alumin(i)?um (scrap|sheet|foil|utensil)/i, 'Aluminium scrap'],
 [/copper wire/i, 'Copper wire'], [/copper/i, 'Copper scrap'], [/brass/i, 'Brass'], [/stainless/i, 'Stainless steel'],
 [/\bsteel\b/i, 'Steel scrap'], [/\biron\b/i, 'Iron scrap'], [/(green|brown|amber|colou?red) glass/i, 'Coloured glass bottles'],
 [/glass/i, 'Clear glass bottles'], [/e-?waste|electronic|circuit board/i, 'Mixed e-waste'], [/cable|charger/i, 'Cables and chargers'],
 [/textile|cloth|fabric|garment/i, 'Mixed textile waste'], [/rubber/i, 'Rubber scrap'], [/\bwood/i, 'Wooden scrap']
];
// Every catalogue material the AI mentions, in any reply format.
function findMaterials(data) {
 if (Array.isArray(data.items)) return data.items.map(x => canon(x && (x.m || x.name || x.material))).filter(Boolean);
 const found = [], add = m => { if (m && MAT[m] && !found.includes(m)) found.push(m) };
 splitMaterials(data.waste_type).forEach(p => add(canon(p)));
 const scan = t => MAT_WORDS.forEach(([re, m]) => { if (re.test(t || '')) add(m) });
 scan(data.waste_type);
 if (found.length <= 1) scan(data.tip); // a vague label like "Mixed recyclables": use the materials named in the tip
 if (found.includes('Mixed plastic') && found.includes('PET bottles')) found.splice(found.indexOf('Mixed plastic'), 1);
 return found;
}
// Calls the AI, retrying when it is busy. Returns the reply data or throws.
async function askPhotoAI(img, onRetry) {
 let last;
 for (let n = 1; n <= 3; n++) {
  try {
   const { data, error } = await sb.functions.invoke('ai', { body: { mode: 'analyze', image: img } });
   if (!error && data && !data.error) return data;
   last = new Error(data?.error || error?.message || 'AI unavailable');
  } catch (e) { last = e }
  if (n < 3) { onRetry(n + 1); await new Promise(r => setTimeout(r, n * 3000)) }
 }
 throw last;
}
async function analyse() {
 const d = draft; if (!d || !d.img) return; const pic = d.img;
 d.loading = true; d.msg = ''; d.hazard = false; d.retry = 0; render();
 try {
  const data = await askPhotoAI(d.img, n => { if (draft === d) { d.retry = n; render() } });
  if (draft !== d || d.img !== pic) return; // photo was removed or changed meanwhile
  const raw = findMaterials(data).map(name => ({ name, conf: data.confidence }));
  d.ai = { tip: data.tip || '', cond: data.condition || '' };
  if (data.hazardous) { d.hazard = true; d.msg = `⚠ ${data.waste_type || 'This item'} looks hazardous. It needs an authorised collection centre. Add only safe materials by hand.` }
  else raw.forEach(x => {
   const m = canon(x && (x.m || x.name || x.material || x.waste_type)); let c = +(x && (x.conf ?? x.confidence)) || 85; if (c <= 1) c *= 100;
   if (m && !d.items.some(i => i.m == m)) d.items.push({ m, unit: unitFor(m), qty: 0, conf: Math.round(Math.min(99, c)) });
  });
  if (!d.hazard && !d.items.length) d.msg = /not waste/i.test(data.waste_type || '') ? 'We couldn’t see any waste in this photo. Try a closer photo, or add materials by hand.' : 'We couldn’t match a catalogue material. Pick it from the list below.';
  aiState = 'ready'; if (d.items.length) toast(`Found ${d.items.length} material${d.items.length > 1 ? 's' : ''}. Add rough quantities.`);
 } catch (e) {
  if (draft !== d) return; aiState = 'off';
  d.msg = /demand|busy|overload|rate/i.test(e && e.message || '') ? 'The AI is very busy right now. Tap “Try AI again” in a minute, or add the materials by hand below.' : 'Photo recognition isn’t available right now. Tap “Try AI again”, or add the materials by hand below.';
 }
 d.loading = false; render();
}
async function publish() {
 const d = draft, area = $('#larea').value.trim();
 const items = d.items.filter(i => qtyOf(i) > 0).map(i => ({ m: i.m, unit: unitOf(i), qty: unitOf(i) == 'piece' ? Math.round(qtyOf(i)) : qtyOf(i), conf: i.conf || 0 }));
 if (!area) return toast('Enter your pickup address');
 if (!items.length) return toast('Enter a rough quantity for at least one material');
 const btn = $('#pubBtn'); btn.disabled = true; btn.textContent = 'Publishing…';
 const l = { id: uid('L'), k: Date.now(), seller: me.id, type: me.type || '', area, items, status: 'open', end: Date.now() + (+$('#lwin').value || 24) * 36e5 };
 if ($('#lgps').checked && navigator.geolocation) await new Promise(r => navigator.geolocation.getCurrentPosition(p => { l.gps = [+p.coords.latitude.toFixed(4), +p.coords.longitude.toFixed(4)]; r() }, () => r(), { timeout: 5000 }));
 if (d.blob) { const url = await upload(d.blob, 'listing'); if (url) l.photo = url; else toast('Photo upload failed — listing saved without photo') }
 const sig = x => x.items.map(i => i.m).sort().join();
 const dup = D.listings.find(x => x.seller == me.id && x.status == 'open' && x.area == area && sig(x) == sig(l));
 D.listings.push(l); autoBid(l);
 if (dup) D.alerts.push({ id: uid('A'), k: Date.now(), txt: `Possible duplicate listing in ${area} by ${me.name}`, st: 'open' });
 if (!me.area) me.area = area;
 log(`${me.name} published a listing in ${area}`); draft = null; tab = 'mine'; save();
 toast('Listing published. Buyers can now bid.'); render();
}

function statusTag(l) { return { open: '<span class="tag">Open for bids</span>', accepted: '<span class="tag i">Order in progress</span>', completed: '<span class="tag">✓ Completed</span>', cancelled: '<span class="tag n">Cancelled</span>' }[l.status] || '' }
function bidCards(l) {
 const r = ranked(l);
 if (!r.length) return '<div class="note i">⏳ Waiting for bids. Verified buyers can see your listing now.</div>';
 return `<div class="bids">${r.map((b, i) => `<div class="bid ${i == 0 ? 'top' : ''}"><div class="bh"><span class="rk">${i == 0 ? '🏆 Best offer' : '#' + (i + 1)}</span><span class="mu">★ ${b.rel ? b.rel.toFixed(1) : 'New'} · ${b.pl}</span></div>
  <div class="bn">${esc(U(b.b).name)}${b.auto ? ' <span class="tag n">auto</span>' : ''}</div><div class="bm"><b>${fx0(b.net)}</b><span>you take home (estimate)</span></div>
  <div class="mu xs">${Object.entries(b.rates).filter(e => e[1] > 0).map(([m, v]) => `${icon(m)} ₹${v}/${unitFor(m)}`).join(' · ')}<br>Pickup fee ${fx0(b.fee)}</div>
  <div class="row" style="margin-top:8px"><button class="btn sm" data-act="accept" data-id="${b.id}">Accept offer</button><button class="btn s sm" data-act="decline" data-id="${b.id}">Decline</button></div></div>`).join('')}</div><p class="mu xs" style="margin:10px 0 0">Ranked by your take-home (70%), distance (15%) and buyer rating (15%).</p>`;
}
function sellerMine() {
 const ls = D.listings.filter(l => l.seller == me.id).slice().reverse();
 if (!ls.length) return empty('📭', 'No listings yet', '<p>Photograph your waste and let buyers compete for it.</p>', '<button class="btn" data-act="go" data-tab="new">📷 Sell now</button>');
 return ls.map(l => {
  const o = D.orders.find(x => x.l == l.id);
  return `<div class="card"><div class="lhead"><div class="lpic">${l.photo ? `<img src="${esc(l.photo)}" alt="Your listing photo" class="zoom" data-act="viewPhoto" data-src="${esc(l.photo)}" title="Tap to enlarge">` : iconsOf(l)}</div><div style="flex:1;min-width:0">
  <div class="row"><b>${esc(l.area)}</b>${statusTag(l)}${l.status == 'open' ? `<span class="tag ${closed(l) ? 'w' : 'live'}">${leftTxt(l)}</span>` : ''}</div>
  <div class="mu sm-t">${sizeTxt(l)} est. · listed ${when(l.k)} · reference ${fx0(listingRef(l))}</div><div style="margin-top:6px">${tags(l)}</div></div></div>
  ${o ? orderBox(o, 'seller') : l.status == 'open' ? bidCards(l) + `<div class="row" style="margin-top:12px">${closed(l) ? `<button class="btn sm" data-act="relist" data-id="${l.id}">Reopen bidding (24 h)</button>` : ''}<button class="btn s sm" data-act="cancelL" data-id="${l.id}">Cancel listing</button></div>` : ''}</div>`;
 }).join('');
}
function accept(id) {
 const b = Bd(id), l = b && Lst(b.l);
 if (!l || l.status != 'open') return toast('This listing is no longer open');
 l.status = 'accepted';
 const o = { id: uid('O'), k: Date.now(), l: l.id, b: b.id, buyer: b.b, seller: l.seller, step: 0, pay: null, hist: [{ t: Date.now(), s: STEPS[0] }], coll: null, slot: null, wts: null, appr: null, disp: null, msgs: [] };
 // Book the earliest pickup slot and send the job to approved collectors right away.
 o.slot = slots()[0]; adv(o, 1); D.orders.push(o);
 notify(b.b, `${me.name} accepted your bid on ${l.area}. Pickup is booked for ${o.slot}.`); notifyCollectors(o, l);
 D.bids.filter(x => x.l == l.id && x.id != b.id).forEach(x => notify(x.b, `The listing in ${l.area} was sold to another buyer.`));
 log(`${me.name} accepted a bid from ${U(b.b).name}`);
 save(); toast(`Order confirmed with ${U(b.b).name}. Pickup booked for ${o.slot}.`); render();
}
function decline(id) {
 const b = Bd(id), l = b && Lst(b.l);
 if (!l || l.seller != me.id || l.status != 'open') return toast('This listing is no longer open');
 if (!confirm(`Decline the offer from ${U(b.b).name}?`)) return;
 D.bids = D.bids.filter(x => x.id != id);
 notify(b.b, `${me.name} declined your offer on the listing in ${l.area}. You can send a better offer while bidding is open.`);
 log(`${me.name} declined a bid from ${U(b.b).name}`); save(); toast('Offer declined'); render();
}
function approve(id, ok) {
 const o = Ord(id); if (!o) return;
 if (o.coll) notify(o.coll, ok ? `Seller approved the revised value. Verify the pickup code.` : `Seller disputed the revised value. Admin will review.`);
 if (ok) { o.appr = 'ok'; log('Seller approved revised value') } else { o.appr = 'disputed'; o.disp = 'open'; log('Seller disputed an order'); D.alerts.push({ id: uid('A'), k: Date.now(), txt: `Dispute opened by ${me.name} on order #${o.id.slice(-6).toUpperCase()}`, st: 'open' }) }
 save(); render();
}
function rate(id, n) {
 const o = Ord(id), b = o && U(o.buyer); if (!o || o.rated) return;
 o.rated = n; if (b.id) { b.rsum = (b.rsum || 0) + n; b.rn = (b.rn || 0) + 1 }
 log(`Seller rated ${b.name} ${n}/5`); save(); toast('Thanks for rating'); render();
}
function earnings() {
 const os = D.orders.filter(o => o.seller == me.id && o.pay).slice().reverse(), paid = os.reduce((s, o) => s + (o.pay.split ? (o.pay.split.seller.st == 'Received' ? o.pay.split.seller.amt : 0) : o.pay.st == 'Paid' ? o.pay.net : 0), 0);
 return `<div class="cols"><div><div class="card"><div class="row between"><div><div class="mu">Total received</div><div class="big cu">${fx(paid)}</div></div><button class="btn s sm" data-act="csv" data-k="sales">⬇ Download CSV</button></div></div>
  ${os.length ? os.map(o => receipt(o, 'seller')).join('') : empty('💰', 'No payments yet', '<p>Completed orders and receipts appear here.</p>')}</div>
  <div>${ecoCard()}${impactCard(os)}${leaderboard()}</div></div>`;
}
