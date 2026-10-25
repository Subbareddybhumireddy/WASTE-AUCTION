// =========================================================
// Waste2Worth — public home page, login and sign-up
// =========================================================
let LMODE = 'login', SROLE = 'seller', authMsg = '';
const LF = { cat: 'All', q: '' };
const TYPES = { seller: ['Household', 'Apartment / Society', 'Shop / Business', 'Office', 'Hostel / Campus', 'Industry / Factory'], buyer: ['Local kabadiwala', 'Scrap dealer', 'Recycler', 'Aggregator'], collector: ['Bike', 'Auto / Tempo', 'Mini truck', 'On foot / cycle'] };

// Login / sign-up have their own page (#login, #signup) instead of a form at the bottom of the home page.
let AUTHPAGE = /^#(login|signup)$/.test(location.hash);
if (AUTHPAGE) LMODE = location.hash.slice(1);
function openAuthPage(mode, push = true) {
 LMODE = mode; AUTHPAGE = true; authMsg = '';
 if (push && location.hash != '#' + mode) history.pushState({ auth: mode }, '', '#' + mode);
 renderLanding(); scrollTo(0, 0);
 setTimeout(() => $(LMODE == 'login' ? '#le' : '#rn')?.focus({ preventScroll: true }), 200);
}
function closeAuthPage(push = true) {
 AUTHPAGE = false; authMsg = '';
 if (push && location.hash) history.pushState(null, '', location.pathname);
 renderLanding();
}
addEventListener('popstate', () => {
 if (authUser) return;
 const m = (location.hash.match(/^#(login|signup)$/) || [])[1];
 if (m) openAuthPage(m, false); else { closeAuthPage(false); scrollTo(0, 0) }
});
function lAuthPage() {
 return `<section class="wrap authpage"><a href="#" class="back" data-act="home">← Back to home</a>
 <div class="final"><div class="copy"><span class="kick" style="font-size:12.5px;font-weight:700;letter-spacing:.12em;color:var(--brand)">${LMODE == 'login' ? 'WELCOME BACK' : 'JOIN WASTE2WORTH'}</span>
  <h2>${LMODE == 'login' ? 'Log in to your account' : 'Create your free account'}</h2>
  <p class="mu" style="font-size:16.5px">${LMODE == 'login' ? 'We open the right workspace for you: seller, buyer or collector.' : 'Sell your scrap, buy recyclables, or earn by collecting. Choose what you want to do below.'}</p>
  <div class="tip">🔒 Secure email login. Your password is encrypted and never visible to anyone.</div><div class="tip">✅ Every buyer and collector is verified before they can work.</div><div class="tip">⚖️ You are paid for the weight measured at your door, not a guess.</div></div>
 <div class="card authc">${authForm()}</div></div></section>`;
}

let landingDrawn = false;
function renderLanding() {
 if (AUTHPAGE) { paint($('#landing'), lAuthPage() + lFoot(), true); landingDrawn = false; return }
 const s = pubStats(), again = landingDrawn;
 // Live numbers only appear once they are big enough to be meaningful.
 const big = s && (s.users >= 50 || s.open >= 10 || s.kg >= 500), done = s && s.n >= 10;
 paint($('#landing'), lHero() + (big ? lBand(s) : '') + lHow() + lRoles() + lFeats() + lPrices() + (done ? lImpact(s) : '') + lFinal() + lFoot(), true);
 // On re-draws, sections already scrolled past stay visible instead of animating again.
 if (again) $$('#landing .rv').forEach(e => { if (e.getBoundingClientRect().top < innerHeight) e.classList.add('v') });
 else countUp();
 landingDrawn = true; revealInit();
}
function pubStats() {
 if (!PUB) return null;
 const e = ecoFromWts((PUB.paid || []).filter(Array.isArray).flat());
 return { kg: e.kg, co2: e.co2, n: (PUB.paid || []).length, users: PUB.users || 0, open: PUB.open || 0 };
}
function lHero() {
 return `<section class="wrap hero"><div class="rv"><span class="eyebrow"><i>AI</i> Scrap auctions with verified pickups</span>
 <h1>Turn waste<br>into <span class="grad">worth.</span></h1>
 <p class="lead">Photograph your scrap, let verified buyers compete for it, and get paid for the weight actually measured at your door.</p>
 <div class="cta"><button class="btn lg" data-act="auth" data-mode="signup" data-role="seller">Start selling →</button><button class="btn lg s" data-act="auth" data-mode="signup" data-role="buyer">Explore marketplace</button></div>
 <div class="trust"><span>AI photo sorting</span><span>Verified weights</span><span>OTP-secured pickups</span></div></div>
 <div class="hv" aria-hidden="true"><div class="card hv-main"><div class="hv-photo">📦🥫🧴<span class="tag live">Live auction</span><span class="ai">✨ AI: Cardboard 92% · Cans 88%</span></div>
  <div class="hv-body"><div class="row between"><b>Korlagunta, Tirupati</b><span class="tag w">⏱ 5h 20m</span></div><div class="mu sm-t">14 kg cardboard · 3 kg aluminium cans</div>
  <div class="hv-bid top"><span class="av">GL</span><div><strong>Green Loop Recyclers</strong><div class="mu xs">★ 4.8 · Same locality</div></div><b>₹512</b></div>
  <div class="hv-bid"><span class="av" style="background:linear-gradient(140deg,#8b84ff,#4f46e5)">SB</span><div><strong>Sri Balaji Scrap</strong><div class="mu xs">★ 4.5 · Same city</div></div><b>₹468</b></div>
  <div class="hv-bid"><span class="av" style="background:linear-gradient(140deg,#f6b73c,#c86a00)">RK</span><div><strong>Raju Kabadiwala</strong><div class="mu xs">★ 4.2 · Same city</div></div><b>₹430</b></div></div></div>
 <div class="card hv-f f1"><span class="fi">🏆</span><div><b>Best offer</b><span class="mu xs">ranked by your take-home</span></div></div>
 <div class="card hv-f f2"><span class="fi" style="background:var(--brand-50)">🔐</span><div><b>Code 4 8 1 7</b><span class="mu xs">share only at handover</span></div></div></div></section>`;
}
function lBand(s) {
 return `<div class="wrap"><div class="band">${[[Math.round(s.kg), 'kg recycled'], [Math.round(s.co2), 'kg CO₂ saved (est.)'], [s.users, 'people on the platform'], [s.open, 'listings open for bids']].map(([v, l]) => `<div class="stat rv"><b class="cu">${v.toLocaleString('en-IN')}</b><span>${l}</span></div>`).join('')}</div></div>`;
}
function lHow() {
 const st = [['📷', 'Snap', 'Photograph your waste. AI suggests the materials; you confirm them and add rough quantities.'], ['⚖️', 'Compare', 'Verified buyers bid. Offers are ranked by what you actually take home.'], ['🚚', 'Handover', 'A collector weighs and counts at your door. You confirm with a one-time code.'], ['💰', 'Get paid', 'The final amount uses the verified quantity. Your receipt itemises every deduction.']];
 return `<section class="wrap sec" id="how"><div class="sec-h rv"><span class="kick">How it works</span><h2>From pile to payout in four steps</h2><p>No haggling at the door. Buyers compete, collectors verify, and every rupee is on the receipt.</p></div>
 <div class="steps">${st.map((x, i) => `<div class="step rv"><span class="num">${i + 1}</span><div class="si">${x[0]}</div><b>${x[1]}</b><p>${x[2]}</p></div>`).join('')}</div></section>`;
}
function lRoles() {
 const R = [['r1', '♻️', 'Sellers', 'seller', ['Homes, hostels, shops and offices', 'AI identifies your materials', 'Offers ranked by take-home pay', 'Eco levels, badges and leaderboard'], 'Start selling'],
  ['r2', '🏪', 'Buyers', 'buyer', ['Kabadiwalas, dealers and recyclers', 'Filter by material, area and value', 'One-tap bids from your rate card', 'Auto-bid on matching listings'], 'Start buying'],
  ['r3', '🚚', 'Collectors', 'collector', ['Bike, auto or mini-truck', 'Nearby pickups on a smart route', 'Weigh, verify the code, complete', 'Earn ₹1.5 per kg collected'], 'Start collecting']];
 return `<section class="wrap sec" id="roles"><div class="sec-h rv"><span class="kick">Who it's for</span><h2>One marketplace, three ways to earn</h2></div>
 <div class="roles">${R.map(r => `<div class="rolec ${r[0]} rv"><div class="ri">${r[1]}</div><h3>${r[2]}</h3><ul>${r[4].map(x => `<li>${x}</li>`).join('')}</ul><button class="btn" data-act="auth" data-mode="signup" data-role="${r[3]}">${r[5]} →</button></div>`).join('')}</div></section>`;
}
function lFeats() {
 const F = [['✨', 'Photo identification', 'AI vision suggests the recyclable materials in your photo.'], ['📈', 'Open bidding', 'Many buyers compete, so prices reflect real demand.'], ['🧮', 'Net payout ranking', 'See what you take home after pickup fees, not just the headline rate.'], ['🔐', 'Verified pickups', 'Weighed on site with a proof photo, confirmed with your one-time code.'], ['🧾', 'Transparent receipts', 'Gross value, fees and commission itemised on every order.'], ['🛡️', 'Accountable marketplace', 'Verified buyers, ratings, fraud alerts and an audit trail.']];
 return `<section class="wrap sec"><div class="sec-h rv"><span class="kick">Features</span><h2>Built for trust at every step</h2></div><div class="feats">${F.map(f => `<div class="feat rv"><div class="si">${f[0]}</div><div><b>${f[1]}</b><p>${f[2]}</p></div></div>`).join('')}</div></section>`;
}
function lPrices() {
 const q = LF.q.trim().toLowerCase(), rows = MATS.filter(d => (LF.cat == 'All' || d.c == LF.cat) && (!q || d.m.toLowerCase().includes(q)));
 return `<section class="wrap sec" id="prices"><div class="sec-h rv"><span class="kick">Reference prices</span><h2>What your scrap is worth</h2><p>Indicative street and dealer ranges, reviewed ${priceDate()}. Not live prices — every buyer sets their own rate, and the payout uses the verified quantity.</p></div>
 <div class="card"><div class="pt-tools"><input id="lq" type="search" placeholder="Search ${MATS.length} materials…" value="${esc(LF.q)}" data-inp="lf" aria-label="Search materials"></div>
 <div class="chips">${['All', ...CATS].map(c => `<button class="${LF.cat == c ? 'on' : ''}" data-act="lcat" data-c="${c}">${c == 'All' ? 'All' : CAT_ICON[c] + ' ' + c}</button>`).join('')}</div>
 <div class="tw" style="max-height:460px"><table><tr><th>Material</th><th>Category</th><th class="num">Typical range</th><th class="num">Also sold</th></tr>${rows.map(d => `<tr><td>${d.i} ${esc(d.m)}</td><td>${d.c}</td><td class="num"><b>${fmtRate(d.m)}</b></td><td class="num mu">${d.u2 ? fmtRate(d.m, d.u2) : '–'}</td></tr>`).join('') || '<tr><td colspan="4" class="mu" style="text-align:center">No material matches.</td></tr>'}</table></div></div></section>`;
}
function lImpact(s) {
 return `<section class="wrap sec"><div class="impact rv"><div><h2>Environmental impact</h2><p>Based on completed orders. CO₂ savings are estimates using typical recycling factors.</p></div>
 <div class="ist"><div><b class="cu">${r1(s.kg)}</b><span>kg recycled</span></div><div><b class="cu">${r1(s.co2)}</b><span>kg CO₂ saved</span></div><div><b class="cu">${s.n}</b><span>completed orders</span></div></div></div></section>`;
}
function lFinal() {
 return `<section class="wrap sec" id="auth"><div class="final"><div class="copy rv"><span class="kick" style="font-size:12.5px;font-weight:700;letter-spacing:.12em;color:var(--brand)">A SMARTER WAY TO RECYCLE</span><h2>Ready to turn waste into value?</h2><p class="mu" style="font-size:16.5px">Join the marketplace to sell, discover competitive offers, or coordinate reliable pickups. Log in once and we open the right workspace for you: seller, buyer or collector.</p>
 <div class="row" style="margin-top:18px"><button class="btn lg" data-act="auth" data-mode="signup">Create a free account →</button><button class="btn lg s" data-act="auth" data-mode="login">Log in</button></div></div>
 <div class="card authc"><div class="tip">🔒 Secure email login. Your password is encrypted and never visible to anyone.</div><div class="tip">✅ Every buyer and collector is verified before they can work.</div><div class="tip">⚖️ You are paid for the weight measured at your door, not a guess.</div></div></div></section>`;
}
function lFoot() {
 const col = (h, links) => `<div class="fcol"><b>${h}</b>${links.join('')}</div>`;
 const jump = (t, to) => `<a href="#${to}" data-act="jump" data-to="${to}">${t}</a>`;
 const join = (t, r) => `<a href="#auth" data-act="auth" data-mode="signup" data-role="${r}">${t}</a>`;
 return `<footer class="wrap pf"><div class="fgrid"><div class="fbrand"><span class="logo"><span class="mark">♻</span><span>Waste2Worth<small>Waste in. Value out.</small></span></span><p>A recyclables marketplace where verified buyers compete for your scrap and collectors weigh it at your door.</p></div>
 ${col('Marketplace', [jump('How it works', 'how'), jump('Who it’s for', 'roles'), jump('Reference prices', 'prices')])}
 ${col('Get started', [join('Sell your scrap', 'seller'), join('Register as a buyer', 'buyer'), join('Become a collector', 'collector')])}</div>
 <div class="row between fbot"><span>© ${new Date().getFullYear()} Waste2Worth. All rights reserved.</span><span>Prices are indicative references, not live quotes. Hazardous waste is not accepted.</span></div></footer>`;
}

function authForm() {
 const seg = `<div class="seg" role="tablist"><button class="${LMODE == 'login' ? 'on' : ''}" data-act="auth" data-mode="login" data-stay="1">Log in</button><button class="${LMODE == 'signup' ? 'on' : ''}" data-act="auth" data-mode="signup" data-stay="1">Create account</button></div>`;
 if (LMODE == 'login') return `${seg}<form data-form="login"><p class="mu sm-t">Log in with your email. We’ll open the right workspace for your account.</p>
  <label class="f">Email address<input id="le" data-keep type="email" inputmode="email" autocomplete="username" placeholder="you@example.com" required></label>
  <label class="f">Password<input id="lp" data-keep type="password" autocomplete="current-password" required></label>
  <div class="err" role="alert">${esc(authMsg)}</div><button class="btn w lg" id="goBtn">Log in</button>
  <p class="mu sm-t" style="text-align:center;margin:14px 0 0"><a href="#" data-act="forgot">Forgot password?</a></p></form>`;
 if (!TYPES[SROLE]) SROLE = 'seller';
 const L = { seller: ['Your name', 'Pickup address (Locality, City)', 'I am a'], buyer: ['Business name', 'Shop / yard address (Locality, City)', 'Business type'], collector: ['Your name', 'Operating area (Locality, City)', 'Vehicle'] }[SROLE];
 return `${seg}<form data-form="signup"><p class="mu sm-t">What would you like to do?</p><div class="roles-pick">${[['seller', '♻️', 'Sell waste'], ['buyer', '🏪', 'Buy waste'], ['collector', '🚚', 'Collect']].map(([k, i, t]) => `<button type="button" class="${SROLE == k ? 'on' : ''}" data-act="srole" data-r="${k}"><i>${i}</i>${t}</button>`).join('')}</div>
  <label class="f">${L[0]}<input id="rn" data-keep autocomplete="name" required></label>
  <label class="f">Email address<input id="re" data-keep type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" required></label>
  <label class="f">${L[2]}<select id="rt" data-keep>${TYPES[SROLE].map(x => `<option>${x}</option>`).join('')}</select></label>
  <label class="f">${L[1]}<div class="inline-btn" style="margin-top:6px"><input id="ra" data-keep placeholder="Korlagunta, Tirupati" required><button type="button" class="btn s" data-act="locate" data-to="ra" aria-label="Use my location">📍</button></div></label>
  <label class="f">Password (min 6 characters)<input id="rw" data-keep type="password" autocomplete="new-password" minlength="6" required></label>
  ${SROLE == 'buyer' ? '<p class="mu xs">New buyer businesses are reviewed by our team before they can bid. This usually takes less than a day.</p>' : SROLE == 'collector' ? '<p class="mu xs">New collectors are reviewed by our team before they can accept pickups. This usually takes less than a day.</p>' : ''}
  <div class="err" role="alert">${esc(authMsg)}</div><button class="btn w lg" id="goBtn">Create account</button>
  <p class="mu xs" style="text-align:center;margin:12px 0 0">By creating an account you agree to use Waste2Worth only for lawful, non-hazardous recyclables.</p></form>`;
}
function setAuthMsg(m) { authMsg = m; const e = $('#landing .err'); if (e) e.textContent = m }
async function doLogin() {
 const email = $('#le').value.trim().toLowerCase(), password = $('#lp').value, b = $('#goBtn');
 setAuthMsg(''); b.disabled = true; b.textContent = 'Logging in…';
 const { data, error } = await sb.auth.signInWithPassword({ email, password });
 b.disabled = false; b.textContent = 'Log in';
 if (error) return setAuthMsg(/confirm/i.test(error.message) ? 'Please confirm your email first (check your inbox).' : 'Wrong email or password.');
 authMsg = ''; AUTHPAGE = false; history.replaceState(null, '', location.pathname); enter(data.user);
}
async function doSignup() {
 const name = $('#rn').value.trim(), email = $('#re').value.trim().toLowerCase(), password = $('#rw').value, area = $('#ra') ? $('#ra').value.trim() : '', type = $('#rt') ? $('#rt').value : '';
 if (!name) return setAuthMsg('Enter your name');
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setAuthMsg('Enter a valid email address');
 if (!area) return setAuthMsg('Enter your address as Locality, City');
 if (password.length < 6) return setAuthMsg('Password needs at least 6 characters');
 if (!TYPES[SROLE]) SROLE = 'seller';
 const b = $('#goBtn'); b.disabled = true; b.textContent = 'Creating account…'; setAuthMsg('');
 const { data, error } = await sb.auth.signUp({ email, password, options: { data: { role: SROLE, name, type, area } } });
 b.disabled = false; b.textContent = 'Create account';
 if (error) return setAuthMsg(error.message);
 if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) return setAuthMsg('This email is already registered. Please log in.');
 if (!data.session) { LMODE = 'login'; authMsg = ''; renderLanding(); $('#le').value = email; return setAuthMsg('Account created! Check your inbox to confirm your email, then log in.') }
 authMsg = ''; AUTHPAGE = false; history.replaceState(null, '', location.pathname); enter(data.user);
}
async function forgot() {
 const email = ($('#le')?.value || '').trim(); if (!email) return setAuthMsg('Type your email above first');
 const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
 setAuthMsg(error ? error.message : 'Password reset link sent. Check your inbox.');
}
let rvO = null;
function revealInit() {
 if (!window.IntersectionObserver || RM.matches) { $$('.rv').forEach(e => e.classList.add('v')); return }
 if (!rvO) rvO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('v'); rvO.unobserve(e.target) } }), { threshold: .12 });
 $$('#landing .rv:not(.v)').forEach(e => rvO.observe(e));
}
