// =========================================================
// Waste2Worth — admin pages: Overview, Alerts, Users, Audit + demo data
// =========================================================
const AR = { m: MATS[0].m, u: MATS[0].u };
let userFilter = 'all';

function adminHome() {
 const C = D.orders.filter(o => o.pay && o.wts), kg = C.reduce((s, o) => s + kgOfOrder(o), 0);
 const bl = D.listings.filter(l => D.bids.some(b => b.l == l.id));
 const lift = bl.map(l => { const bs = D.bids.filter(b => b.l == l.id); return Math.max(...bs.map(b => net(l, b))) - net(l, bs[0]) });
 const pend = D.users.filter(needsApproval);
 return `<div class="cols"><div>
 <div class="card ${pend.length ? 'hl' : ''}"><h3>✅ Account approvals${pend.length ? ` <span class="tag w">${pend.length} waiting</span>` : ''}</h3><p class="mu sm-t">New buyers cannot bid, and new collectors cannot accept pickups, until you approve them.</p>
  ${pend.map(b => `<div class="item">${avatar(b)}<div class="nm"><b>${esc(b.name)}</b> <span class="tag n">${b.role == 'buyer' ? '🏪 Buyer' : '🚚 Collector'}</span><div class="mu xs">${esc(b.type || cap(b.role))} · ${esc(b.area || 'No address')} · ${esc(b.email)} · applied ${when(b.k)}</div></div><button class="btn role sm" data-act="verifyBuyer" data-id="${b.id}">Approve</button><button class="btn d sm" data-act="rejectBuyer" data-id="${b.id}">Reject</button></div>`).join('') || '<p class="mu">No buyers or collectors waiting for approval.</p>'}</div>
 ${feeCard()}
 <div class="card"><h3>📈 Marketplace</h3><div class="row"><span class="tag r">GMV ${fx0(C.reduce((a, o) => a + o.pay.gross, 0))}</span><span class="tag r">${D.listings.length} listings</span><span class="tag r">${D.bids.length} bids</span><span class="tag r">${D.listings.length ? (D.bids.length / D.listings.length).toFixed(1) : 0} bids per listing</span><span class="tag r">${r1(kg)} kg verified</span><span class="tag r">Best vs first offer: +${fx0(lift.length ? lift.reduce((a, b) => a + b, 0) / lift.length : 0)}</span></div></div>
 ${matChart()}${impactCard(C)}</div>
 <div>${demoCard()}${rateEditor()}
 <div class="card"><h3>👥 Users</h3><div class="row">${['seller', 'buyer', 'collector'].map(r => `<span class="tag r">${D.users.filter(u => u.role == r).length} ${r}s</span>`).join('')}</div></div>${leaderboard()}</div></div>`;
}
function feeCard() {
 const C = D.orders.filter(o => o.pay && o.wts), sum = (f, p) => C.filter(f).reduce((s, o) => s + p(o), 0);
 const sc = C.reduce((s, o) => s + o.pay.comm, 0), bc = sum(o => o.fpb, bFee), bp = sum(o => !o.fpb, bFee), cc = sum(o => o.coll && o.fpc, cFee), cp = sum(o => o.coll && !o.fpc, cFee);
 const own = u => u.role == 'buyer' ? C.filter(o => o.buyer == u.id && !o.fpb).reduce((s, o) => s + bFee(o), 0) : C.filter(o => o.coll == u.id && !o.fpc).reduce((s, o) => s + cFee(o), 0);
 const dues = D.users.filter(u => (u.role == 'buyer' || u.role == 'collector') && !isDemo(u.id)).map(u => ({ u, d: own(u) })).filter(x => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 8);
 return `<div class="card"><h3>💸 Platform revenue</h3><div class="big cu">${fx0(sc + bc + cc)}</div><div class="mu sm-t" style="margin-bottom:10px">Total revenue received</div>
 <div class="row"><span class="tag">Seller commission ${fx0(sc)}</span><span class="tag">Buyer fees ${fx0(bc)}</span><span class="tag">Collector fees ${fx0(cc)}</span><span class="tag w">Pending buyers ${fx0(bp)}</span><span class="tag w">Pending collectors ${fx0(cp)}</span></div>
 ${dues.length ? '<h4 style="margin-top:16px">Outstanding dues</h4>' + dues.map(x => `<div class="item"><div class="nm"><b>${esc(x.u.name)}</b> <span class="tag n">${x.u.role}</span></div><b>${fx0(x.d)}</b><button class="btn s xs" data-act="remind" data-id="${x.u.id}">Remind</button></div>`).join('') : ''}</div>`;
}
function matChart() {
 const t = {}; D.orders.filter(o => o.pay && o.wts).forEach(o => o.wts.forEach(w => t[w.m] = (t[w.m] || 0) + kgOfItem(w)));
 const e = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 10); if (!e.length) return ''; const mx = e[0][1];
 return `<div class="card"><h3>♻️ Material mix collected</h3>${e.map(([m, v]) => `<div class="bar"><span class="mu">${icon(m)} ${esc(m)}</span><div class="pg"><i style="width:${v / mx * 100}%"></i></div><b>${r1(v)} kg</b></div>`).join('')}</div>`;
}
function rateEditor() {
 const p = rangeFor(AR.m, AR.u);
 return `<div class="card"><h3>🏷 Indicative material rates</h3><p class="mu sm-t">Reference prices shown to everyone. Not live prices.</p>
 <label class="f">Material<select data-chg="arMat">${optionsFor(AR.m)}</select></label>
 <div class="grid2"><label class="f">Unit<select data-chg="arUnit">${unitsOf(AR.m).map(x => `<option ${x == AR.u ? 'selected' : ''}>${x}</option>`).join('')}</select></label><span></span>
 <label class="f">Minimum ₹/${AR.u}<input id="armin" type="number" min="0" step=".01" value="${p ? p.min : ''}"></label><label class="f">Maximum ₹/${AR.u}<input id="armax" type="number" min="0" step=".01" value="${p ? p.max : ''}"></label></div>
 <button class="btn role w" data-act="saveRate">Save rate</button><p class="mu xs" style="margin:8px 0 0">${p ? `${esc(p.src)} · updated ${priceDate(p.upd)}` : 'No reference price — buyers quote'}</p></div>`;
}
function saveRate() {
 const a = $('#armin').value, b = $('#armax').value, id = AR.m + '::' + AR.u;
 if (!a && !b) { D.rates = D.rates.filter(x => x.id != id); save(); render(); return toast('Reference rate reset to default') }
 const min = +a, max = +b; if (!isFinite(min) || !isFinite(max) || min < 0 || max < min) return toast('Enter a valid minimum and maximum');
 const rec = { id, k: Date.now(), m: AR.m, unit: AR.u, min, max }, n = D.rates.findIndex(x => x.id == id);
 if (n < 0) D.rates.push(rec); else D.rates[n] = rec;
 log(`Admin updated reference rate for ${AR.m} per ${AR.u}`); save(); toast('Reference rate updated'); render();
}
function demoCard() {
 const has = D.users.some(u => isDemo(u.id));
 return `<div class="card ${has ? '' : 'hl'}"><h3>🧪 Demo marketplace</h3>${has
  ? `<p class="mu sm-t">Demo data is loaded: 20 sample people with listings, live bids, pickups and completed orders. Two demo buyers auto-bid on new listings anywhere, so you can test selling on your own.</p><button class="btn d w" data-act="clearDemo">Remove demo data</button>`
  : `<p class="mu sm-t">Fill the marketplace with 8 sellers, 7 verified buyers and 5 collectors in Tirupati, plus about 40 listings at every stage. Demo people can’t log in; they make the site look and feel busy.</p><button class="btn role w" data-act="seedDemo">Load demo data</button>`}</div>`;
}
// Buyers and collectors must be approved by the admin before they can work.
const needsApproval = u => (u.role == 'buyer' || u.role == 'collector') && !u.ok && !u.sus && !isDemo(u.id);
function verifyBuyer(id) {
 const b = U(id); if (!b.id) return; b.ok = true; b.sus = false;
 if (b.role == 'buyer') { autoAll(b); notify(id, 'Your business is approved. You can now bid on listings.') }
 else notify(id, 'Your collector account is approved. You can now accept pickups near you.');
 log(`Admin approved ${b.role} ${b.name}`); save(); toast(b.name + ' approved'); render();
}
function rejectBuyer(id) {
 const b = U(id); if (!b.id || !confirm(`Reject ${b.name}? They will not be able to use this ${b.role} account.`)) return;
 b.ok = false; b.sus = true; notify(id, `Your ${b.role} application was not approved. Please contact support for details.`);
 log(`Admin rejected ${b.role} ${b.name}`); save(); toast(b.name + ' rejected'); render();
}
function remind(id) { notify(id, 'Reminder: you have platform fees due. Please pay from your dashboard.'); save(); toast('Reminder sent') }

function adminAlerts() {
 const al = D.alerts.slice().reverse(), ds = D.orders.filter(o => o.disp);
 return `<div class="cols"><div class="card"><h3>🚨 Fraud and anomaly alerts</h3>${al.map(a => `<div class="item"><span class="tag ${a.st == 'open' ? 'e' : 'n'}">${a.st}</span><div class="nm">${esc(a.txt)}<div class="mu xs">${when(a.k)}</div></div>${a.st == 'open' ? `<button class="btn s xs" data-act="resA" data-id="${a.id}">Reviewed</button>` : ''}</div>`).join('') || '<p class="mu">No alerts. 🎉</p>'}</div>
 <div class="card"><h3>⚖️ Disputes</h3>${ds.map(o => `<div class="item"><div class="nm"><b>Order #${o.id.slice(-6).toUpperCase()}</b> · ${o.disp}<div class="mu xs">${esc(U(o.seller).name)} ↔ ${esc(U(o.buyer).name)} · revised ${fx(o.val)}</div></div>${o.disp == 'open' ? `<button class="btn role xs" data-act="resD" data-id="${o.id}">Accept collector weight</button>` : ''}</div>`).join('') || '<p class="mu">No disputes.</p>'}</div></div>`;
}
function resA(id) { const a = D.alerts.find(x => x.id == id); if (a) { a.st = 'reviewed'; log('Alert reviewed'); save(); render() } }
function resD(id) { const o = Ord(id); if (!o) return; o.disp = 'resolved'; o.appr = 'ok'; notify(o.seller, 'Admin resolved your dispute using the collector’s verified weight.'); if (o.coll) notify(o.coll, 'Dispute resolved. Verify the pickup code to continue.'); log('Admin resolved a dispute'); save(); render() }

function adminUsers() {
 const us = D.users.filter(u => userFilter == 'all' || u.role == userFilter).slice().reverse();
 return `<div class="card"><div class="chips">${['all', 'seller', 'buyer', 'collector', 'admin'].map(r => `<button class="${userFilter == r ? 'on' : ''}" data-act="ufilt" data-r="${r}">${r == 'all' ? 'All' : cap(r) + 's'}</button>`).join('')}</div>
 ${us.map(u => `<div class="item">${avatar(u)}<div class="nm"><b>${esc(u.name)}</b> <span class="tag n">${u.role}</span>${u.sus ? '<span class="tag e">suspended</span>' : ''}${needsApproval(u) ? '<span class="tag w">awaiting approval</span>' : ''}${isDemo(u.id) ? '<span class="tag i">demo</span>' : ''}<div class="mu xs">${esc(u.email)} · ${esc(u.area || '')} · joined ${when(u.k)}</div></div>${needsApproval(u) ? `<button class="btn role xs" data-act="verifyBuyer" data-id="${u.id}">Approve</button>` : ''}${u.role == 'admin' || isDemo(u.id) ? '' : `<button class="btn ${u.sus ? 's' : 'd'} xs" data-act="toggleSus" data-id="${u.id}">${u.sus ? 'Reactivate' : 'Suspend'}</button>`}</div>`).join('') || '<p class="mu">No users.</p>'}</div>`;
}
function toggleSus(id) { const u = U(id); if (!u.id) return; u.sus = !u.sus; log(`Admin ${u.sus ? 'suspended' : 'reactivated'} ${u.name}`); notify(id, u.sus ? 'Your account has been suspended. Please contact support.' : 'Your account has been reactivated.'); save(); render() }
function adminAudit() {
 const a = D.audit.slice().reverse();
 return `<div class="card"><div class="row between" style="margin-bottom:12px"><h3 style="margin:0">🧾 Audit trail</h3><button class="btn s xs" data-act="csv" data-k="audit">⬇ CSV</button></div>${a.length ? `<div class="tw" style="max-height:620px"><table><tr><th>Time</th><th>Event</th></tr>${a.slice(0, 150).map(x => `<tr><td>${when(x.k)}</td><td style="white-space:normal">${esc(x.m)}</td></tr>`).join('')}</table></div>` : '<p class="mu">Nothing recorded yet.</p>'}</div>`;
}

// ---------- demo data ----------
function seedDemo() {
 if (D.users.some(u => isDemo(u.id))) return toast('Demo data is already loaded');
 let r = 11; const R = () => (r = (r * 16807) % 2147483647) / 2147483647, t0 = Date.now();
 const A = ['Gandhi Road, Tirupati', 'Korlagunta, Tirupati', 'Leelamahal, Tirupati', 'Balaji Colony, Tirupati', 'Mangalam, Tirupati', 'Alipiri, Tirupati', 'Tiruchanur, Tirupati', 'Renigunta Road, Tirupati'];
 let n = 0; const mk = (role, i, name, type, area, x) => { const u = { id: `demo-${role}-${i}`, k: t0 - 9e7 + (n++), role, name, email: `${role}${i}@demo.local`, type, area, ...x }; D.users.push(u); return u };
 const SN = [['Ravi Teja', 'Hostel / Campus'], ['Manjusha A', 'Household'], ['Usha Sri', 'Apartment / Society'], ['Siri Chandana', 'Shop / Business'], ['Subba Reddy', 'Office'], ['Arun Kumar', 'Household'], ['Lakshmi Devi', 'Household'], ['Venkatesh N', 'Industry / Factory']];
 const BN = [['Sri Balaji Scrap Traders', 'Scrap dealer'], ['Green Loop Recyclers', 'Recycler'], ['Raju Kabadiwala', 'Local kabadiwala'], ['EcoCycle Aggregators', 'Aggregator'], ['Tirumala Metals', 'Scrap dealer'], ['Fresh Start Paper Mill', 'Recycler'], ['Annapurna Kabadi', 'Local kabadiwala']];
 const CN = [['Mahesh Kumar', 'Bike'], ['Suresh Babu', 'Auto / Tempo'], ['Imran Khan', 'Mini truck'], ['Narayana Rao', 'Bike'], ['Deepak Yadav', 'On foot / cycle']];
 const BUYS = MATS.filter(d => d.u == 'kg' && ['Paper', 'Plastic', 'Metals', 'Glass', 'E-waste', 'Textiles'].includes(d.c)).map(d => d.m);
 const S = SN.map((s, i) => mk('seller', i + 1, s[0], s[1], A[i], {}));
 const B = BN.map((b, i) => { const rates = {}; BUYS.forEach(m => { if (i % 2 == 1 || R() > .35) rates[m] = r1(mid(m) * (.85 + R() * .3)) }); const rn = 5 + Math.floor(R() * 20);
  return mk('buyer', i + 1, b[0], b[1], A[(i * 3) % 8], { ok: true, rn, rsum: rn * (3.8 + R()), rates, rateUnits: {}, fee: [0, 20, 30, 50][i % 4], minKg: 0, svc: i == 1 || i == 3 ? '*' : 'Tirupati', auto: i == 1 || i == 3 }) });
 const C = CN.map((c, i) => mk('collector', i + 1, c[0], c[1], A[(i * 2) % 8], { ok: true }));
 const P = [[['Cardboard', 14], ['Newspaper', 8]], [['Aluminium cans', 6], ['PET bottles', 9]], [['Iron scrap', 25]], [['Cardboard', 30], ['PET bottles', 12]], [['Office paper', 22]], [['Clear glass bottles', 30], ['Cardboard', 6]], [['Aluminium scrap', 8]], [['Iron scrap', 60], ['Cardboard', 20]], [['Books and notebooks', 35], ['Cardboard', 18]], [['Mixed plastic', 40]], [['Copper scrap', 3], ['Brass', 4]], [['Mixed e-waste', 14]], [['Mixed textile waste', 25], ['Newspaper', 10]], [['Rubber scrap', 40]], [['Steel scrap', 25], ['Stainless steel', 12]], [['HDPE plastic', 22], ['PET bottles', 15]], [['Copper wire', 4], ['Cables and chargers', 6]], [['Corrugated cardboard', 55]], [['Tin scrap', 10], ['Metal cans', 8]], [['Cotton textile waste', 18]]];
 const plan = [...Array(12).fill(6), ...Array(6).fill(1), ...Array(3).fill(2), ...Array(2).fill(3), ...Array(17).fill(0)];
 plan.forEach((st, x) => {
  const s = S[x % 8], items = P[(x * 7) % P.length].map(([m, q]) => ({ m, unit: 'kg', qty: Math.max(1, Math.round(q * (.7 + R() * .7))), conf: 75 + Math.floor(R() * 22) }));
  const k = st == 0 ? t0 - Math.floor(R() * 20) * 36e5 : t0 - (40 - x) * 864e5 * .4;
  const l = { id: `demo-L${x}`, k, seller: s.id, type: s.type, area: s.area, items, status: st == 0 ? 'open' : st == 6 ? 'completed' : 'accepted', end: st == 0 ? t0 + (3 + Math.floor(R() * 45)) * 36e5 : k + 864e5 };
  D.listings.push(l);
  B.forEach(b => { const q = quoteFor(b, l); if (q && (st > 0 || R() > .25)) D.bids.push({ id: `demo-D${x}-${b.id.slice(-1)}`, k: k + 1, l: l.id, b: b.id, rates: q.rates, fee: q.fee, auto: !!b.auto }) });
  if (st == 0) return;
  const bid = ranked(l)[0]; if (!bid) { l.status = 'open'; return }
  const o = { id: `demo-O${x}`, k: k + 2, l: l.id, b: bid.id, buyer: bid.b, seller: s.id, step: st, otp: String(1000 + Math.floor(R() * 9000)), pay: null, hist: [{ t: k + 2, s: STEPS[0] }], coll: null, slot: slots()[x % 6], wts: null, appr: null, disp: null, msgs: [] };
  if (st >= 2) o.coll = C[x % 5].id; if (st == 3) o.t3 = t0 - 25e3;
  if (st == 6) { o.wts = l.items.map(i => ({ m: i.m, unit: 'kg', qty: r1(i.qty * (.92 + R() * .14)), rate: bid.rates[i.m] || 0 })); const g = o.wts.reduce((a, w) => a + w.qty * w.rate, 0), cm = Math.round(g * COMM * 100) / 100;
   o.pay = { st: 'Paid', gross: g, fee: bid.fee, comm: cm, net: g - bid.fee - cm, ref: 'WA' + (100000000 + x * 7919), t: k + 864e5 }; o.rated = 4 + (x % 2); o.fpb = x % 3 != 0; o.fpc = x % 2 == 0 }
  D.orders.push(o);
 });
 log('Admin loaded demo data (20 people, 40 listings)'); save(); toast('Demo marketplace ready'); render();
}
function clearDemo() {
 if (!confirm('Remove all demo people, listings, bids and orders?')) return;
 const ids = new Set(D.users.filter(u => isDemo(u.id)).map(u => u.id));
 const ls = new Set(D.listings.filter(l => ids.has(l.seller)).map(l => l.id));
 D.users = D.users.filter(u => !ids.has(u.id));
 D.listings = D.listings.filter(l => !ls.has(l.id));
 D.bids = D.bids.filter(b => !ls.has(b.l) && !ids.has(b.b));
 const goneO = new Set(D.orders.filter(o => ls.has(o.l) || ids.has(o.buyer) || ids.has(o.seller)).map(o => o.l));
 D.orders = D.orders.filter(o => !(ls.has(o.l) || ids.has(o.buyer) || ids.has(o.seller)));
 D.orders.forEach(o => { if (ids.has(o.coll) && o.step < 6) { o.coll = null; o.step = 1 } });
 D.listings.forEach(l => { if (goneO.has(l.id) && l.status == 'accepted') l.status = 'open' });
 log('Admin removed demo data'); save(); toast('Demo data removed'); render();
}
