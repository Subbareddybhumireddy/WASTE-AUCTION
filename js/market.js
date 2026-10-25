// =========================================================
// Waste2Worth — marketplace rules shared by every role
// =========================================================
const STEPS = ['Order confirmed', 'Pickup scheduled', 'Collector assigned', 'On the way', 'Waste weighed', 'Picked up (code verified)', 'Delivered to buyer'];
const COMM = .05; // seller commission
const bFee = o => Math.max(10, Math.round(o.pay.gross * .02));        // buyer platform fee
const kgOfOrder = o => (o.wts || []).reduce((a, w) => a + (unitOf(w) == 'kg' ? qtyOf(w) : 0), 0);
const cEarn = o => Math.max(20, Math.round(kgOfOrder(o) * 1.5));        // collector earning
const cFee = o => Math.max(5, Math.round(cEarn(o) * .10));              // collector platform fee

// "Locality, City" → {l, c}
function loc(a) { const p = String(a || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean); return { l: p.length > 1 ? p[0] : '', c: p.length ? p[p.length - 1] : '' } }
function prox(u, l) { const x = loc(u.area), y = loc(l.area); if (x.c && x.c == y.c) return x.l && x.l == y.l ? ['Same locality', 1] : ['Same city', .6]; return ['Other city', .2] }
const est = (l, b) => l.items.reduce((s, i) => s + qtyOf(i) * (+(b.rates || {})[i.m] || 0), 0);
const net = (l, b) => l && b ? est(l, b) - (+b.fee || 0) : 0;
const totKg = l => l.items.reduce((s, i) => s + (unitOf(i) == 'kg' ? qtyOf(i) : 0), 0);
const closed = l => !!l.end && Date.now() > l.end;
function leftTxt(l) { if (!l.end) return 'Open'; const ms = l.end - Date.now(); if (ms <= 0) return 'Bidding closed'; const m = Math.floor(ms / 6e4), h = Math.floor(m / 60); return 'Closes in ' + (h >= 24 ? Math.floor(h / 24) + 'd ' + (h % 24) + 'h' : h ? h + 'h ' + (m % 60) + 'm' : m + 'm') }
const rating = u => u.rn ? u.rsum / u.rn : 0;
// Offers ranked by what the seller takes home (70%), distance (15%) and buyer rating (15%)
function ranked(l) {
 const bs = D.bids.filter(b => b.l == l.id).map(b => { const u = U(b.b), p = prox(u, l); return { ...b, net: net(l, b), pl: p[0], pv: p[1], rel: rating(u) } });
 const mx = Math.max(...bs.map(b => b.net), 1);
 bs.forEach(b => b.score = Math.round(Math.max(b.net, 0) / mx * 70 + b.pv * 15 + b.rel / 5 * 15));
 return bs.sort((a, b) => b.score - a.score);
}
function slots() { const o = []; for (let d = 1; d <= 3; d++) { const t = new Date(Date.now() + d * 864e5).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); o.push(t + ', 10am–12pm', t + ', 4pm–6pm') } return o }
function adv(o, s) { o.step = s; (o.hist = o.hist || []).push({ t: Date.now(), s: STEPS[s] }) }

// buyer rate cards
function inSvc(u, l) { const a = loc(l.area), list = String(u.svc || loc(u.area).c).toLowerCase().split(',').map(s => s.trim()).filter(Boolean); return list.includes('*') || list.includes('all') || list.some(s => s == a.c || s == a.l) }
function quoteFor(u, l) {
 const rates = {}; let any = false;
 l.items.forEach(i => { const v = +(u.rates || {})[i.m] || 0, unit = (u.rateUnits || {})[i.m] || unitFor(i.m); if (v > 0 && unit == unitOf(i)) { rates[i.m] = v; any = true } else rates[i.m] = 0 });
 if (!any || totKg(l) < (u.minKg || 0) || !inSvc(u, l)) return null;
 return { rates, fee: +u.fee || 0 };
}
function autoBid(l) {
 D.users.filter(u => u.role == 'buyer' && u.ok && u.auto && !u.sus).forEach(u => {
  if (D.bids.some(b => b.l == l.id && b.b == u.id)) return; const q = quoteFor(u, l); if (!q) return;
  D.bids.push({ id: uid('D'), k: Date.now(), l: l.id, b: u.id, rates: q.rates, fee: q.fee, auto: true }); notify(l.seller, `New auto-bid from ${u.name} on your listing in ${l.area}`);
 });
}
function autoAll(u) {
 D.bids = D.bids.filter(b => !(b.b == u.id && b.auto && Lst(b.l)?.status == 'open'));
 if (u.ok && u.auto) D.listings.filter(l => l.status == 'open' && !closed(l) && l.seller != u.id).forEach(l => {
  if (D.bids.some(b => b.l == l.id && b.b == u.id)) return; const q = quoteFor(u, l);
  if (q) D.bids.push({ id: uid('D'), k: Date.now(), l: l.id, b: u.id, rates: q.rates, fee: q.fee, auto: true });
 });
}
function notifyCollectors(o, l) {
 const what = l.items.map(i => `${i.m} ${qtyOf(i)} ${unitOf(i)}`).join(', ');
 D.users.filter(u => u.role == 'collector' && u.ok && !u.sus)
  .forEach(u => notify(u.id, `New pickup at ${l.area} on ${o.slot}: ${what} (about ${r1(totKg(l))} kg)`));
}
// Real Google Maps link: exact GPS if the seller shared it, otherwise the written address.
const mapsUrl = l => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l.gps ? l.gps.join(',') : l.area);
// Place for Google Maps: exact GPS if known, otherwise the written address.
const mapsQ = x => x && x.gps ? x.gps.join(',') : (x && x.area) || '';
const dirUrl = (from, to) => 'https://www.google.com/maps/dir/?api=1' + (from ? '&origin=' + encodeURIComponent(from) : '') + '&destination=' + encodeURIComponent(to) + '&travelmode=driving';

// ---------- environmental impact ----------
const LV = [[0, 'Seedling', '🌱'], [10, 'Sprout', '🌿'], [50, 'Eco Warrior', '🌳'], [150, 'Planet Hero', '🌍']];
function ecoFromWts(list) { let kg = 0, co2 = 0; list.forEach(w => { const k = kgOfItem(w); kg += k; co2 += k * co2f(w.m) }); return { kg, co2 } }
function ecoStats(id) { const os = D.orders.filter(o => (!id || o.seller == id) && o.pay && o.wts); const s = ecoFromWts(os.flatMap(o => o.wts)); s.n = os.length; return s }
function impactCard(os) {
 const s = ecoFromWts(os.filter(o => o.wts && o.pay).flatMap(o => o.wts)); if (!s.kg) return '';
 return `<div class="card"><h3>🌍 Environmental impact</h3><div class="row"><span class="tag">${r1(s.kg)} kg recycled</span><span class="tag">≈ ${Math.round(s.co2)} kg CO₂ saved</span><span class="tag">≈ ${Math.max(1, Math.round(s.co2 / 21))} trees’ yearly absorption</span></div><p class="mu xs" style="margin:10px 0 0">Indicative estimates from typical recycling savings per kg.</p></div>`;
}
function ecoCard() {
 const s = ecoStats(me.id); let i = 0; LV.forEach((l, x) => { if (s.kg >= l[0]) i = x });
 const nx = LV[i + 1], pc = nx ? Math.min(100, (s.kg - LV[i][0]) / (nx[0] - LV[i][0]) * 100) : 100;
 const B = [['🥇 First sale', s.n >= 1], ['♻️ 10 kg recycled', s.kg >= 10], ['🚛 3 orders', s.n >= 3], ['🌬️ 25 kg CO₂ saved', s.co2 >= 25], ['🏆 100 kg club', s.kg >= 100]];
 return `<div class="card"><div class="lvl"><div class="em">${LV[i][2]}</div><div style="flex:1"><div class="mu sm-t">Your eco level</div><h3 style="margin:0 0 8px">${LV[i][1]}</h3><div class="pg"><i style="width:${pc}%"></i></div><div class="mu sm-t" style="margin-top:6px">${r1(s.kg)} kg recycled${nx ? ` · ${Math.ceil(nx[0] - s.kg)} kg to ${nx[1]} ${nx[2]}` : ' · Top level reached'}</div></div></div><div class="bdg">${B.map(b => `<span class="${b[1] ? '' : 'lk'}">${b[0]}</span>`).join('')}</div></div>`;
}
function leaderboard() {
 const r = D.users.filter(u => u.role == 'seller').map(u => ({ u, kg: ecoStats(u.id).kg })).filter(x => x.kg > 0).sort((a, b) => b.kg - a.kg).slice(0, 5);
 return `<div class="card"><h3>🏆 Green leaderboard</h3><p class="mu sm-t">Top recyclers on the platform. Great for hostel and campus challenges.</p>${r.map((x, i) => `<div class="lb ${x.u.id == me.id ? 'me' : ''}"><span>${['🥇', '🥈', '🥉', '4', '5'][i]}</span><b>${esc(x.u.name)}${x.u.id == me.id ? ' (you)' : ''}</b><em>${r1(x.kg)} kg</em></div>`).join('') || '<p class="mu">Complete a sale to enter the leaderboard.</p>'}</div>`;
}

// ---------- maps (illustrative, positions come from the address text) ----------
const hp = t => { let h = 7; for (const c of String(t || 'x').toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0; return [70 + h % 460, 60 + (h >> 10) % 220] };
const posOf = a => { const p = loc(a), b = hp(p.c), o = hp(p.l); return [Math.round(b[0] * .55 + o[0] * .45), Math.round(b[1] * .55 + o[1] * .45)] };
const man = (a, b) => [a, [b[0], a[1]], b];
const plen = r => r.slice(1).reduce((s, p, i) => s + Math.abs(p[0] - r[i][0]) + Math.abs(p[1] - r[i][1]), 0);
const kmOf = r => plen(r) / 38;
function along(r, f) { let d = plen(r) * f; for (let i = 1; i < r.length; i++) { const a = r[i - 1], b = r[i], L = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); if (d <= L || i == r.length - 1) { const t = L ? Math.min(1, d / L) : 1; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] } d -= L } return r[0] }
function mapSvg(id, pins, route, live) {
 let roads = ''; for (let x = 40; x < 600; x += 60) roads += `<line x1="${x}" y1="0" x2="${x}" y2="340"/>`; for (let y = 30; y < 340; y += 55) roads += `<line x1="0" y1="${y}" x2="600" y2="${y}"/>`;
 const bl = [[100, 70, 40, 30], [220, 160, 50, 40], [400, 40, 55, 35], [480, 200, 60, 45], [60, 230, 45, 40], [330, 250, 50, 40]].map(b => `<rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" rx="8" fill="var(--brand-100)" opacity=".7"/>`).join('');
 const pn = pins.map(p => `<g transform="translate(${p[0]} ${p[1]})">${p[3] ? `<circle r="10" fill="${p[3]}" class="pulse"/>` : ''}<circle r="16" fill="var(--surface)" stroke="${p[3] || 'var(--brand)'}" stroke-width="2.5"/><text y="6" text-anchor="middle" font-size="16" font-weight="700" fill="var(--ink)">${p[2]}</text><text y="34" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)" stroke="var(--surface)" stroke-width="3" paint-order="stroke">${esc(p[4] || '')}</text></g>`).join('');
 const rt = route ? `<polyline points="${route.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--role)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 11"/>` : '';
 const lv = live ? `<g id="trk${id}" data-r='${JSON.stringify(live.r)}' data-t="${live.t}" data-m="${live.m}"><circle r="19" fill="var(--role)" opacity=".25" class="pulse"/><circle r="16" fill="var(--role)"/><text y="6" text-anchor="middle" font-size="17">🚚</text></g>` : '';
 return `<svg viewBox="0 0 600 340" role="img" aria-label="Route map"><rect width="600" height="340" fill="var(--surface-2)"/><path d="M0 270C140 230 230 300 360 262S520 210 600 240V340H0Z" fill="rgba(56,189,200,.18)"/><g fill="none" stroke="var(--line-2)" stroke-width="9" stroke-linecap="round" opacity=".7">${roads}</g>${bl}${rt}${pn}${lv}</svg>`;
}
function orderMap(o) {
 if (o.step < 2 || o.step > 4 || !o.coll) return ''; const l = Lst(o.l); if (!l) return '';
 const c = U(o.coll), A = posOf(c.area), B = posOf(l.area), r = man(A, B), m = Math.max(6, Math.round(plen(r) / 22));
 const live = o.step == 3 && o.t3 ? { r, t: o.t3, m } : null;
 return `<div class="mapbox">${mapSvg(o.id, [[B[0], B[1], '🏠', null, 'Pickup'], ...(o.step < 3 ? [[A[0], A[1], '🚚', 'var(--role)', firstName(c.name)]] : [])], r, live)}<div class="mapbar"><span id="eta${o.id}">${o.step == 2 ? `Collector assigned · about ${m} min away` : o.step == 3 ? '🚚 On the way' : '✅ Collector has arrived'}</span><b>${kmOf(r).toFixed(1)} km</b></div></div>`;
}
function tick() {
 $$('[id^=trk]').forEach(g => {
  const r = JSON.parse(g.dataset.r), t = +g.dataset.t, m = +g.dataset.m, f = Math.min(1, (Date.now() - t) / (m * 6000)), p = along(r, f);
  g.setAttribute('transform', `translate(${p[0]} ${p[1]})`);
  const e = document.getElementById('eta' + g.id.slice(3)); if (e) e.textContent = f >= 1 ? '🚚 Arriving now' : `🚚 On the way · ETA ${Math.max(1, Math.ceil((1 - f) * m))} min`;
 });
}

// ---------- order pieces ----------
// Pickup details shown to seller, buyer and collector alike.
// o = order (optional, for people/slot/verified weights); photo = show the listing photo.
// trip = show the collector's two stops (seller pickup → buyer drop-off) with directions.
function pickupDetails(l, o, photo = true, trip = false) {
 const pic = photo && l.photo ? `<img class="bidpic zoom" src="${esc(l.photo)}" alt="Photo of the waste to collect" data-act="viewPhoto" data-src="${esc(l.photo)}" title="Tap to enlarge">` : '';
 const vw = o && o.wts ? Object.fromEntries(o.wts.map(w => [w.m, w])) : null;
 const rows = l.items.map(i => `<tr><td>${icon(i.m)} ${esc(i.m)}</td><td class="num">${qtyOf(i)} ${unitOf(i)}</td>${vw ? `<td class="num"><b>${vw[i.m] ? qtyOf(vw[i.m]) + ' ' + unitOf(vw[i.m]) : '–'}</b></td>` : ''}</tr>`).join('');
 const vkg = vw ? o.wts.reduce((s, w) => s + kgOfItem(w), 0) : 0;
 let who = '';
 if (o) {
  const c = o.coll && U(o.coll);
  who = `<div class="pwho"><span>♻️ Seller <b>${esc(U(o.seller).name)}</b></span><span>🏪 Buyer <b>${esc(U(o.buyer).name)}</b></span>${c ? `<span>🚚 Collector <b>${esc(c.name)}</b>${c.type ? ' · ' + esc(c.type) : ''}</span>` : trip ? '' : '<span>🚚 Collector <b class="wait">Finding a collector…</b></span>'}${o.slot ? `<span>🗓 <b>${esc(o.slot)}</b></span>` : ''}</div>`;
 }
 const pickup = `<div class="row between"><div><div class="mu xs">📍 ${trip ? '1 · Pick up from seller' : 'Pickup location'}${o && trip ? ` — ${esc(U(o.seller).name)}` : ''}</div><b>${esc(l.area)}</b>${l.gps ? '<div class="mu xs">Exact GPS shared by the seller</div>' : ''}</div>
  <a class="btn s sm" href="${trip ? dirUrl('', mapsQ(l)) : mapsUrl(l)}" target="_blank" rel="noopener">🗺 ${trip ? 'Directions' : 'Open in Google Maps'}</a></div>`;
 let drop = '';
 if (trip && o) {
  const b = U(o.buyer), bq = mapsQ(b);
  drop = `<div class="stopline" aria-hidden="true"></div><div class="row between"><div><div class="mu xs">🏪 2 · Deliver to buyer — ${esc(b.name)}</div>${bq ? `<b>${esc(b.area || bq)}</b>${b.gps ? '<div class="mu xs">Exact GPS shared by the buyer</div>' : ''}` : '<b class="wait">Buyer has not added an address yet — ask them in Messages</b>'}</div>
   ${bq ? `<a class="btn s sm" href="${dirUrl(mapsQ(l), bq)}" target="_blank" rel="noopener">🗺 Directions</a>` : ''}</div>
   ${bq ? `<a class="btn sm w" style="margin-top:10px" href="${dirUrl(mapsQ(l), bq)}" target="_blank" rel="noopener">🧭 Full route: seller → buyer in Google Maps</a>` : ''}`;
 }
 return `${pic}<div class="pinfo">${who}${pickup}${drop}
  <div class="tw" style="margin-top:10px"><table><tr><th>Item</th><th class="num">Seller’s estimate</th>${vw ? '<th class="num">Verified at pickup</th>' : ''}</tr>${rows}
  <tr><td><b>Total weight</b></td><td class="num"><b>~${r1(totKg(l))} kg</b></td>${vw ? `<td class="num"><b>${r1(vkg)} kg</b></td>` : ''}</tr></table></div>
  ${o && o.chk ? '<div class="mu xs" style="margin-top:8px">✅ Collector checked the items against the listing photo</div>' : ''}</div>`;
}
// ---------- payment: buyer pays Waste2Worth, the app splits it ----------
// pay.st: 'Awaiting payment' → 'Confirming' (buyer reported UTR) → 'Paid' (admin confirmed it arrived)
// Once paid, the split is fixed in pay.split and each share is paid out by the admin:
//   collector: transport fee − collector platform fee
//   admin:     seller commission + buyer platform fee + collector platform fee
//   seller:    everything that is left
// Payout st: 'Pending' → 'Sent' (admin entered UTR) → 'Received' (person confirmed)
const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,63}$/;
const upiLink = (upi, name, amt, note) => `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}&am=${(+amt).toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
const adminUser = () => D.users.find(u => u.role == 'admin');
const r2 = n => Math.round(n * 100) / 100;
const ordNo = o => '#' + o.id.slice(-6).toUpperCase();
// The money for one order. T = what the buyer pays the platform.
function splitOf(o) {
 const p = o.pay, gross = p.gross, fee = p.fee || 0, comm = p.comm, bf = bFee(o);
 const coll = o.coll ? Math.max(0, cEarn(o) - cFee(o)) : 0, cf = o.coll ? cFee(o) : 0;
 const T = r2(gross - fee + bf), admin = r2(comm + bf + cf), seller = r2(Math.max(0, T - coll - admin));
 return { T, coll, admin, seller, gross, fee, comm, bf, cf, transport: o.coll ? cEarn(o) : 0 };
}
const payTotal = o => o.pay.T != null ? o.pay.T : splitOf(o).T;
// Unpaid orders from the earlier direct-to-seller flow move to the platform flow.
function upgradePay(o) {
 const p = o && o.pay; if (!p || p.v || p.st == 'Paid' || !o.wts) return;
 Object.assign(p, { v: 2, st: 'Awaiting payment', method: 'UPI', utr: null }); p.T = splitOf(o).T; p.net = splitOf(o).seller;
}
function payoutLine(o, who) {
 const s = o.pay.split && o.pay.split[who]; if (!s) return '';
 const tag = s.st == 'Received' ? '<span class="tag">Received</span>' : s.st == 'Sent' ? '<span class="tag i">Sent</span>' : '<span class="tag w">Pending</span>';
 return `${tag} ${fx(s.amt)}${s.utr ? ` · UTR ${esc(s.utr)}` : ''}`;
}
// What the buyer and the seller see on the order.
function payBox(o, role) {
 upgradePay(o); const p = o.pay; if (!p) return '';
 const head = (t, st = p.st) => `<div class="paybox"><div class="row between"><b>💳 ${t}</b><span class="tag ${st == 'Paid' || st == 'Received' ? '' : 'w'}">${esc(st)}</span></div>`;
 if (!p.v) return head(`${fx(p.amt != null ? p.amt : p.gross - (p.fee || 0))} payment`) + `<div class="mu sm-t">${p.method ? esc(p.method) : ''}${p.utr ? ' · UTR ' + esc(p.utr) : ''}</div></div>`; // older orders
 const sp = splitOf(o), T = payTotal(o), a = adminUser();
 if (role == 'buyer') {
  if (p.st == 'Paid') return head(`${fx(T)} paid to Waste2Worth`) + `<div class="mu sm-t">UPI · UTR ${esc(p.utr || '')} · confirmed ${p.paidAt ? when(p.paidAt) : ''}. The seller and collector are paid from this.</div></div>`;
  if (p.st == 'Confirming') return head('Payment being confirmed') + `<div class="mu sm-t">You reported paying ${fx(T)} (UTR ${esc(p.utr)}). Waste2Worth will confirm it shortly.</div></div>`;
  const upi = a && a.upi && UPI_RE.test(a.upi) ? a.upi : '';
  const bill = `<div class="tw" style="margin:8px 0 12px"><table><tr><td>Verified value of the waste</td><td class="num">${fx(sp.gross)}</td></tr>${sp.fee ? `<tr><td>Pickup discount in your bid</td><td class="num">− ${fx(sp.fee)}</td></tr>` : ''}<tr><td>Platform fee (2%)</td><td class="num">+ ${fx(sp.bf)}</td></tr><tr><td><b>Total to pay</b></td><td class="num"><b>${fx(T)}</b></td></tr></table></div>`;
  return head(`Pay ${fx(T)} to Waste2Worth`) + `<div class="mu xs">One payment covers everything. Waste2Worth pays the seller and the collector their shares automatically.</div>${bill}
  ${upi ? `<div class="payupi"><div class="upiqr" data-uri="${esc(upiLink(upi, 'Waste2Worth', T, 'Waste2Worth order ' + ordNo(o)))}" aria-label="UPI QR code"></div>
   <div style="flex:1;min-width:200px"><b>📱 Pay by UPI</b><div class="mu xs">Scan with any UPI app (GPay, PhonePe, Paytm, BHIM), or tap the button on your phone.</div>
    <div class="mu sm-t" style="margin:6px 0">Waste2Worth UPI ID: <b>${esc(upi)}</b> <button class="btn s xs" data-act="copyUpi" data-upi="${esc(upi)}">Copy</button></div>
    <a class="btn sm" href="${esc(upiLink(upi, 'Waste2Worth', T, 'Waste2Worth order ' + ordNo(o)))}">Pay ${fx(T)} with UPI app</a>
    <label class="f" style="margin-top:10px">UTR / UPI reference number (12 digits)<input id="utr${o.id}" data-keep inputmode="numeric" maxlength="12" placeholder="e.g. 412345678901"></label>
    <button class="btn role w" data-act="payUpi" data-id="${o.id}">I have paid by UPI</button></div></div>`
   : '<div class="note">Payment details are being set up. You’ll be notified as soon as you can pay.</div>'}</div>`;
 }
 if (role == 'seller') {
  if (p.st != 'Paid') return head(`You will receive about ${fx(sp.seller)}`) + `<div class="mu sm-t">${p.st == 'Confirming' ? 'The buyer has paid. Waste2Worth is confirming the payment.' : `Waiting for ${esc(U(o.buyer).name)} to pay.`} Your share is sent to your UPI ID automatically once the payment is confirmed.</div>${me.upi ? '' : '<div class="note" style="margin-top:8px">Add your UPI ID so we can pay you. <button class="btn sm" data-act="go" data-tab="acct">Add UPI ID</button></div>'}</div>`;
  const s = p.split.seller;
  return head(`Your payout: ${fx(s.amt)}`, s.st) + `<div class="mu sm-t">${s.st == 'Pending' ? 'Waste2Worth is sending your money to your UPI ID.' : s.st == 'Sent' ? `Sent to ${esc(s.upi || 'your UPI ID')} · UTR ${esc(s.utr)}. Please confirm when it arrives.` : `Received · UTR ${esc(s.utr || '')}`}</div>
   ${s.st == 'Sent' ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="payoutOk" data-id="${o.id}" data-w="seller" data-ok="1">✅ Received</button><button class="btn d sm" data-act="payoutOk" data-id="${o.id}" data-w="seller" data-ok="0">Not received</button></div>` : ''}</div>`;
 }
 return '';
}
// The collector's transport-fee payout, shown on their pickup card.
function collPayBox(o) {
 upgradePay(o); const p = o.pay; if (!p || !p.v) return '';
 if (p.st != 'Paid') return `<div class="paybox"><b>🚚 Transport fee: ${fx(splitOf(o).coll)}</b><div class="mu sm-t">Paid to your UPI ID automatically once the buyer’s payment is confirmed.${me.upi ? '' : ' <a href="#" data-act="go" data-tab="acct">Add your UPI ID</a>.'}</div></div>`;
 const s = p.split.coll;
 return `<div class="paybox"><div class="row between"><b>🚚 Transport fee payout: ${fx(s.amt)}</b><span class="tag ${s.st == 'Received' ? '' : 'w'}">${s.st}</span></div><div class="mu sm-t">${s.st == 'Pending' ? 'Waste2Worth is sending it to your UPI ID.' : s.st == 'Sent' ? `Sent · UTR ${esc(s.utr)}. Please confirm when it arrives.` : 'Received.'}</div>
  ${s.st == 'Sent' ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="payoutOk" data-id="${o.id}" data-w="coll" data-ok="1">✅ Received</button><button class="btn d sm" data-act="payoutOk" data-id="${o.id}" data-w="coll" data-ok="0">Not received</button></div>` : ''}</div>`;
}
// Buyer reports their UPI payment.
function payUpi(id) {
 const o = Ord(id); if (!o || !o.pay || o.buyer != me.id) return;
 const utr = ($('#utr' + id)?.value || '').replace(/\s/g, '');
 if (!/^\d{12}$/.test(utr)) return toast('Enter the 12-digit UTR / reference number from your UPI app');
 Object.assign(o.pay, { st: 'Confirming', method: 'UPI', utr, repAt: Date.now() });
 const a = adminUser(); if (a) notify(a.id, `${me.name} paid ${fx(payTotal(o))} for order ${ordNo(o)} (UTR ${utr}). Please confirm in Payments.`);
 notify(o.seller, `${me.name} has paid for order ${ordNo(o)}. Your share will be sent once Waste2Worth confirms the payment.`);
 log(`${me.name} reported UPI payment for order ${ordNo(o)}`); save(); toast('Thanks! Waste2Worth will confirm your payment.'); render();
}
// Admin confirms the buyer's money arrived → the split is fixed and everyone is notified.
function adminConfirmPay(id, ok) {
 const o = Ord(id); if (!o || !o.pay || me.role != 'admin' || o.pay.st != 'Confirming') return;
 if (!ok) {
  if (!confirm('Mark as NOT received? The buyer will be asked to check and pay again.')) return;
  Object.assign(o.pay, { st: 'Awaiting payment', utr: null }); o.pay.fails = (o.pay.fails || 0) + 1;
  notify(o.buyer, `We have not received your payment for order ${ordNo(o)}. Please check the UTR and pay again.`);
  log(`Admin: payment not received for order ${ordNo(o)}`); save(); render(); return toast('The buyer has been asked to pay again');
 }
 const sp = splitOf(o), s = U(o.seller), c = o.coll ? U(o.coll) : null;
 Object.assign(o.pay, { st: 'Paid', paidAt: Date.now(), T: sp.T, net: sp.seller,
  split: { seller: { amt: sp.seller, st: 'Pending', upi: s.upi || '' }, coll: c ? { amt: sp.coll, st: 'Pending', upi: c.upi || '' } : null, admin: { amt: sp.admin } } });
 o.fpb = true; o.fpc = true; // platform fees are taken from this payment
 notify(o.buyer, `Payment of ${fx(sp.T)} for order ${ordNo(o)} confirmed. Thank you!`);
 notify(o.seller, `Order ${ordNo(o)} is paid! Your share: ${fx(sp.seller)} (value ${fx(sp.gross)} − pickup discount ${fx(sp.fee)} − transport ${fx(sp.transport)} − commission ${fx(sp.comm)}). It is being sent to your UPI ID.`);
 if (c) notify(c.id, `Order ${ordNo(o)} is paid! Your transport fee: ${fx(sp.coll)} (${fx(sp.transport)} − platform fee ${fx(sp.cf)}). It is being sent to your UPI ID.`);
 notify(me.id, `Platform fee for order ${ordNo(o)}: ${fx(sp.admin)}. Send the seller (${fx(sp.seller)})${c ? ` and collector (${fx(sp.coll)})` : ''} payouts in Payments.`);
 log(`Payment ${o.pay.ref} confirmed: seller ${fx(sp.seller)}, collector ${fx(sp.coll)}, platform ${fx(sp.admin)}`);
 save(); toast('Payment confirmed. Payouts are ready to send.'); render();
}
// Admin marks a payout as sent (after paying by UPI).
function payoutSent(id, who) {
 const o = Ord(id), s = o && o.pay && o.pay.split && o.pay.split[who]; if (!s || me.role != 'admin') return;
 const utr = ($(`#putr_${who}_${id}`)?.value || '').replace(/\s/g, '');
 if (!/^\d{12}$/.test(utr)) return toast('Enter the 12-digit UTR of the payout you sent');
 Object.assign(s, { st: 'Sent', utr, sentAt: Date.now() });
 const to = who == 'seller' ? o.seller : o.coll;
 notify(to, `💸 ${fx(s.amt)} sent to your UPI ID for order ${ordNo(o)} (UTR ${utr}). Please confirm when it arrives.`);
 log(`Admin sent ${who} payout ${fx(s.amt)} for order ${ordNo(o)}`); save(); toast('Payout marked as sent'); render();
}
// Seller or collector confirms their payout arrived.
function payoutOk(id, who, ok) {
 const o = Ord(id), s = o && o.pay && o.pay.split && o.pay.split[who]; if (!s || s.st != 'Sent') return;
 if ((who == 'seller' && o.seller != me.id) || (who == 'coll' && o.coll != me.id)) return;
 const a = adminUser();
 if (ok) { s.st = 'Received'; s.recAt = Date.now(); if (a) notify(a.id, `${me.name} received their payout of ${fx(s.amt)} for order ${ordNo(o)}.`); toast('Thanks for confirming') }
 else {
  if (!confirm('Report that this payout has NOT arrived?')) return;
  D.alerts.push({ id: uid('A'), k: Date.now(), txt: `Payout not received: ${me.name}, ${fx(s.amt)}, order ${ordNo(o)} (UTR ${s.utr})`, st: 'open' });
  if (a) notify(a.id, `${me.name} has NOT received their payout of ${fx(s.amt)} for order ${ordNo(o)}. Please check.`);
  s.st = 'Pending'; s.utr = null; toast('Reported to Waste2Worth');
 }
 log(`${me.name} ${ok ? 'confirmed' : 'disputed'} payout for order ${ordNo(o)}`); save(); render();
}
// Admin "Payments" page: confirm incoming payments, send payouts.
function adminPayments() {
 D.orders.forEach(upgradePay);
 const os = D.orders.filter(o => o.pay && o.pay.v && !isDemo(o.seller));
 const inc = os.filter(o => o.pay.st == 'Confirming'), wait = os.filter(o => o.pay.st == 'Awaiting payment');
 const outs = []; os.filter(o => o.pay.split).forEach(o => ['seller', 'coll'].forEach(w => { const s = o.pay.split[w]; if (s && s.st != 'Received') outs.push({ o, w, s }) }));
 const earned = os.filter(o => o.pay.split).reduce((t, o) => t + o.pay.split.admin.amt, 0);
 const outCard = ({ o, w, s }) => { const u = U(w == 'seller' ? o.seller : o.coll), upi = u.upi && UPI_RE.test(u.upi) ? u.upi : '';
  return `<div class="item" style="align-items:flex-start;flex-wrap:wrap"><div class="nm" style="min-width:220px"><b>${esc(u.name)}</b> <span class="tag n">${w == 'seller' ? 'Seller share' : 'Transport fee'}</span> <span class="tag ${s.st == 'Sent' ? 'i' : 'w'}">${s.st}</span><div class="mu xs">Order ${ordNo(o)} · ${upi ? 'UPI ' + esc(upi) : '<b style="color:#b26b00">no UPI ID yet</b>'}</div><div class="big" style="font-size:1.3rem">${fx(s.amt)}</div></div>
   ${s.st == 'Pending' ? (upi ? `<div class="upiqr sm" data-uri="${esc(upiLink(upi, u.name, s.amt, 'Waste2Worth payout ' + ordNo(o)))}"></div><div style="flex:1;min-width:200px"><a class="btn sm" href="${esc(upiLink(upi, u.name, s.amt, 'Waste2Worth payout ' + ordNo(o)))}">Pay ${fx(s.amt)} with UPI app</a>
     <label class="f" style="margin-top:8px">UTR of your payout<input id="putr_${w}_${o.id}" data-keep inputmode="numeric" maxlength="12" placeholder="12 digits"></label><button class="btn role sm w" data-act="payoutSent" data-id="${o.id}" data-w="${w}">Mark as sent</button></div>`
     : `<button class="btn s sm" data-act="remindUpi" data-id="${u.id}">Ask for UPI ID</button>`) : `<div class="mu sm-t">Sent · UTR ${esc(s.utr)} · waiting for them to confirm</div>`}</div>` };
 const a = adminUser();
 return `${a && a.upi ? '' : '<div class="note e">Add the Waste2Worth UPI ID in <a href="#" data-act="go" data-tab="acct">My account</a> — buyers pay to it.</div>'}
 <div class="cols"><div>
 <div class="card ${inc.length ? 'hl' : ''}"><h3>📥 Confirm incoming payments ${inc.length ? `<span class="tag w">${inc.length}</span>` : ''}</h3><p class="mu sm-t">Check your UPI / bank app for each UTR before confirming. Confirming splits the money automatically.</p>
  ${inc.map(o => { const sp = splitOf(o); return `<div class="item" style="flex-wrap:wrap"><div class="nm"><b>${fx(sp.T)}</b> from ${esc(U(o.buyer).name)} · order ${ordNo(o)}<div class="mu xs">UTR ${esc(o.pay.utr)} · split: seller ${fx(sp.seller)} · collector ${fx(sp.coll)} · platform ${fx(sp.admin)}</div></div><button class="btn role sm" data-act="adminConfirmPay" data-id="${o.id}" data-ok="1">✅ Received</button><button class="btn d sm" data-act="adminConfirmPay" data-id="${o.id}" data-ok="0">Not received</button></div>` }).join('') || '<p class="mu">Nothing to confirm.</p>'}</div>
 <div class="card ${outs.some(x => x.s.st == 'Pending') ? 'hl' : ''}"><h3>💸 Payouts to send</h3>${outs.map(outCard).join('') || '<p class="mu">All payouts are done. 🎉</p>'}</div></div>
 <div><div class="card"><h3>📊 Platform earnings</h3><div class="big cu">${fx(earned)}</div><div class="mu sm-t">Your fees from ${os.filter(o => o.pay.split).length} paid orders</div></div>
 <div class="card"><h3>⏳ Waiting for buyers to pay</h3>${wait.map(o => `<div class="item"><div class="nm">${esc(U(o.buyer).name)} · order ${ordNo(o)}</div><b>${fx(payTotal(o))}</b></div>`).join('') || '<p class="mu">None.</p>'}</div></div></div>`;
}
// Draw UPI QR codes (qrcodejs) into any .upiqr placeholders on the page.
function drawQrs(root) {
 if (typeof QRCode == 'undefined') return;
 (root || document).querySelectorAll('.upiqr[data-uri]').forEach(el => {
  if (el.dataset.done == el.dataset.uri) return; el.innerHTML = '';
  new QRCode(el, { text: el.dataset.uri, width: 148, height: 148, correctLevel: QRCode.CorrectLevel.M }); el.dataset.done = el.dataset.uri;
 });
}

function timeline(o) { return `<div class="tl" aria-label="Order progress: ${STEPS[o.step]}">${STEPS.map((s, i) => `<div class="st ${i <= o.step ? 'dn' : ''} ${i == o.step ? 'cur' : ''}"><i>${i <= o.step ? '✓' : i + 1}</i>${s}</div>`).join('')}</div>` }
function chatBox(o) {
 const ms = o.msgs || [];
 return `<div class="chatbox"><div class="mu sm-t" style="font-weight:700;margin-bottom:4px">💬 Messages</div>${ms.slice(-4).map(m => `<div class="msg"><b>${esc(m.n)}</b> <span class="t">· ${when(m.t)}</span><br>${esc(m.x)}</div>`).join('') || '<div class="mu sm-t">No messages yet.</div>'}
 <div class="row" style="margin-top:8px"><input id="cm${o.id}" data-keep data-enter="sendMsg" data-id="${o.id}" placeholder="Message about this order" maxlength="300"><button class="btn s sm" data-act="sendMsg" data-id="${o.id}">Send</button></div></div>`;
}
// One-time handover codes. Seller: pickup code. Buyer: delivery code.
// A fresh random code is made by the server for every pickup and every delivery.
function otpBox(o, kind = 'pickup') {
 const pick = kind == 'pickup', rid = pick ? o.id : o.id + ':d', cn = o.coll ? esc(U(o.coll).name) : 'the collector';
 const title = pick ? `Your PICKUP code — give it only to ${cn}, in person, when they collect your waste`
  : `Your DELIVERY code — give it only to ${cn}, in person, when they deliver the waste to you${o.otpOk ? '' : ' (not before)'}`;
 const box = (body, btn = '') => `<div class="otp"><span style="font-size:26px">${pick ? '🔐' : '📦'}</span><div style="flex:1"><div class="mu sm-t">${title}</div>${body}</div>${btn}</div>`;
 if (pick && isDemo(o.seller)) return box(`<b>${o.otp || '----'}</b>`);
 if (!o.coll) return box(`<div class="sm-t">Your code will be created as soon as a collector accepts this pickup.</div>`);
 const t = OTPS[rid], btn = (cls, txt) => `<button class="btn ${cls} sm" data-act="newOtp" data-id="${o.id}" data-kind="${kind}">${txt}</button>`;
 if (!t) return box('<div class="sm-t">No active code.</div>', btn('', 'Create code'));
 if ((t.tries || 0) >= 5) return box('<div class="sm-t" style="color:var(--danger,#c0392b)">Locked after 5 wrong tries. Create a new code.</div>', btn('s', '🔄 New code'));
 return box(`<b>${esc(t.code)}</b>${t.tries ? `<div class="mu xs">${t.tries} wrong ${t.tries == 1 ? 'try' : 'tries'} by the collector</div>` : ''}`, btn('s', '🔄 New code'));
}
function orderBox(o, role) {
 const l = Lst(o.l), b = Bd(o.b); if (!l || !b) return '<div class="note e">Order details are missing.</div>';
 const other = role == 'buyer' ? 'Seller ' + esc(U(o.seller).name) : 'Buyer ' + esc(U(o.buyer).name);
 let h = `<div class="obox"><div class="row between"><div><b>Order #${o.id.slice(-6).toUpperCase()}</b> <span class="mu">· ${other} · est. net ${fx(net(l, b))}</span></div>${o.pay ? `<span class="tag ${o.pay.st == 'Paid' ? '' : 'w'}">Payment ${o.pay.st}</span>` : ''}</div>
  ${o.step < 6 ? `<div style="margin-top:10px">${pickupDetails(l, o, false)}</div>` : ''}
  ${o.step <= 1 && !o.coll ? `<div class="note i" style="margin-top:10px">🔎 Sent to our approved collectors. You’ll be notified as soon as one accepts the pickup.</div>` : ''}${orderMap(o)}${timeline(o)}${role == 'buyer' || role == 'seller' ? payBox(o, role) : ''}`;
 if (role == 'seller' && o.step < 5 && !o.otpOk) h += otpBox(o, 'pickup');
 if (role == 'buyer' && o.coll && o.step < 6 && !o.dlvOk && !isDemo(o.seller)) h += otpBox(o, 'delivery');
 if (o.appr == 'pending') h += role == 'seller'
  ? `<div class="note">Verified quantity differs by more than 15% from your estimate. Revised value: <b>${fx(o.val)}</b>.<div class="row" style="margin-top:8px"><button class="btn sm" data-act="approve" data-id="${o.id}" data-ok="1">Approve</button><button class="btn d sm" data-act="approve" data-id="${o.id}" data-ok="0">Dispute</button></div></div>`
  : `<div class="note">Waiting for the seller to approve the revised value of ${fx(o.val)}.</div>`;
 if (o.disp) h += `<span class="tag e">Dispute ${o.disp}</span>`;
 if (o.proof && role != 'collector') h += `<details style="margin-top:8px"><summary class="mu sm-t">📸 Pickup proof photo</summary><img class="thumb" src="${esc(o.proof)}" alt="Proof photo from pickup"></details>`;
 return h + chatBox(o) + '</div>';
}
function receipt(o, role) {
 const p = o.pay;
 return `<div class="card"><div class="row between"><b>🧾 Receipt ${p.ref}</b><span class="tag ${p.st == 'Paid' ? '' : 'w'}">${p.st}</span></div>
 <div class="tw" style="margin:12px 0"><table><tr><th>Material</th><th class="num">Verified qty</th><th class="num">Rate</th><th class="num">Value</th></tr>${o.wts.map(w => `<tr><td>${icon(w.m)} ${esc(w.m)}</td><td class="num">${qtyOf(w)} ${unitOf(w)}</td><td class="num">₹${w.rate}/${unitOf(w)}</td><td class="num">${fx(qtyOf(w) * w.rate)}</td></tr>`).join('')}</table></div>
 ${p.v ? (() => { const sp = splitOf(o), so = p.split && p.split.seller; return `<p class="mu sm-t" style="margin:0">Value ${fx(sp.gross)} − pickup discount ${fx(sp.fee)} − transport (collector) ${fx(sp.transport)} − platform commission 5% ${fx(sp.comm)}</p><div class="big" style="font-size:1.6rem">Your share ${fx(so ? so.amt : sp.seller)}</div><p class="mu xs" style="margin:2px 0 0">${so ? `Payout: ${payoutLine(o, 'seller')}` : p.st == 'Paid' ? '' : 'Waiting for the buyer’s payment'}</p>` })()
  : `<p class="mu sm-t" style="margin:0">Gross ${fx(p.gross)} − pickup fee ${fx(p.fee)} − platform commission 5% ${fx(p.comm)}</p><div class="big" style="font-size:1.6rem">Net ${fx(p.net)}</div>`}
 <p class="mu xs">Order #${o.id.slice(-6).toUpperCase()} · ${esc(U(role == 'seller' ? o.buyer : o.seller).name)} · ${when(p.t)}</p>
 ${role == 'seller' && p.st == 'Paid' && !o.rated ? `<div class="row mu sm-t">Rate this buyer: ${[1, 2, 3, 4, 5].map(n => `<button class="btn s xs" data-act="rate" data-id="${o.id}" data-n="${n}">${n}★</button>`).join('')}</div>` : o.rated ? `<span class="tag n">You rated ${o.rated}★</span>` : ''}</div>`;
}
