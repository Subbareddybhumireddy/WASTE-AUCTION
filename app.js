// =========================================================
// Waste2Worth — page headers, shared pages, event wiring, chat, start-up
// Load order: catalog.js → js/core.js → js/market.js → js/seller.js →
// js/buyer.js → js/collector.js → js/admin.js → js/landing.js → app.js
// =========================================================
const PAGES = {
 seller: { new: sellerNew, mine: sellerMine, earn: earnings },
 buyer: { market, orders: buyerOrders, biz: bizPage },
 collector: { avail, pick: pickups },
 admin: { dash: adminHome, pay: adminPayments, alerts: adminAlerts, users: adminUsers, audit: adminAudit }
};
const COMMON = { notes: notesPage, acct: acctPage };

function hero() {
 const r = me.role; let t, p, c;
 const greet = () => { const h = new Date().getHours(); return (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ', ' + esc(firstName(me.name)) };
 if (r == 'seller') {
  const my = D.listings.filter(l => l.seller == me.id), bs = D.bids.filter(b => my.some(l => l.id == b.l)).length, paid = D.orders.filter(o => o.seller == me.id && o.pay && o.pay.st == 'Paid').reduce((s, o) => s + o.pay.net, 0);
  t = 'Your waste has a <em>worth</em>. Let’s unlock it.'; p = greet() + '. Turn unused materials into money — buyers compete, you pick the best offer.';
  c = hchip(my.filter(l => l.status == 'open').length, 'open listings') + hchip(bs, 'bids received') + hchip(fx0(paid), 'paid so far');
 } else if (r == 'buyer') {
  t = 'Your next <em>treasure</em> is just a bid away.'; p = 'Discover recyclables near you, compete for the best deals and make sustainability profitable.';
  c = hchip(D.listings.filter(l => l.status == 'open' && !closed(l)).length, 'open listings') + hchip(D.bids.filter(b => b.b == me.id).length, 'your bids') + hchip(D.orders.filter(o => o.buyer == me.id).length, 'orders won');
 } else if (r == 'collector') {
  t = greet() + ' 🚚'; p = 'Pick up, weigh, verify and complete. Every kilo you collect earns you money.';
  c = hchip(nearOrders().length, 'pickups near you') + hchip(D.orders.filter(o => o.coll == me.id && o.step < 6).length, 'active') + hchip(D.orders.filter(o => o.coll == me.id && o.step == 6).length, 'completed');
 } else {
  t = 'Admin control room'; p = 'Verify buyers, review alerts, resolve disputes and keep the marketplace honest.';
  c = hchip(D.alerts.filter(a => a.st == 'open').length, 'open alerts') + hchip(D.users.filter(needsApproval).length, 'accounts to approve') + hchip(D.users.length, 'users') + hchip(D.orders.filter(o => o.disp == 'open').length, 'open disputes');
 }
 return `<section class="phero"><h2>${t}</h2><p>${p}</p><div class="hchips">${c}</div></section>` + (tab == 'new' || tab == 'market' ? ticker() : '');
}

// ---------- shared pages ----------
function notesPage() {
 const mine = D.notes.filter(n => n.to == me.id).slice().reverse(), un = mine.filter(n => !n.read);
 if (un.length) setTimeout(() => { let ch = false; D.notes.forEach(n => { if (n.to == me.id && !n.read) { n.read = true; ch = true } }); if (ch) { save(); renderChromeOnly() } }, 1500);
 return `<div class="card soft"><div class="row between"><div><b>📲 Device alerts</b><div class="mu sm-t">Get a system alert for new bids, pickups and payments when this tab is in the background.</div></div><button class="btn s sm" data-act="enableAlerts">Enable</button></div></div>
 <div class="card"><h3>Notifications</h3>${mine.slice(0, 80).map(n => `<div class="item"><span class="ic">${!n.read ? '🔔' : '✓'}</span><div class="nm">${esc(n.txt)}<div class="mu xs">${when(n.k)}</div></div>${!n.read ? '<span class="tag">New</span>' : ''}</div>`).join('') || '<div class="empty"><div class="ei">🔔</div><b>You’re all caught up</b></div>'}</div>`;
}
function acctPage() {
 return `<div class="cols"><div><div class="card"><h3>My profile</h3>
  <div class="row" style="gap:18px;margin:8px 0 18px">${avatar(me, 'xl')}<div><b style="font-size:1.1rem">${esc(me.name)}</b><div class="mu sm-t">${ROLE_NAME[me.role]} · ${esc(me.email)}${me.type ? ' · ' + esc(me.type) : ''}</div>
   <div class="row" style="margin-top:10px"><button class="btn s sm" data-act="avCam">📷 Take photo</button><button class="btn s sm" data-act="avGal">🖼 Gallery</button>${me.av ? '<button class="btn d sm" data-act="avDel">🗑 Remove</button>' : ''}</div></div></div>
  <label class="f">Name<input id="an" data-keep value="${esc(me.name)}"></label>
  ${me.role == 'admin' ? '' : `<label class="f">Address (Locality, City)<div class="inline-btn" style="margin-top:6px"><input id="aa" data-keep value="${esc(me.area)}"><button class="btn s" data-act="locate" data-to="aa" aria-label="Use my location">📍</button></div></label>`}
  ${me.role == 'buyer' ? '' : `<label class="f">${me.role == 'admin' ? 'Waste2Worth UPI ID (buyers pay here)' : 'UPI ID for receiving payments'}<input id="aupi" data-keep value="${esc(me.upi || '')}" placeholder="${me.role == 'admin' ? 'waste2worth@okicici' : 'yourname@okaxis'}" autocomplete="off" spellcheck="false"></label><p class="mu xs" style="margin:-4px 0 12px">${me.role == 'admin' ? 'Buyers pay every order to this UPI ID. You then send each seller and collector their share from Payments.' : me.role == 'seller' ? 'Your share of every sale is sent to this UPI ID (GPay, PhonePe, Paytm, BHIM).' : 'Your transport fee for every pickup is sent to this UPI ID.'}</p>`}
  <button class="btn role w" data-act="saveAcct">Save changes</button></div></div>
 <div><div class="card"><h3>Change password</h3><label class="f">Current password<input id="pw0" type="password" autocomplete="current-password"></label><label class="f">New password (min 6 characters)<input id="pw1" type="password" autocomplete="new-password"></label><button class="btn s w" data-act="changePw">Update password</button></div>
  <div class="card"><h3>Appearance</h3><div class="row between"><span class="mu">Light or dark theme</span><button class="btn s sm" data-act="theme">🌗 Switch theme</button></div></div>
  <button class="btn d w" data-act="logout">Log out</button></div></div>`;
}
async function setAvatar(f) {
 try { const { blob } = await shrink(f, 320, true); toast('Saving profile photo…'); const url = await upload(blob, 'avatar'); if (!url) return toast('Could not upload the photo. Check the storage setup.'); me.av = url; save(); toast('Profile photo updated 👍'); render() }
 catch (e) { toast(e.message) }
}
function saveAcct() {
 const n = $('#an').value.trim(), a = $('#aa') ? $('#aa').value.trim() : me.area;
 if (!n || (me.role != 'admin' && !a)) return toast('Name and address are required');
 if ($('#aupi')) { const u = $('#aupi').value.trim(); if (u && !UPI_RE.test(u)) return toast('Enter a valid UPI ID, like yourname@okaxis'); me.upi = u }
 me.name = n; me.area = a; log(`${n} updated account`); save(); toast('Account updated'); render();
}
async function changePw() {
 const o = $('#pw0').value, n = $('#pw1').value; if (n.length < 6) return toast('New password needs at least 6 characters');
 const chk = await sb.auth.signInWithPassword({ email: authUser.email, password: o }); if (chk.error) return toast('Current password is wrong');
 const { error } = await sb.auth.updateUser({ password: n }); if (error) return toast(error.message);
 $('#pw0').value = $('#pw1').value = ''; log(`${me.name} changed password`); save(); toast('Password updated');
}
function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('w2w_theme', t) } catch { } const m = $('meta[name="theme-color"]'); if (m) m.content = t == 'dark' ? '#08110c' : '#0e7a4b' }

// ---------- click / change / input handlers ----------
const ACT = {
 go: d => { tab = d.tab; closeModal(true); render() },
 theme: () => setTheme(document.documentElement.dataset.theme == 'dark' ? 'light' : 'dark'),
 logout, retry: () => authUser && enter(authUser),
 top: () => { if (AUTHPAGE) closeAuthPage(); scrollTo({ top: 0, behavior: RM.matches ? 'auto' : 'smooth' }) },
 home: () => { closeAuthPage(); scrollTo(0, 0) },
 jump: d => { if (AUTHPAGE) closeAuthPage(); setTimeout(() => document.getElementById(d.to)?.scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth' }), AUTHPAGE ? 0 : 30) },
 // Log in / Sign up open their own page. Switching tabs inside the form (data-stay) just swaps the form.
 auth: d => { if (d.role) SROLE = d.role; if (d.stay) { LMODE = d.mode; authMsg = ''; history.replaceState({ auth: d.mode }, '', '#' + d.mode); renderLanding(); return } openAuthPage(d.mode) },
 srole: d => { SROLE = d.r; authMsg = ''; renderLanding() },
 forgot, lcat: d => { LF.cat = d.c; renderLanding() },
 locate: d => locateInto(d.to), closeModal: () => closeModal(),
 camShot, camFlip, csv: d => exportCsv(d.k),
 // seller
 pickListing: () => pickFile(setListingPhoto), camListing: () => takePhoto('environment', 'Photo of your waste', setListingPhoto),
 rmPhoto: () => { if (!draft) return; draft.img = null; draft.blob = null; draft.ai = null; draft.msg = ''; draft.hazard = false; if (!draft.items.length) draft = null; toast('Photo removed'); render() },
 manualDraft: () => { draft = { items: [], img: null }; render() },
 dAdd: () => { const m = $('#addm').value; if (draft.items.some(i => i.m == m)) return toast('Already added'); draft.items.push({ m, unit: unitFor(m), qty: 0, conf: 0 }); render(); setTimeout(() => $('#dq' + (draft.items.length - 1))?.focus(), 30) },
 qAdd: d => { draft.items.push({ m: d.m, unit: unitFor(d.m), qty: 0, conf: 0 }); render(); setTimeout(() => $('#dq' + (draft.items.length - 1))?.focus(), 30) },
 dRemove: d => { draft.items.splice(+d.i, 1); render() },
 viewPhoto: d => openModal(`<h3 id="mh">Listing photo</h3><img class="fullpic" src="${esc(d.src)}" alt="Listing photo, full size"><div class="row" style="margin-top:12px"><button class="btn s" data-act="closeModal">Close</button></div>`),
 newOtp: async d => { const kind = d.kind || 'pickup'; if (await newOtp(d.id, kind)) { const o = Ord(d.id); if (o && o.coll) notify(o.coll, `The ${kind == 'pickup' ? 'seller' : 'buyer'} created a new ${kind} code. Ask them for it at handover.`); save(); toast(`New ${kind} code created`); render() } },
 retryAi: () => analyse(),
 payUpi: d => payUpi(d.id), adminConfirmPay: d => adminConfirmPay(d.id, d.ok == '1'),
 payoutSent: d => payoutSent(d.id, d.w), payoutOk: d => payoutOk(d.id, d.w, d.ok == '1'),
 remindUpi: d => { notify(d.id, 'Please add your UPI ID in My account so Waste2Worth can send your payment.'); save(); toast('Reminder sent') },
 copyUpi: d => { navigator.clipboard?.writeText(d.upi).then(() => toast('UPI ID copied'), () => toast(d.upi)) },
 publish, accept: d => accept(d.id), decline: d => decline(d.id),approve: d => approve(d.id, d.ok == '1'), rate: d => rate(d.id, +d.n),
 relist: d => { const l = Lst(d.id); if (!l) return; l.end = Date.now() + 864e5; log(`${me.name} reopened bidding`); save(); toast('Bidding reopened for 24 hours'); render() },
 cancelL: d => { if (!confirm('Cancel this listing? All bids on it will be removed.')) return; const l = Lst(d.id); if (!l) return; l.status = 'cancelled'; D.bids = D.bids.filter(b => b.l != d.id); log(`${me.name} cancelled a listing`); save(); render() },
 sendMsg: d => {
  const o = Ord(d.id), inp = $('#cm' + d.id), x = inp.value.trim(); if (!o || !x) return;
  (o.msgs = o.msgs || []).push({ u: me.id, n: firstName(me.name), x: x.slice(0, 300), t: Date.now() });
  [o.seller, o.buyer, o.coll].filter(v => v && v != me.id).forEach(v => notify(v, `${firstName(me.name)} about your order: ${x.slice(0, 60)}`));
  inp.value = ''; save(); render();
 },
 // buyer
 openBid: d => openBid(d.id), placeBid: d => placeBid(d.id), quick: d => quick(d.id), withdraw: d => withdraw(d.id), sched: d => sched(d.id),
 mfReset: () => { Object.assign(MF, { cat: 'All', mat: 'All', q: '', qmin: '', pmin: '', pmax: '' }); render() },
 saveBiz, saveProfile, payFee: d => payFee(d.id, d.w), payAll: d => payAll(d.w),
 // collector
 claim: d => claim(d.id), startTrip: d => startTrip(d.id), weigh: d => weigh(d.id), verify: d => verify(d.id), resendOtp: d => resendOtp(d.id), verifyDelivery: d => verifyDelivery(d.id), resendDlv: d => resendDlv(d.id), finish: d => finish(d.id),
 proofCam: d => takePhoto('environment', 'Proof photo', f => setProof(d.id, f)), proofGal: d => pickFile(f => setProof(d.id, f)),
 // admin
 verifyBuyer: d => verifyBuyer(d.id), rejectBuyer: d => rejectBuyer(d.id),remind: d => remind(d.id), saveRate, seedDemo, clearDemo,
 resA: d => resA(d.id), resD: d => resD(d.id), toggleSus: d => toggleSus(d.id), ufilt: d => { userFilter = d.r; render() },
 // account
 avCam: () => takePhoto('user', 'Profile photo', setAvatar), avGal: () => pickFile(setAvatar),
 avDel: () => { me.av = null; save(); toast('Profile photo removed'); render() }, saveAcct, changePw,
 enableAlerts: () => { try { Notification.requestPermission().then(p => toast(p == 'granted' ? 'Device alerts enabled' : 'Alerts blocked by the browser')) } catch { toast('Not supported in this browser') } }
};
const CHG = {
 dmat: (el) => { const i = draft.items[+el.dataset.i]; if (draft.items.some((x, n) => x.m == el.value && n != +el.dataset.i)) { toast('Already added'); return render() } i.m = el.value; if (!unitsOf(i.m).includes(i.unit)) { i.unit = unitFor(i.m); i.qty = 0 } i.conf = 0; render() },
 dunit: (el) => { const i = draft.items[+el.dataset.i]; i.unit = el.value; i.qty = 0; render() },
 mf: (el) => { MF[el.dataset.k] = el.value; if (el.dataset.k == 'cat') MF.mat = 'All'; render() },
 arMat: (el) => { AR.m = el.value; AR.u = unitFor(el.value); render() },
 arUnit: (el) => { AR.u = el.value; render() }
};
let inpT = null;
const INP = {
 dqty: (el) => { const i = draft.items[+el.dataset.i]; i.qty = Math.max(0, +el.value || 0); const b = $('#estbox'); if (b) b.innerHTML = estHTML() },
 bidprev: () => bidPrev(),
 mf: (el) => { MF[el.dataset.k] = el.value; clearTimeout(inpT); inpT = setTimeout(render, 250) },
 lf: (el) => { LF.q = el.value; clearTimeout(inpT); inpT = setTimeout(renderLanding, 200) }
};
function exportCsv(k) {
 if (k == 'sales') { const rows = [['Order', 'Date', 'Buyer', 'Material', 'Quantity', 'Unit', 'Rate', 'Value', 'Pickup fee', 'Commission', 'Net', 'Reference']]; D.orders.filter(o => o.seller == me.id && o.pay).forEach(o => o.wts.forEach((w, i) => rows.push([o.id, when(o.pay.t), U(o.buyer).name, w.m, w.qty, unitOf(w), w.rate, w.qty * w.rate, i ? '' : o.pay.fee, i ? '' : o.pay.comm, i ? '' : o.pay.net, o.pay.ref]))); downloadCsv('my-sales.csv', rows) }
 else if (k == 'buys') { const rows = [['Order', 'Date', 'Seller', 'Material', 'Quantity', 'Unit', 'Rate', 'Value', 'Reference']]; D.orders.filter(o => o.buyer == me.id && o.pay).forEach(o => o.wts.forEach(w => rows.push([o.id, when(o.pay.t), U(o.seller).name, w.m, w.qty, unitOf(w), w.rate, w.qty * w.rate, o.pay.ref]))); downloadCsv('my-purchases.csv', rows) }
 else downloadCsv('audit-trail.csv', [['Time', 'Event'], ...D.audit.slice().reverse().map(a => [when(a.k), a.m])]);
}
document.addEventListener('click', e => {
 if (e.target === $('#ov')) return closeModal();
 const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
 const f = ACT[el.dataset.act]; if (!f) return;
 if (el.tagName == 'A' || el.tagName == 'BUTTON') e.preventDefault();
 f(el.dataset, el, e);
});
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el, e) });
document.addEventListener('input', e => { const el = e.target.closest('[data-inp]'); if (el && INP[el.dataset.inp]) INP[el.dataset.inp](el, e) });
document.addEventListener('submit', e => { const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault(); if (f.dataset.form == 'login') doLogin(); else doSignup() });
document.addEventListener('keydown', e => {
 if (e.key == 'Escape' && !$('#ov').hidden) return closeModal();
 if (e.key == 'Enter' && e.target.dataset && e.target.dataset.enter) { e.preventDefault(); ACT[e.target.dataset.enter]?.(e.target.dataset) }
 if ((e.key == 'Enter' || e.key == ' ') && e.target.classList?.contains('drop')) { e.preventDefault(); e.target.click() }
});
document.addEventListener('toggle', e => { const g = e.target.dataset?.grp; if (g) e.target.open ? OPEN_GRPS.add(g) : OPEN_GRPS.delete(g) }, true);
['dragover', 'dragleave', 'drop'].forEach(t => document.addEventListener(t, e => {
 const d = e.target.closest?.('.drop'); if (!d) return; e.preventDefault(); d.classList.toggle('over', t == 'dragover');
 if (t == 'drop' && e.dataTransfer.files[0]) setListingPhoto(e.dataTransfer.files[0]);
}));
$('#nb').onclick = () => { $('#nb').classList.remove('on'); if (me) { tab = 'notes'; render() } };

// ---------- WasteBot chat (uses the Supabase "ai" function) ----------
const hist = [];
const openChat = () => { $('#chat').hidden = false; $('#ci').focus() };
$('#fab').onclick = () => $('#chat').hidden ? openChat() : ($('#chat').hidden = true);
$('#cx').onclick = () => $('#chat').hidden = true;
$('#sugg').onclick = e => { if (e.target.tagName == 'BUTTON') send(e.target.textContent) };
$('#cf').onsubmit = e => { e.preventDefault(); const t = $('#ci').value.trim(); if (t) { $('#ci').value = ''; send(t) } };
function addMsg(t, c) { const d = document.createElement('div'); d.className = 'm ' + c; d.textContent = t; $('#msgs').append(d); $('#msgs').scrollTop = 1e9; return d }
async function send(t) {
 addMsg(t, 'u'); hist.push({ role: 'user', content: t }); const w = addMsg('Typing…', 'b');
 try { const { data, error } = await sb.functions.invoke('ai', { body: { mode: 'chat', messages: hist.slice(-12) } }); if (error || data?.error || !data?.reply) throw 0; w.textContent = data.reply; hist.push({ role: 'assistant', content: data.reply }) }
 catch { const m = canon(t); w.textContent = m ? `${icon(m)} ${m}: reference ${fmtRate(m)}. ${tipFor(m)}` : 'WasteBot isn’t available right now. Try again in a moment.' }
}

// ---------- timers and start-up ----------
setInterval(tick, 1000);
setInterval(() => { if (me && !document.hidden && $('#ov').hidden && ['mine', 'market', 'avail', 'pick', 'orders'].includes(tab)) softRender() }, 30000); // keep countdowns fresh
sb.auth.onAuthStateChange((ev) => { if (ev == 'SIGNED_OUT' && authUser) { authUser = null; me = null; D = blank(); render() } });
(async function boot() {
 render();
 const { data } = await sb.auth.getSession();
 if (data.session) await enter(data.session.user); else { booting = false; render(); loadPublicStats() }
})();
