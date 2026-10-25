// =========================================================
// Waste2Worth — collector pages: Available pickups, My pickups
// =========================================================
const PROOF = {}; // orderId -> {blob, url} proof photo waiting to be uploaded

const kmTo = l => kmOf(man(posOf(me.area), posOf(l.area)));

function approvalNote() {
 return me.sus ? '<div class="note e">This account is not active. Please contact support.</div>'
  : `<div class="note">⏳ <b>Approval pending.</b> Our team is reviewing your collector account. You can see nearby pickups now and accept them as soon as you are approved.</div>`;
}
function nearOrders() {
 // Addresses are typed freely, so show every open pickup: same city first, then nearest.
 const c = loc(me.area).c, same = l => c && loc(l.area).c == c ? 0 : 1;
 // Any accepted order without a collector is open for pickup, even if no time slot was chosen yet.
 return D.orders.filter(o => o.step <= 1 && !o.coll && !o.pay).map(o => ({ o, l: Lst(o.l) })).filter(x => x.l).sort((a, b) => same(a.l) - same(b.l) || kmTo(a.l) - kmTo(b.l));
}
function avail() {
 const ns = nearOrders(), c = loc(me.area).c, wait = me.ok ? '' : approvalNote();
 if (!ns.length) return wait + empty('📍', 'No open pickups right now', '<p>As soon as a seller accepts a buyer’s offer, the pickup appears here with its location, photo, items and weight.</p>' + (me.area ? '' : '<p>Add your operating area in <b>My account</b> to see nearby pickups.</p>'));
 let cur = posOf(me.area), left = ns.map(n => ({ ...n, p: posOf(n.l.area) })), ord = [], route = [cur];
 while (left.length) { left.sort((a, b) => plen(man(cur, a.p)) - plen(man(cur, b.p))); const n = left.shift(); ord.push(n); route.push(...man(cur, n.p).slice(1)); cur = n.p }
 const km = kmOf(route);
 return wait + `<div class="cols"><div>${ns.map(({ o, l }, i) => `<div class="card">
  <div class="row"><b>${i + 1}. ${esc(l.area)}</b><span class="tag r">~${kmTo(l).toFixed(1)} km away (approx.)</span>${loc(l.area).l && loc(l.area).l == loc(me.area).l ? '<span class="tag">Your locality</span>' : ''}</div>
  <div class="mu sm-t" style="margin:4px 0 10px">🗓 ${esc(o.slot || slots()[0] + ' (earliest slot)')} · deliver for ${esc(U(o.buyer).name)}</div>
  ${pickupDetails(l, o, true, true)}
  <div class="row between" style="margin-top:12px"><span class="mu sm-t">You earn about <b>${fx0(Math.max(20, Math.round(totKg(l) * 1.5)))}</b></span><button class="btn role" data-act="claim" data-id="${o.id}" ${me.ok ? '' : 'disabled title="Available once your account is approved"'}>Accept pickup</button></div></div>`).join('')}</div>
 <div><div class="card"><h3>🧭 Smart route</h3><p class="mu sm-t">${ord.length} pickup${ord.length > 1 ? 's' : ''} near you, nearest first. Combining them saves distance and fuel.</p>
  <div class="mapbox">${mapSvg('av', [[route[0][0], route[0][1], '📍', 'var(--role)', 'You'], ...ord.map((n, i) => [n.p[0], n.p[1], i + 1, null, cap(loc(n.l.area).l)])], route)}<div class="mapbar"><span>${ord.length} stops</span><b>~${km.toFixed(1)} km · ${Math.round(km * 3 + ord.length * 8)} min</b></div></div></div></div></div>`;
}
async function claim(id) {
 const o = Ord(id); if (!o) return; if (!me.ok) return toast('Your collector account is waiting for approval');
 if (o.coll) return toast('Already taken by another collector');
 if (!o.slot) { o.slot = slots()[0]; adv(o, 1) }
 o.coll = me.id; delete o.otp; adv(o, 2);
 const who = me.name + (me.type ? ` (${me.type})` : '');
 notify(o.seller, `Collector ${who} will pick up your waste on ${o.slot}. Your one-time PICKUP code is on the order in My listings. Give it only to ${me.name}, when they collect.`);
 notify(o.buyer, `Collector ${who} accepted the pickup for your order (${o.slot}). Your one-time DELIVERY code is on the order in Orders. Give it only when ${me.name} delivers to you.`);
 log(`${me.name} accepted a pickup`); tab = 'pick';
 // Save the assignment first, then ask the server for two different random codes: seller's and buyer's.
 clearTimeout(flushT); await flushing; await flush();
 if (!isDemo(o.seller)) { await newOtp(o.id, 'pickup'); await newOtp(o.id, 'delivery') }
 toast('Pickup assigned to you'); render();
}
async function resendOtp(id) {
 const o = Ord(id); if (!o || o.coll != me.id) return;
 if (o.otpOk) { pickupDone(id); return }
 if (!confirm(`Send ${U(o.seller).name} a new pickup code? The old code will stop working.`)) return;
 const { error } = await sb.rpc('wa_new_otp', { p_order: id, p_kind: 'pickup' });
 if (error) { if (/already verified/i.test(error.message)) return pickupDone(id); return toast(error.message) }
 delete WRONG[id]; notify(Ord(id).seller, `${me.name} asked for a new pickup code. Your new code is on the order in My listings.`); save(); toast(`New code sent to ${U(o.seller).name}`); render();
}
function pickups() {
 setTimeout(healOrders, 0);
 const mine = D.orders.filter(o => o.coll == me.id).slice().reverse(), paidOs = mine.filter(o => o.pay);
 const ern = paidOs.reduce((s, o) => s + cEarn(o), 0), fee = paidOs.reduce((s, o) => s + cFee(o), 0), due = paidOs.filter(o => !o.fpc).reduce((s, o) => s + cFee(o), 0);
 const earnCard = `<div class="card"><h3>💰 My earnings</h3><p class="mu sm-t">You earn ₹1.5 per kg (minimum ₹20 per pickup). The platform keeps 10%, minimum ₹5 per pickup.</p>
  <div class="row"><span class="tag r">Earned ${fx0(ern)}</span><span class="tag n">Platform fee ${fx0(fee)}</span><span class="tag">Take home ${fx0(ern - fee)}</span><span class="tag ${due ? 'w' : ''}">Due ${fx0(due)}</span></div>
  ${paidOs.length ? `<div class="tw" style="margin-top:10px"><table><tr><th>Order</th><th class="num">Earned</th><th class="num">Fee</th><th></th></tr>${paidOs.map(o => `<tr><td>#${o.id.slice(-6).toUpperCase()}</td><td class="num">${fx0(cEarn(o))}</td><td class="num"><b>${fx0(cFee(o))}</b></td><td>${o.fpc ? '<span class="tag">Paid</span>' : `<button class="btn xs" data-act="payFee" data-id="${o.id}" data-w="c">Pay</button>`}</td></tr>`).join('')}</table></div>` : '<p class="mu sm-t">Complete a pickup to start earning.</p>'}
  ${due ? `<button class="btn role w" style="margin-top:12px" data-act="payAll" data-w="c">Pay all dues (${fx0(due)})</button>` : ''}</div>`;
 if (!mine.length) return `<div class="cols"><div>${empty('🚚', 'No pickups yet', '<p>Accept one from the Available tab.</p>', '<button class="btn role" data-act="go" data-tab="avail">See available pickups</button>')}</div><div>${earnCard}</div></div>`;
 const act = mine.find(o => o.step >= 2 && o.step < 5);
 let nav = '';
 if (act) { const l = Lst(act.l), A = posOf(me.area), B = posOf(l.area), r = man(A, B);
  nav = `<div class="card"><h3>🧭 Navigation</h3><div class="mapbox">${mapSvg('nv', [[B[0], B[1], '🏠', 'var(--role)', cap(loc(l.area).l || l.area.split(',')[0])]], r, act.step == 3 ? { r, t: act.t3 || Date.now(), m: Math.max(6, Math.round(plen(r) / 22)) } : null)}<div class="mapbar"><span id="etanv">${act.step == 2 ? 'Tap Start trip to begin' : act.step == 3 ? 'Heading to seller' : 'At the pickup point'}</span><b>${kmOf(r).toFixed(1)} km</b></div></div></div>` }
 return `<div class="cols"><div>${mine.map(pickupCard).join('')}</div><div>${nav}${earnCard}</div></div>`;
}
function pickupCard(o) {
 const l = Lst(o.l), b = Bd(o.b), s = U(o.seller); if (!l || !b) return '';
 let h = `<div class="card"><div class="row between"><b>${esc(l.area)}</b>${o.pay ? `<span class="tag ${o.pay.st == 'Paid' ? '' : 'w'}">Payment ${o.pay.st}</span>` : `<span class="tag r">${STEPS[o.step]}</span>`}</div>
  <div class="mu sm-t" style="margin-bottom:10px">Seller contact: ${esc(s.name)}${s.email ? ' · ' + esc(s.email) : ''}</div>${o.step < 6 ? pickupDetails(l, o, true, true) : `<div style="margin-top:6px">${tags(l)}</div>`}${timeline(o)}`;
 if (o.step == 2) h += `<button class="btn role w" data-act="startTrip" data-id="${o.id}">🚚 Start trip</button>`;
 if (o.step == 3) {
  const pf = PROOF[o.id];
  h += `<div class="card soft" style="margin:12px 0 0"><b>🔍 Step 1 · Check the listing</b><p class="mu xs">Compare what the seller hands over with the listing photo above and the item list.</p>
   <label class="check"><input type="checkbox" id="chk_${o.id}" data-keep> <span>The items match the seller’s photo and listing, and nothing is hazardous (batteries, chemicals, medical waste).</span></label>
   <p class="mu xs" style="margin:6px 0 0">If something is very different or hazardous, don’t collect it. Message the seller below or contact support.</p></div>
   <div class="card soft" style="margin:12px 0 0"><b>⚖️ Step 2 · Record the verified quantity</b><p class="mu xs">Weigh or count at the door, in each item’s selling unit.</p>
   ${l.items.map((i, n) => `<div class="item"><span class="ic">${icon(i.m)}</span><div class="nm"><b>${esc(i.m)}</b><div class="mu xs">seller estimate ${qtyOf(i)} ${unitOf(i)} · agreed ₹${b.rates[i.m] || 0}/${unitOf(i)}</div></div><input id="wk_${o.id}_${n}" class="wk" data-keep data-m="${esc(i.m)}" data-unit="${unitOf(i)}" type="number" min="0" step="${unitOf(i) == 'piece' ? 1 : .1}" value="${qtyOf(i)}" style="width:100px" aria-label="${esc(i.m)} verified quantity"><span class="mu sm-t">${unitOf(i)}</span></div>`).join('')}
   <div style="margin:10px 0"><b class="sm-t">Proof photo</b>${pf ? `<img class="thumb" src="${pf.url}" alt="Proof photo" style="margin-top:8px">` : ''}<div class="row" style="margin-top:6px"><button class="btn s sm" data-act="proofCam" data-id="${o.id}">📷 ${pf ? 'Retake' : 'Take photo'}</button><button class="btn s sm" data-act="proofGal" data-id="${o.id}">🖼 Gallery</button></div></div>
   <button class="btn role w" data-act="weigh" data-id="${o.id}">Record quantities</button></div>`;
 }
 if (o.step == 4) h += o.appr == 'pending' ? '<div class="note">Waiting for the seller to approve the revised value.</div>' : o.appr == 'disputed' ? '<div class="note e">Disputed. Waiting for admin review.</div>'
  : `<div class="card soft" style="margin:12px 0 0"><b>🔐 Pickup code — ask the SELLER, ${esc(U(o.seller).name)}</b><p class="mu xs">Not the buyer’s code. The seller and the buyer each have a different code.</p><label class="f">Seller’s 4-digit pickup code<input id="ot${o.id}" data-keep maxlength="4" inputmode="numeric" placeholder="••••" style="font-size:22px;letter-spacing:8px;text-align:center"></label>${isDemo(o.seller) ? `<p class="mu xs">Demo seller’s code: <b>${o.otp}</b></p>` : '<p class="mu xs">It works once, and locks after 5 wrong tries.</p>'}${WRONG[o.id] == 'pickup' ? `<div class="note e" style="margin:4px 0 10px">❌ That code didn’t work. Ask ${esc(U(o.seller).name)} to read it again, or send them a fresh code — it appears on their screen in My listings within seconds.<div style="margin-top:8px"><button class="btn sm" data-act="resendOtp" data-id="${o.id}">🔄 Send ${esc(U(o.seller).name)} a new code</button></div></div>` : ''}
   <div class="row"><button class="btn role" style="flex:1" data-act="verify" data-id="${o.id}">Verify handover</button>${isDemo(o.seller) ? '' : `<button class="btn s" data-act="resendOtp" data-id="${o.id}">🔄 New code</button>`}</div></div>`;
 if (o.step == 5) h += isDemo(o.seller) ? `<button class="btn role w" data-act="verifyDelivery" data-id="${o.id}">✅ Delivered — complete order</button>`
  : `<div class="card soft" style="margin:12px 0 0"><b>📦 Deliver to ${esc(U(o.buyer).name)}</b><p class="mu xs">Take the waste to the buyer${U(o.buyer).area ? ' at ' + esc(U(o.buyer).area) : ''}. Hand it over only to the person who gives you the right delivery code.</p>
   <b>📦 Delivery code — ask the BUYER, ${esc(U(o.buyer).name)}</b><p class="mu xs">Not the seller’s pickup code. If you type the seller’s code here, the app will tell you.</p>
   <label class="f">Buyer’s 4-digit delivery code<input id="dt${o.id}" data-keep maxlength="4" inputmode="numeric" placeholder="••••" style="font-size:22px;letter-spacing:8px;text-align:center"></label>
   ${WRONG[o.id] == 'delivery' ? `<div class="note e" style="margin:4px 0 10px">❌ That code didn’t work. Ask ${esc(U(o.buyer).name)} to read it again, or send them a fresh code — it appears on their screen in Orders within seconds.<div style="margin-top:8px"><button class="btn sm" data-act="resendDlv" data-id="${o.id}">🔄 Send ${esc(U(o.buyer).name)} a new code</button></div></div>` : ''}
   <div class="row"><button class="btn role" style="flex:1" data-act="verifyDelivery" data-id="${o.id}">✅ Verify delivery and complete order</button><button class="btn s" data-act="resendDlv" data-id="${o.id}">🔄 New code</button></div></div>`;
 if (o.step == 6) h += collPayBox(o);
 return h + chatBox(o) + '</div>';
}
function startTrip(id) { const o = Ord(id); if (!o || o.step != 2) return; o.t3 = Date.now(); adv(o, 3); notify(o.seller, `${me.name} is on the way to you`); save(); render() }
function setProof(id, f) { shrink(f, 1024).then(p => { PROOF[id] = p; render() }).catch(e => toast(e.message)) }
async function weigh(id) {
 const o0 = Ord(id), l = o0 && Lst(o0.l), b = o0 && Bd(o0.b); if (!o0 || o0.step != 3) return;
 if (!$('#chk_' + id)?.checked) return toast('First check the items against the listing photo and tick the box');
 const pf = PROOF[id]; if (!pf) return toast('Add a proof photo first');
 const wts = $$(`[id^="wk_${id}_"]`).map(i => { const unit = i.dataset.unit || 'kg', q = +i.value; return { m: i.dataset.m, unit, qty: unit == 'piece' ? Math.round(q) : q, rate: +b.rates[i.dataset.m] || 0 } });
 if (wts.some(w => !(w.qty >= 0))) return toast('Enter valid quantities');
 toast('Uploading proof photo…'); const url = await upload(pf.blob, 'proof');
 const o = Ord(id); if (!o || o.step != 3) return; // fresh copy after the upload
 o.chk = true; o.wts = wts; o.proof = url || ''; o.val = wts.reduce((s, w) => s + w.qty * w.rate, 0); delete PROOF[id];
 const ev = est(l, b), off = ev > 0 && Math.abs(o.val - ev) / ev > .15;
 o.appr = off && !isDemo(o.seller) ? 'pending' : null; adv(o, 4);
 notify(o.seller, o.appr ? `Items checked against your listing. Approval needed: revised value ${fx(o.val)} for your pickup` : 'Items checked against your listing and weighed. Share your pickup code to complete the handover.');
 notify(o.buyer, `Collector verified and weighed your order: ${r1(wts.reduce((s, w) => s + kgOfItem(w), 0))} kg.`);
 log(`Quantities recorded: ${fx(o.val)} vs estimate ${fx(ev)}`); save();
 toast(o.appr ? 'Quantity differs by more than 15%. Seller approval needed.' : 'Quantities recorded'); render();
}
// After a wrong code, the card shows a clear "send a new code" button (orderId -> 'pickup' | 'delivery').
const WRONG = {};
// Important: after any await, use Ord(id) again. A live update from the server can replace the
// order object while we wait, and changes made to the old copy would be lost.
function pickupDone(id) {
 const o = Ord(id); if (!o || o.step >= 5) return;
 o.otpOk = true; adv(o, 5); delete WRONG[id];
 notify(o.seller, 'Pickup code verified. Your waste is on its way to the buyer.'); log('Pickup code verified');
 if (!isDemo(o.seller)) notify(o.buyer, `${me.name} picked up your order and is bringing it to you. Keep your delivery code ready (Orders).`);
 save(); toast('Pickup verified. Now deliver to the buyer.'); render();
}
async function verify(id) {
 const o = Ord(id), v = ($('#ot' + id)?.value || '').trim(); if (!o) return;
 if (!/^\d{4}$/.test(v)) return toast('Enter the 4-digit code from the seller');
 if (isDemo(o.seller)) { if (v != o.otp) return toast('Wrong code. Ask the seller to check it.'); return pickupDone(id) }
 const { data, error } = await sb.rpc('wa_check_otp', { p_order: id, p_code: v });
 if (error) return toast(error.message);
 const seller = U(Ord(id).seller).name;
 if (data == 'ok' || (data == 'none' && Ord(id).otpOk)) return pickupDone(id);
 if (data == 'other') return toast(`That is the BUYER’s delivery code. Here at pickup, ask the seller ${seller} for the pickup code.`);
 WRONG[id] = 'pickup'; render();
 if (data == 'wrong') return toast(`Wrong code. Ask ${seller} to check it, or tap “Send ${seller} a new code”.`);
 if (data == 'locked') return toast(`Locked after 5 wrong tries. Tap “Send ${seller} a new code”.`);
 if (data == 'none') return toast(`No active code. Tap “Send ${seller} a new code”.`);
}
async function verifyDelivery(id) {
 const o = Ord(id), v = ($('#dt' + id)?.value || '').trim(); if (!o || o.step != 5) return;
 if (!isDemo(o.seller)) {
  if (!/^\d{4}$/.test(v)) return toast('Enter the 4-digit delivery code from the buyer');
  const { data, error } = await sb.rpc('wa_check_otp', { p_order: id, p_code: v, p_kind: 'delivery' });
  if (error) return toast(error.message);
  const buyer = U(Ord(id).buyer).name;
  if (!(data == 'ok' || (data == 'none' && Ord(id).dlvOk))) {
   if (data == 'other') return toast(`That is the SELLER’s pickup code. Here at delivery, ask the buyer ${buyer} for the delivery code.`);
   if (data == 'early') return toast('Verify the seller’s pickup code first.');
   WRONG[id] = 'delivery'; render();
   if (data == 'wrong') return toast(`Wrong code. Ask ${buyer} to check it, or tap “Send ${buyer} a new code”.`);
   if (data == 'locked') return toast(`Locked after 5 wrong tries. Tap “Send ${buyer} a new code”.`);
   return toast(`No active delivery code. Tap “Send ${buyer} a new code”.`);
  }
  Ord(id).dlvOk = true; delete WRONG[id];
 }
 notify(Ord(id).buyer, 'Delivery code verified. Your order has been delivered.'); log('Delivery code verified');
 finish(id);
}
async function resendDlv(id) {
 const o = Ord(id); if (!o || o.coll != me.id) return;
 if (!confirm(`Send ${U(o.buyer).name} a new delivery code? The old code will stop working.`)) return;
 if (await newOtp(id, 'delivery')) { delete WRONG[id]; notify(Ord(id).buyer, `${me.name} asked for a new delivery code. Your new code is on the order in Orders.`); save(); toast('New code sent to the buyer'); render() }
}
// Repairs orders where the server accepted a code but the app didn't move the order on.
function healOrders() {
 let fixed = false;
 D.orders.filter(o => o.coll == me.id).forEach(o => {
  if (o.step == 4 && o.otpOk && o.appr != 'pending' && o.appr != 'disputed') { adv(o, 5); log('Pickup code verified'); fixed = true }
  else if (o.step == 5 && o.dlvOk) setTimeout(() => finish(o.id), 0);
 });
 if (fixed) { save(); render() }
}
function finish(id) {
 const o = Ord(id), b = o && Bd(o.b); if (!o || o.step != 5) return;
 if (!isDemo(o.seller) && !o.dlvOk) return toast('Verify the buyer’s delivery code first');
 const gross = o.wts.reduce((s, w) => s + w.qty * w.rate, 0), comm = Math.round(gross * COMM * 100) / 100;
 const fee = +b.fee || 0, demo = isDemo(o.seller);
 // The buyer pays the full amount to Waste2Worth; once confirmed, the app splits it (see splitOf in market.js).
 o.pay = { v: 2, st: 'Awaiting payment', gross, fee, comm, net: 0, ref: 'WA' + Date.now().toString().slice(-9), t: Date.now(), method: 'UPI' };
 const sp = splitOf(o); o.pay.T = sp.T; o.pay.net = sp.seller;
 if (demo) Object.assign(o.pay, { st: 'Paid', paidAt: Date.now(), split: { seller: { amt: sp.seller, st: 'Received' }, coll: { amt: sp.coll, st: 'Received' }, admin: { amt: sp.admin } } });
 adv(o, 6); const l = Lst(o.l); if (l) l.status = 'completed';
 notify(o.buyer, `Delivered! Please pay ${fx(sp.T)} to Waste2Worth by UPI — open the order in Orders. One payment covers the seller and the collector.`);
 notify(o.seller, `Your waste was delivered to ${U(o.buyer).name}. You will receive about ${fx(sp.seller)} once they pay.${U(o.seller).upi ? '' : ' Add your UPI ID in My account so we can pay you.'}`);
 notify(o.coll, `Delivery complete! Your transport fee of ${fx(sp.coll)} will be sent to your UPI ID once the buyer pays.${me.upi ? '' : ' Add your UPI ID in My account.'}`);
 const a = adminUser(); if (a) notify(a.id, `Order ${ordNo(o)} delivered. Waiting for ${U(o.buyer).name} to pay ${fx(sp.T)}.`);
 log(`Order ${o.pay.ref} delivered, awaiting payment`); save(); toast('Order completed. The buyer will now pay.'); render();
}
