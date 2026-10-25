// =========================================================
// Waste2Worth — buyer pages: Marketplace, Orders, My business
// =========================================================
const MF = { cat: 'All', mat: 'All', q: '', qmin: '', pmin: '', pmax: '', sort: 'new' };
const OPEN_GRPS = new Set(['Paper']);

function market() {
 let h = '';
 if (!Object.keys(me.rates || {}).length) h += `<div class="card soft"><div class="row between"><div><b>⚡ Set your prices once</b><p class="mu sm-t" style="margin:2px 0 0">Add a rate card, then bid on any listing in one tap or turn on auto-bid.</p></div><button class="btn role sm" data-act="go" data-tab="biz">Set my rates</button></div></div>`;
 if (!me.ok) h += `<div class="note">⏳ <b>Approval pending.</b> Our team is reviewing your business. You can browse listings now and start bidding as soon as you are approved.</div>`;
 const minQ = +MF.qmin || 0, minP = +MF.pmin || 0, maxP = MF.pmax === '' ? Infinity : +MF.pmax, q = MF.q.trim().toLowerCase();
 let ls = D.listings.filter(l => l.status == 'open' && !closed(l) && l.seller != me.id
  && (MF.cat == 'All' || l.items.some(i => MAT[i.m]?.c == MF.cat)) && (MF.mat == 'All' || l.items.some(i => i.m == MF.mat))
  && (!q || (l.area + ' ' + l.type + ' ' + l.items.map(i => i.m).join(' ')).toLowerCase().includes(q))
  && totKg(l) >= minQ && listingRef(l) >= minP && listingRef(l) <= maxP).reverse();
 if (MF.sort == 'near') ls.sort((a, b) => prox(me, b)[1] - prox(me, a)[1]);
 if (MF.sort == 'end') ls.sort((a, b) => (a.end || 9e15) - (b.end || 9e15));
 if (MF.sort == 'big') ls.sort((a, b) => totKg(b) - totKg(a));
 if (MF.sort == 'value') ls.sort((a, b) => listingRef(b) - listingRef(a));
 h += `<div class="card"><div class="filt">
  <label class="f">Category<select data-chg="mf" data-k="cat"><option>All</option>${CATS.map(c => `<option ${MF.cat == c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
  <label class="f">Material<select data-chg="mf" data-k="mat"><option>All</option>${MATS.filter(d => MF.cat == 'All' || d.c == MF.cat).map(d => `<option ${MF.mat == d.m ? 'selected' : ''}>${esc(d.m)}</option>`).join('')}</select></label>
  <label class="f">Search area or material<input id="mfq" type="search" value="${esc(MF.q)}" data-inp="mf" data-k="q" placeholder="e.g. Tirupati, copper"></label>
  <label class="f">Min quantity (kg)<input id="mfqmin" type="number" min="0" value="${esc(MF.qmin)}" data-inp="mf" data-k="qmin"></label>
  <label class="f">Min value ₹<input id="mfpmin" type="number" min="0" value="${esc(MF.pmin)}" data-inp="mf" data-k="pmin"></label>
  <label class="f">Max value ₹<input id="mfpmax" type="number" min="0" value="${esc(MF.pmax)}" data-inp="mf" data-k="pmax"></label>
  <label class="f">Sort<select data-chg="mf" data-k="sort">${[['new', 'Newest'], ['end', 'Closing soon'], ['near', 'Nearest'], ['big', 'Largest kg'], ['value', 'Highest value']].map(([k, t]) => `<option value="${k}" ${MF.sort == k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
 </div></div><div class="fbar"><b>${ls.length} open listing${ls.length == 1 ? '' : 's'}</b>${MF.cat != 'All' || MF.mat != 'All' || q || minQ || minP || MF.pmax !== '' ? '<button class="btn ghost sm" data-act="mfReset">Clear filters</button>' : ''}</div>`;
 if (!ls.length) return h + empty('🔎', 'No listings match', '<p>New listings from sellers appear here instantly.</p>');
 return h + `<div class="lgrid">${ls.map(listingCard).join('')}</div>`;
}
function listingCard(l) {
 const mine = D.bids.find(b => b.l == l.id && b.b == me.id), q = quoteFor(me, l), p = prox(me, l), ref = listingRef(l), nb = D.bids.filter(b => b.l == l.id).length;
 const soon = l.end && l.end - Date.now() < 3 * 36e5;
 const near = D.listings.some(x => x.id != l.id && x.status == 'open' && loc(x.area).l && loc(x.area).l == loc(l.area).l && loc(x.area).c == loc(l.area).c);
 const dis = me.ok ? '' : 'disabled title="Available once your business is approved"';
 return `<div class="card lc"><div class="ph">${l.photo ? `<img src="${esc(l.photo)}" alt="Photo of the waste in ${esc(l.area)}" class="zoom" data-act="viewPhoto" data-src="${esc(l.photo)}" title="Tap to enlarge">` : iconsOf(l)}<div class="badges"><span class="tag ${soon ? 'w' : ''}">⏱ ${leftTxt(l)}</span><span class="tag">${nb} bid${nb == 1 ? '' : 's'}</span>${p[1] >= .6 ? `<span class="tag">📍 ${p[0]}</span>` : ''}</div></div>
 <div class="bd"><h4>${esc(l.area)}</h4><div class="mu sm-t">${esc(l.type || 'Seller')} · ${sizeTxt(l)} est.</div><div style="margin:8px 0">${tags(l)}</div>
 ${near ? '<div><span class="tag i">🤝 Shared pickup possible nearby</span></div>' : ''}
 <div class="val"><div><small>Reference value</small><b>${fx0(ref)}</b></div>${mine ? `<div style="text-align:right"><small>Your offer to seller</small><b style="color:var(--role)">${fx0(net(l, mine))}</b></div>` : q ? `<div style="text-align:right"><small>With your rate card</small><b>${fx0(net(l, q))}</b></div>` : ''}</div>
 <div class="row acts">${mine ? `<button class="btn role sm" data-act="openBid" data-id="${l.id}" ${dis}>Edit bid${mine.auto ? ' (auto)' : ''}</button><button class="btn d sm" data-act="withdraw" data-id="${mine.id}">Withdraw</button>`
  : q ? `<button class="btn role sm" data-act="quick" data-id="${l.id}" ${dis}>⚡ Bid with my rates</button><button class="btn s sm" data-act="openBid" data-id="${l.id}" ${dis}>Custom bid</button>`
  : `<button class="btn role sm" data-act="openBid" data-id="${l.id}" ${dis}>Place a bid</button>`}</div></div></div>`;
}
function openBid(id) {
 const l = Lst(id); if (!l) return; const b = D.bids.find(x => x.l == id && x.b == me.id);
 openModal(`<h3 id="mh">Your bid · ${esc(l.area)}</h3><p class="mu sm-t">${sizeTxt(l)} · ${leftTxt(l)} · ${D.bids.filter(x => x.l == id).length} bids so far</p>
 ${l.photo ? `<img class="bidpic" src="${esc(l.photo)}" alt="Photo of the waste in ${esc(l.area)}">` : ''}
 ${l.items.map(i => { const u = unitOf(i), mine = (me.rateUnits || {})[i.m] || unitFor(i.m), rate = b ? b.rates[i.m] : ((me.rates || {})[i.m] && mine == u ? me.rates[i.m] : mid(i.m, u));
  return `<div class="item"><span class="ic">${icon(i.m)}</span><div class="nm"><b>${esc(i.m)}</b><div class="mu xs">${qtyOf(i)} ${u} · reference ${fmtRate(i.m, u)}</div></div><label class="xs mu" style="width:130px">₹ per ${u}<input type="number" min="0" step=".1" class="br" data-m="${esc(i.m)}" value="${rate || ''}" data-inp="bidprev"></label></div>` }).join('')}
 <label class="f" style="margin-top:12px">Pickup fee charged to the seller (₹)<input type="number" min="0" id="bfee" value="${b ? b.fee : (me.fee || 0)}" data-inp="bidprev"></label>
 <div class="estbox" id="bpv"></div><div class="row"><button class="btn role" data-act="placeBid" data-id="${id}">${b ? 'Update bid' : 'Submit bid'}</button><button class="btn s" data-act="closeModal">Cancel</button></div>`);
 bidPrev(id);
}
function bidRates() { const r = {}; $$('#ov .br').forEach(i => r[i.dataset.m] = +i.value || 0); return r }
function bidPrev(id) {
 const l = Lst(id || $('#ov [data-act=placeBid]')?.dataset.id), el = $('#bpv'); if (!l || !el) return;
 const fee = +$('#bfee').value || 0, e = est(l, { rates: bidRates() });
 el.innerHTML = `<div class="mu sm-t">Seller sees</div><div class="big">${fx0(e - fee)}</div><div class="mu xs">${fx0(e)} offer − ${fx0(fee)} pickup fee · reference value ${fx0(listingRef(l))}. Final payout uses verified weight.</div>`;
}
function placeBid(id) {
 const l = Lst(id); if (!l || l.status != 'open' || closed(l)) { closeModal(); return toast('Bidding has closed on this listing') }
 const rates = bidRates(), fee = +$('#bfee').value || 0;
 if (!l.items.some(i => rates[i.m] > 0)) return toast('Enter a rate for at least one material');
 const flag = l.items.find(i => { const p = rangeFor(i.m, unitOf(i)); return p && rates[i.m] > p.max * 1.6 });
 const ex = D.bids.find(b => b.l == l.id && b.b == me.id);
 if (ex) { ex.rates = rates; ex.fee = fee; ex.auto = false } else { D.bids.push({ id: uid('D'), k: Date.now(), l: l.id, b: me.id, rates, fee }); notify(l.seller, `New bid from ${me.name} on your listing in ${l.area}`) }
 if (flag) D.alerts.push({ id: uid('A'), k: Date.now(), txt: `Unusual bid: ${me.name} offered ₹${rates[flag.m]}/${unitOf(flag)} for ${flag.m} (reference ${fmtRate(flag.m, unitOf(flag))})`, st: 'open' });
 log(`${me.name} bid on a listing in ${l.area}`); save(); closeModal(); toast(flag ? 'Bid placed. Flagged for admin review.' : 'Bid placed'); render();
}
function quick(id) {
 const l = Lst(id), q = l && quoteFor(me, l);
 if (!l || closed(l)) return toast('Bidding has closed on this listing'); if (!q) return toast('This listing is outside your rate card or service area');
 D.bids.push({ id: uid('D'), k: Date.now(), l: id, b: me.id, rates: q.rates, fee: q.fee }); notify(l.seller, `New bid from ${me.name} on your listing in ${l.area}`);
 log(`${me.name} bid using rate card`); save(); toast('Bid placed with your rates'); render();
}
function withdraw(id) { if (!confirm('Withdraw this bid?')) return; D.bids = D.bids.filter(b => b.id != id); log(`${me.name} withdrew a bid`); save(); render() }

function buyerOrders() {
 const os = D.orders.filter(o => o.buyer == me.id).slice().reverse();
 if (!os.length) return empty('📦', 'No orders yet', '<p>When a seller accepts your bid, the order appears here.</p>', '<button class="btn role" data-act="go" data-tab="market">Browse marketplace</button>');
 return os.map(o => { const l = Lst(o.l); if (!l) return '';
  return `<div class="card"><div class="lhead"><div class="lpic">${l.photo ? `<img src="${esc(l.photo)}" alt="">` : iconsOf(l)}</div><div><b>${esc(l.area)}</b><div style="margin-top:6px">${tags(l)}</div></div></div>${orderBox(o, 'buyer')}
  ${o.step == 0 ? `<div class="card soft" style="margin:14px 0 0"><b>🗓 Schedule the pickup</b><div class="row" style="margin-top:8px"><select id="sl${o.id}" data-keep style="flex:1;min-width:200px">${slots().map(s => `<option>${s}</option>`).join('')}</select><button class="btn role" data-act="sched" data-id="${o.id}">Schedule pickup</button></div><p class="mu xs" style="margin:8px 0 0">Collectors near the seller will see this pickup and accept it.</p></div>` : ''}</div>` }).join('');
}
function sched(id) {
 const o = Ord(id), l = o && Lst(o.l); if (!o || o.step != 0) return;
 o.slot = $('#sl' + id).value; adv(o, 1); notifyCollectors(o, l); notify(o.seller, `Pickup scheduled for ${o.slot}`);
 log(`${me.name} scheduled a pickup`); save(); toast('Pickup scheduled. Waiting for a collector.'); render();
}

function bizPage() {
 const os = D.orders.filter(o => o.buyer == me.id), done = os.filter(o => o.pay), kg = done.reduce((s, o) => s + kgOfOrder(o), 0), spent = done.reduce((s, o) => s + o.pay.gross, 0);
 const due = done.filter(o => !o.fpb).reduce((s, o) => s + bFee(o), 0), paidF = done.filter(o => o.fpb).reduce((s, o) => s + bFee(o), 0), ru = me.rateUnits || {};
 const groups = CATS.map(c => `<details class="grp" data-grp="${c}" ${OPEN_GRPS.has(c) ? 'open' : ''}><summary>${CAT_ICON[c]} ${c} <span class="mu sm-t">${MATS.filter(d => d.c == c && (me.rates || {})[d.m]).length}/${MATS.filter(d => d.c == c).length} priced</span></summary><div class="gb">
  ${MATS.map((d, n) => d.c != c ? '' : `<div class="rcrow"><div><b>${d.i} ${esc(d.m)}</b><div class="mu">Reference ${fmtRate(d.m, ru[d.m] || d.u)}</div></div>
   ${d.u2 ? `<select id="ru${n}" class="rc-unit" data-m="${esc(d.m)}" data-keep>${unitsOf(d.m).map(x => `<option ${x == (ru[d.m] || d.u) ? 'selected' : ''}>${x}</option>`).join('')}</select>` : `<span class="tag n">per ${d.u}</span>`}
   <input id="rc${n}" class="rc" data-m="${esc(d.m)}" data-keep type="number" min="0" step=".1" value="${(me.rates || {})[d.m] || ''}" placeholder="₹ your rate"></div>`).join('')}</div></details>`).join('');
 return `<div class="cols"><div><div class="card"><h3>💹 My rate card</h3><p class="mu sm-t">Set your offer per unit. Leave blank for materials you don’t buy. Reference rates are indicative, not live.</p>${groups}
  <div class="grid2" style="margin-top:14px"><label class="f">Default pickup fee charged to sellers (₹)<input id="bf" data-keep type="number" min="0" value="${me.fee || 0}"></label><label class="f">Minimum kg per pickup<input id="bm" data-keep type="number" min="0" value="${me.minKg || 0}"></label></div>
  <label class="f">Areas you serve (cities or localities, comma separated — use * for everywhere)<input id="bs" data-keep value="${esc(me.svc || loc(me.area).c)}"></label>
  <label class="check"><input type="checkbox" id="ba" data-keep ${me.auto ? 'checked' : ''}> <span><b>Auto-bid</b> on new listings that match my rate card${me.ok ? '' : ' (starts after verification)'}</span></label>
  <button class="btn role w" data-act="saveBiz">Save rate card</button></div></div>
 <div><div class="card"><div class="row between"><h3 style="margin:0">Business overview</h3><button class="btn s xs" data-act="csv" data-k="buys">⬇ CSV</button></div><div class="row" style="margin-top:10px"><span class="tag r">${os.length} orders won</span><span class="tag r">${r1(kg)} kg bought</span><span class="tag r">${fx0(spent)} purchased</span><span class="tag r">★ ${me.rn ? rating(me).toFixed(1) + ' (' + me.rn + ')' : 'New'}</span></div></div>
  <div class="card"><h3>Platform fees</h3><p class="mu sm-t">You pay 2% of each completed purchase, minimum ₹10 per order.</p><div class="row"><span class="tag ${due ? 'w' : ''}">Due ${fx0(due)}</span><span class="tag">Paid ${fx0(paidF)}</span></div>
   ${done.length ? `<div class="tw" style="margin-top:10px"><table><tr><th>Order</th><th class="num">Purchase</th><th class="num">Fee</th><th></th></tr>${done.slice().reverse().map(o => `<tr><td>#${o.id.slice(-6).toUpperCase()}</td><td class="num">${fx0(o.pay.gross)}</td><td class="num"><b>${fx0(bFee(o))}</b></td><td>${o.fpb ? '<span class="tag">Paid</span>' : `<button class="btn xs" data-act="payFee" data-id="${o.id}" data-w="b">Pay</button>`}</td></tr>`).join('')}</table></div>` : '<p class="mu sm-t">Fees appear after your first completed order.</p>'}
   ${due ? `<button class="btn role w" style="margin-top:12px" data-act="payAll" data-w="b">Pay all dues (${fx0(due)})</button>` : ''}</div>
  <div class="card"><h3>Business profile</h3><label class="f">Business name<input id="bnm" data-keep value="${esc(me.name)}"></label><label class="f">Address (Locality, City)<input id="bad" data-keep value="${esc(me.area)}"></label><p class="mu sm-t">${esc(me.email)} · ${esc(me.type || 'Buyer')}</p><button class="btn s w" data-act="saveProfile">Save profile</button></div></div></div>`;
}
function saveBiz() {
 const rates = {}, units = {};
 $$('.rc').forEach(i => { if (+i.value > 0) rates[i.dataset.m] = +i.value });
 $$('.rc-unit').forEach(i => units[i.dataset.m] = i.value);
 if (!Object.keys(rates).length) return toast('Set a rate for at least one material');
 const hi = Object.keys(rates).find(m => { const p = rangeFor(m, units[m] || unitFor(m)); return p && rates[m] > p.max * 1.6 });
 if (hi) D.alerts.push({ id: uid('A'), k: Date.now(), txt: `Unusual rate card: ${me.name} set ₹${rates[hi]} for ${hi} (reference ${fmtRate(hi, units[hi] || unitFor(hi))})`, st: 'open' });
 Object.assign(me, { rates, rateUnits: units, fee: +$('#bf').value || 0, minKg: +$('#bm').value || 0, svc: $('#bs').value.trim(), auto: $('#ba').checked });
 autoAll(me); log(`${me.name} updated rate card`); save(); toast(me.auto && me.ok ? 'Rate card saved. Auto-bids updated.' : 'Rate card saved'); render();
}
function saveProfile() {
 const n = $('#bnm').value.trim(), a = $('#bad').value.trim(); if (!n || !a) return toast('Name and address are required');
 me.name = n; me.area = a; log(`${n} updated profile`); save(); toast('Profile saved'); render();
}
function payFee(id, w) {
 const o = Ord(id); if (!o) return; if (w == 'b') o.fpb = true; else o.fpc = true;
 D.users.filter(u => u.role == 'admin').forEach(a => notify(a.id, `${me.name} paid platform fee ${fx0(w == 'b' ? bFee(o) : cFee(o))}`));
 log(`${me.name} paid a platform fee`); save(); toast('Platform fee paid'); render();
}
function payAll(w) {
 D.orders.filter(o => o.pay && (w == 'b' ? o.buyer == me.id && !o.fpb : o.coll == me.id && !o.fpc)).forEach(o => { if (w == 'b') o.fpb = true; else o.fpc = true });
 D.users.filter(u => u.role == 'admin').forEach(a => notify(a.id, `${me.name} cleared all platform fee dues`));
 log(`${me.name} cleared platform fee dues`); save(); toast('All dues paid'); render();
}
