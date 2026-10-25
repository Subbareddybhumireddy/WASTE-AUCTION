// =========================================================
// Waste2Worth — app logic
// localStorage keys used: w2w_location, w2w_listings, w2w_stock,
// w2w_purchases, w2w_demand (existing) + w2w_theme (dark mode).
// =========================================================

// Use only the ANON (publishable) key here — never the service_role key.
const SUPABASE_URL='https://elnvrseohlokdpqcgdzc.supabase.co', SUPABASE_KEY='sb_publishable_JW2jdBEoACoNNSc0BQa1HA_v6jFDeg0';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr=n=>'₹'+Math.round(+n||0).toLocaleString('en-IN');
const RM=matchMedia('(prefers-reduced-motion: reduce)');
const cssv=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const AUCTION_DAYS=3;
let mode='login',role='sell',img='',blob=null,an=null,area='',hist=[],user=null,profile=null,all=[];
let loaded=false,counted=false,lastFocus=null;
const names={}; // seller_id -> display name (from profiles, if readable)
const F={cat:'All',q:'',near:false,type:'all',sort:'new'};

// ---------- theme (dark mode) ----------
function setTheme(t,save){
 document.documentElement.dataset.theme=t;
 if(save)try{localStorage.setItem('w2w_theme',t)}catch{}
 $$('[data-theme-toggle]').forEach(b=>b.setAttribute('aria-label',t=='dark'?'Switch to light mode':'Switch to dark mode'));
 const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t=='dark'?'#0e1411':'#14573b';
 if(user)renderBuy(); // recolour charts
}
setTheme(document.documentElement.dataset.theme||'light',false);
$$('[data-theme-toggle]').forEach(b=>b.onclick=()=>setTheme(document.documentElement.dataset.theme=='dark'?'light':'dark',true));
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',e=>{let s=null;try{s=localStorage.getItem('w2w_theme')}catch{}if(!s)setTheme(e.matches?'dark':'light',false)});

// ---------- categories ----------
const CATS=[['All','✦'],['Metal','⚙️'],['Plastic','🧴'],['Paper','📦'],['E-waste','💻'],['Glass','🍾'],['Other','♻️']];
const ICON=Object.fromEntries(CATS), CLS={Metal:'metal',Plastic:'plastic',Paper:'paper','E-waste':'ewaste',Glass:'glass',Other:'other'};
function cat(t){t=String(t||'').toLowerCase();
 if(/alumin|copper|brass|iron|steel|metal|tin|can\b|cans|wire/.test(t))return'Metal';
 if(/plastic|pet|bottle|hdpe|polythene|poly/.test(t))return'Plastic';
 if(/paper|cardboard|carton|newspaper|book|magazine/.test(t))return'Paper';
 if(/e-waste|electronic|laptop|phone|computer|circuit|cable|charger|tv|monitor/.test(t))return'E-waste';
 if(/glass|jar/.test(t))return'Glass';return'Other'}

// ---------- auth ----------
$('#sw').onclick=e=>{e.preventDefault();mode=mode=='login'?'signup':'login';const s=mode=='signup';$('#nm').hidden=$('#rl').hidden=!s;
 $('#go').textContent=s?'Create account':'Log in';$('#sw').textContent=s?'I already have an account':'Create an account';
 $('#ah').textContent=s?'Create your account':'Welcome back';$('#sub').textContent=s?'Takes less than a minute.':'Log in to sell or buy waste.';$('#er').textContent=''};
seg('#rseg',v=>role=v);
$('#af').onsubmit=async e=>{e.preventDefault();$('#er').textContent='';const email=$('#e').value.trim(),password=$('#p').value,go=$('#go');go.disabled=true;
 try{if(mode=='signup'){const {data,error}=await db.auth.signUp({email,password});if(error)return $('#er').textContent=error.message;
   if(!data.session)return $('#er').textContent='Check your email to confirm, or turn off "Confirm email" in Supabase.';
   const name=$('#n').value.trim()||email.split('@')[0];await db.from('profiles').insert({id:data.user.id,name,role});start(data.user,{name,role},true)}
  else{const {data,error}=await db.auth.signInWithPassword({email,password});if(error)return $('#er').textContent='Wrong email or password.';enter(data.user)}}
 finally{go.disabled=false}};
async function enter(u){const {data}=await db.from('profiles').select('*').eq('id',u.id).maybeSingle();start(u,data||{name:u.email.split('@')[0],role:'sell'},false)}
function start(u,p,fresh){user=u;profile=p;$('#auth').hidden=true;$('#app').hidden=$('#fab').hidden=false;
 $('#who').textContent=p.name;$('#wmail').textContent=u.email;showAvatar();
 toast((fresh?'Welcome, ':'Welcome back, ')+p.name+'! 👋');locate();
 if(!location.hash)location.hash=p.role=='buy'?'#market':'#home';else route();refresh()}
$('#avb').onclick=e=>{e.stopPropagation();$('#dd').hidden=!$('#dd').hidden};document.addEventListener('click',()=>$('#dd').hidden=true);
$('#out').onclick=async()=>{await db.auth.signOut();location.hash='';location.reload()};

// ---------- routing ----------
const PAGES=['home','market','buy','sell','mine'];
// All pages are shown stacked vertically; menu links scroll to each section.
function setNav(p){$$('#nav a,#bnav a').forEach(a=>{const on=a.dataset.p==p;a.classList.toggle('on',on);on?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current')})}
function route(){if(!user)return;const p=PAGES.includes(location.hash.slice(1))?location.hash.slice(1):'home';
 $$('.page').forEach(x=>x.hidden=false);setNav(p);
 document.getElementById(p)?.scrollIntoView({behavior:RM.matches?'auto':'smooth',block:'start'})}
addEventListener('hashchange',route);
$$('#nav a,#bnav a').forEach(a=>a.addEventListener('click',()=>{if(location.hash=='#'+a.dataset.p)route()})); // re-click scrolls again
// Highlight the menu item for the section currently on screen
const navObs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting)setNav(e.target.id)})},{rootMargin:'-40% 0px -55% 0px'});
$$('.page').forEach(s=>navObs.observe(s));

// ---------- data ----------
async function refresh(){const {data,error}=await db.from('listings').select('*').order('created_at',{ascending:false}).limit(500);
 if(error){toast(error.message);all=[]}else all=(data||[]).map(x=>({...x,cat:cat(x.waste_type||x.title),btype:bType(x.waste_type||x.title)}));
 loaded=true;render();loadNames()}
// Seller names for marketplace cards. Silently skipped if profiles are not readable.
async function loadNames(){const ids=[...new Set(all.map(x=>x.seller_id).filter(id=>id&&id!=user.id&&!(id in names)))];if(!ids.length)return;
 try{const {data}=await db.from('profiles').select('id,name').in('id',ids);(data||[]).forEach(p=>names[p.id]=p.name);if(data?.length)render()}catch{}}
const isAuction=x=>x.sale_type=='auction', active=x=>(x.status||'active')=='active';
const endsAt=x=>new Date(x.created_at).getTime()+AUCTION_DAYS*864e5;
function left(x){const ms=endsAt(x)-Date.now();if(ms<=0)return'Ended';const h=Math.floor(ms/36e5),m=Math.floor(ms%36e5/6e4);return h>=24?`Ends in ${Math.floor(h/24)}d ${h%24}h`:`Ends in ${h}h ${m}m`}
function ago(d){const s=(Date.now()-new Date(d))/1e3;return s<60?'just now':s<3600?Math.floor(s/60)+' min ago':s<86400?Math.floor(s/3600)+' h ago':Math.floor(s/86400)+' d ago'}
const city=a=>String(a||'').split(',').pop().trim().toLowerCase();
const nearMe=x=>area&&x.area&&(city(x.area)==city(area)||x.area==area);
const nearUser=a=>{const me=area||savedLoc();return!!(me&&a&&city(a)==city(me))};

function render(skipBuy){if(!user)return;
 renderHome();renderMarket();if(!skipBuy)renderBuy();renderMine()}

// ---------- shared card pieces ----------
const skel=n=>Array(n).fill('<div class="card item skel" aria-hidden="true"><div class="ph"></div><div class="bd"><div class="sk" style="width:75%"></div><div class="sk" style="width:50%"></div><div class="sk" style="width:60%"></div><div class="sk" style="width:35%;height:22px;margin-top:14px"></div></div></div>').join('');
const BADGE={hot:'<span class="badge hot">🔥 Hot demand</span>',near:'<span class="badge near">📍 Near you</span>'};
function hotTypes(){const d=demand();return new Set([...BTYPES].sort((a,b)=>(d[b]||0)-(d[a]||0)).slice(0,3))}
function stars(r,n){const k=Math.round(r);return `<span class="stars" role="img" aria-label="Rated ${r.toFixed(1)} out of 5 from ${n} reviews"><i aria-hidden="true">${'★'.repeat(k)}${'☆'.repeat(5-k)}</i><span aria-hidden="true">${r.toFixed(1)}</span></span>`}
function sellerRow(name,{r,n,v,own}={}){
 return `<div class="seller"><span class="ini" aria-hidden="true">${esc(String(name||'?')[0].toUpperCase())}</span><span class="nm">${esc(name)}</span>`+
  (v?'<span class="vf" role="img" aria-label="Verified seller" title="Verified seller"><svg aria-hidden="true"><use href="#i-check"/></svg></span>':'')+
  (own?'':r?stars(r,n):'<span class="stars"><span class="new">New seller</span></span>')+'</div>'}
const tile=x=>x.btype&&x.btype!='Other'?BCLS[x.btype]:CLS[x.cat];
const icon=x=>x.btype&&x.btype!='Other'?BICON[x.btype]:ICON[x.cat];

function card(x,_mine,hot){const sold=!active(x),auc=isAuction(x),own=x.seller_id==user.id,b=[];hot=hot||hotTypes();
 if(sold)b.push('<span class="badge sold">Sold</span>');
 else{b.push(auc?'<span class="badge live">Live auction</span>':'<span class="badge">Buy now</span>');if(hot.has(x.btype))b.push(BADGE.hot);if(nearMe(x))b.push(BADGE.near)}
 return `<article class="card item" data-id="${esc(x.id)}" tabindex="0" aria-label="${esc(x.title)}, ${inr(x.price)}">
 <div class="ph c-${tile(x)}">${x.photo_url?`<img src="${esc(x.photo_url)}" alt="" loading="lazy" decoding="async">`:`<span aria-hidden="true">${icon(x)}</span>`}<div class="badges">${b.join('')}</div></div>
 <div class="bd"><h3>${esc(x.title)}</h3><div class="muted">${esc(x.btype!='Other'?x.btype:x.cat)} · ${esc(+x.weight_kg)} kg</div>
 ${sellerRow(own?'You':names[x.seller_id]||'Local seller',{own})}
 <div class="ft"><span class="price">${inr(x.price)}</span><small>${sold?ago(x.created_at):auc?left(x):x.area?'📍 '+esc(x.area.split(',')[0]):ago(x.created_at)}</small></div></div></article>`}

// ---------- home ----------
function renderHome(){const act=all.filter(active),sold=all.filter(x=>!active(x)),kg=all.reduce((s,x)=>s+(+x.weight_kg||0),0),
 paid=sold.reduce((s,x)=>s+(+x.price||0),0)||act.reduce((s,x)=>s+(+x.price||0),0);
 $('#cRsL').textContent=sold.length?'₹ earned by sellers':'₹ value listed';
 counters(kg,paid,act.length);
 if(!loaded){$('#near').innerHTML=skel(4);heroCard(null);return}
 const n=act.filter(nearMe),list=(n.length?n:act).slice(0,4),hot=hotTypes();$('#nearSub').textContent=n.length?'Listings in '+area.split(',').pop().trim():'Fresh listings from local sellers';
 $('#near').innerHTML=list.length?list.map(x=>card(x,false,hot)).join(''):'<div class="card empty"><div class="big">♻️</div><p>No listings yet.</p><a class="btn" href="#sell">Be the first to sell</a></div>';
 heroCard(act.find(x=>x.photo_url)||null)}
function heroCard(e){const h=$('#heroEst');
 if(an&&!an.hazardous){const c=cat(an.waste_type);h.innerHTML=`<div class="ph c-${CLS[c]}">${img?`<img src="${img}" alt="">`:ICON[c]}</div><div class="bd"><span class="tag">Your last AI estimate</span><h3>${esc(an.waste_type)}</h3><div class="muted">Condition: ${esc(an.condition)}</div><div class="price">${inr(an.price_per_kg_min)}–${inr(an.price_per_kg_max)} <span class="unit">/ kg</span></div></div>`;return}
 if(e){h.innerHTML=`<div class="ph c-${tile(e)}"><img src="${esc(e.photo_url)}" alt=""></div><div class="bd"><span class="tag">Just listed</span><h3>${esc(e.title)}</h3><div class="muted">${esc(+e.weight_kg)} kg · ${isAuction(e)?'Auction':'Buy now'}</div><div class="price">${inr(e.price)}</div></div>`;return}
 h.innerHTML=`<div class="ph c-plastic">🧴</div><div class="bd"><span class="tag">AI estimate</span><h3>Mixed plastic</h3><div class="muted">Snap a photo to get yours</div><div class="price">₹18–24 <span class="unit">/ kg</span></div></div>`}
// Count up once, the first time real numbers are available.
function counters(kg,rs,act){const els=[['#cKg',kg,v=>Math.round(v).toLocaleString('en-IN')+' kg'],['#cRs',rs,inr],['#cAct',act,v=>Math.round(v).toLocaleString('en-IN')]];
 if(!loaded){els.forEach(([s])=>$(s).textContent='—');return}
 if(counted||RM.matches){counted=true;els.forEach(([s,v,f])=>$(s).textContent=f(v));return}
 counted=true;const t0=performance.now(),D=1400;
 const step=t=>{const p=Math.min(1,(t-t0)/D),k=1-Math.pow(1-p,3);els.forEach(([s,v,f])=>$(s).textContent=f(v*k));if(p<1)requestAnimationFrame(step)};
 requestAnimationFrame(step)}

// ---------- marketplace ----------
function chipRow(sel){return['All',...BTYPES].map(t=>`<button type="button" class="chip${sel==t?' on':''}" data-c="${t}" aria-pressed="${sel==t}"><span class="ci" aria-hidden="true">${t=='All'?'✦':BICON[t]}</span>${t=='All'?'All materials':t}</button>`).join('')}
function syncChips(box,isOn){$$(box+' .chip').forEach(b=>{const on=isOn(b);b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)})}
const FILTERS=[['near','📍 Near me'],['auction','🔨 Auction'],['fixed','🏷 Buy now'],['new','🕒 Newest'],['low','₹ Price: low'],['ending','⏳ Ending soon']];
function renderMarket(){
 syncChips('#cats',b=>b.dataset.c==F.cat);
 syncChips('#filters',b=>{const k=b.dataset.f;return k=='near'?F.near:k=='auction'||k=='fixed'?F.type==k:F.sort==k});
 if(!loaded){$('#count').textContent='Loading listings…';$('#mgrid').innerHTML=skel(8);return}
 const q=F.q.toLowerCase();let l=all.filter(x=>active(x)&&(F.cat=='All'||x.btype==F.cat)&&(F.type=='all'||x.sale_type==F.type)&&(!F.near||nearMe(x))
  &&(!q||[x.title,x.waste_type,x.area,x.cat,x.btype].join(' ').toLowerCase().includes(q)));
 if(F.sort=='low')l.sort((a,b)=>a.price-b.price);if(F.sort=='ending')l=l.filter(isAuction).sort((a,b)=>endsAt(a)-endsAt(b));
 $('#count').textContent=`${l.length} listing${l.length==1?'':'s'}${F.cat!='All'?' in '+F.cat:''}${F.near&&area?' near '+area:''}`;
 const hot=hotTypes();
 $('#mgrid').innerHTML=l.length?l.map(x=>card(x,false,hot)).join(''):`<div class="card empty"><div class="big">🔍</div><p>${F.near&&!area?'Allow location access to see listings near you.':'Nothing matches those filters. Try another search or category.'}</p></div>`}
$('#cats').onclick=e=>{const b=e.target.closest('[data-c]');if(b){F.cat=b.dataset.c;renderMarket()}};
$('#filters').onclick=e=>{const k=e.target.closest('[data-f]')?.dataset.f;if(!k)return;
 if(k=='near')F.near=!F.near;else if(k=='auction'||k=='fixed')F.type=F.type==k?'all':k;else F.sort=k;renderMarket()};
$('#q').oninput=e=>{F.q=e.target.value;renderMarket()};

function renderMine(){if(!loaded){$('#mineSub').textContent='Loading…';$('#mygrid').innerHTML=skel(3);return}
 const l=all.filter(x=>x.seller_id==user.id),a=l.filter(active),hot=hotTypes();
 $('#mineSub').textContent=l.length?`${a.length} active · ${l.length-a.length} sold · ${inr(a.reduce((s,x)=>s+(+x.price||0),0))} listed`:'';
 $('#mygrid').innerHTML=l.length?l.map(x=>card(x,true,hot)).join(''):'<div class="card empty"><div class="big">📷</div><p>You have not listed anything yet.</p><a class="btn" href="#sell">Sell your first item</a></div>'}

// ---------- buy waste ----------
const BTYPES=['Plastic','Paper','Iron','Metal','Cardboard','Glass','E-waste','Cloth'];
const BICON={Plastic:'🧴',Paper:'📰',Iron:'🔩',Metal:'⚙️',Cardboard:'📦',Glass:'🍾','E-waste':'💻',Cloth:'👕',Other:'♻️'};
const BCLS={Plastic:'plastic',Paper:'paper',Iron:'metal',Metal:'metal',Cardboard:'paper',Glass:'glass','E-waste':'ewaste',Cloth:'other',Other:'other'};
// Chart colours are fixed per type (never by rank). Dark set is checked against the dark card surface.
const BCOL={Plastic:'#2a78d6',Cardboard:'#eb6834',Glass:'#1baf7a',Paper:'#eda100','E-waste':'#e87ba4',Cloth:'#008300',Metal:'#6250d6',Iron:'#e34948',Other:'#8a8a85'};
const BCOL_DARK={...BCOL,Cardboard:'#d65a24',Paper:'#c48600','E-waste':'#d0628d',Metal:'#6f5ee0'};
const col=t=>(document.documentElement.dataset.theme=='dark'?BCOL_DARK:BCOL)[t]||BCOL.Other;
// r = rating, n = reviews, v = verified (sample data)
const SAMPLE_LISTINGS=[
 {id:'s1',title:'Clean PET bottles',type:'Plastic',ppk:18,kg:120,seller:'Ravi Kumar',area:'Koramangala, Bengaluru',r:4.8,n:126,v:true},
 {id:'s2',title:'Old newspapers',type:'Paper',ppk:14,kg:80,seller:'Anita Sharma',area:'Andheri, Mumbai',r:4.6,n:58,v:true},
 {id:'s3',title:'Iron rods and sheets',type:'Iron',ppk:32,kg:250,seller:'Mohan Steel Works',area:'Peenya, Bengaluru',r:4.9,n:312,v:true},
 {id:'s4',title:'Aluminium cans',type:'Metal',ppk:105,kg:40,seller:'Fatima Shaikh',area:'Banjara Hills, Hyderabad',r:4.7,n:41,v:false},
 {id:'s5',title:'Flattened cardboard boxes',type:'Cardboard',ppk:10,kg:300,seller:'QuickMart Stores',area:'Saket, New Delhi',r:4.5,n:203,v:true},
 {id:'s6',title:'Mixed glass bottles',type:'Glass',ppk:3,kg:150,seller:'Joseph D\'Souza',area:'Panaji, Goa',r:4.3,n:19,v:false},
 {id:'s7',title:'Old laptops and chargers',type:'E-waste',ppk:85,kg:25,seller:'Priya Nair',area:'Kakkanad, Kochi',r:4.8,n:77,v:true},
 {id:'s8',title:'Cotton cloth scraps',type:'Cloth',ppk:12,kg:60,seller:'Lakshmi Tailors',area:'T. Nagar, Chennai',r:4.6,n:64,v:true},
 {id:'s9',title:'HDPE containers',type:'Plastic',ppk:24,kg:0,seller:'Green Hands NGO',area:'Kothrud, Pune',r:4.9,n:150,v:true},
 {id:'s10',title:'Copper wire offcuts',type:'Metal',ppk:620,kg:12,seller:'Arjun Electricals',area:'Salt Lake, Kolkata',r:4.4,n:33,v:false}];
const SAMPLE_DEMAND={Plastic:520,Cardboard:430,Paper:360,Metal:300,Iron:260,'E-waste':210,Glass:140,Cloth:90};
const WEEK_BASE=[58,72,80,76,88,95,66]; // sample kg wanted per weekday, Sun..Sat
const LOW_KG=30; // "Only X kg left" threshold
const BF={q:'',type:'All',sort:'demand'},charts={};let pBy='kg';
const inr2=n=>'₹'+(+n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const fmtKg=n=>(+n||0).toLocaleString('en-IN',{maximumFractionDigits:1})+' kg';
const pct=(v,s)=>Math.round(v/(s||1)*100)+'%';
function lsGet(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
function savedLoc(){let v='';try{v=localStorage.getItem('w2w_location')||''}catch{}
 try{const j=JSON.parse(v);if(typeof j=='string')v=j;else if(j&&typeof j=='object')v=j.area||j.city||j.name||''}catch{}return v}
function bType(t){t=String(t||'').toLowerCase();
 if(/cardboard|carton|corrugated/.test(t))return'Cardboard';
 if(/e-waste|ewaste|electronic|laptop|phone|computer|circuit|charger|monitor|\btv\b/.test(t))return'E-waste';
 if(/glass|jar/.test(t))return'Glass';
 if(/iron|steel/.test(t))return'Iron';
 if(/alumin|copper|brass|metal|\btin\b|\bcans?\b|wire/.test(t))return'Metal';
 if(/plastic|\bpet\b|hdpe|bottle|polythene|poly/.test(t))return'Plastic';
 if(/paper|newspaper|book|magazine/.test(t))return'Paper';
 if(/cloth|textile|fabric|cotton|garment|clothes|saree/.test(t))return'Cloth';
 return'Other'}
const demand=()=>{const d=lsGet('w2w_demand',null);return{...SAMPLE_DEMAND,...(d&&typeof d=='object'?d:{})}};
const allBuys=()=>{const p=lsGet('w2w_purchases',[]);return Array.isArray(p)?p.filter(x=>x&&typeof x=='object'):[]};
const myBuys=()=>allBuys().filter(x=>x.buyer==user.id);
// the user's own listings (Supabase + localStorage "w2w_listings") are shown but cannot be bought
function ownListings(){
 const fromDb=all.filter(x=>x.seller_id==user.id&&active(x)).map(x=>({id:'db-'+x.id,title:x.title,type:bType(x.waste_type||x.title),ppk:(+x.price||0)/(+x.weight_kg||1),kg:+x.weight_kg||0,seller:profile?.name||'You',area:x.area||'',photo:x.photo_url||'',own:true}));
 const ls=lsGet('w2w_listings',[]);
 const fromLs=(Array.isArray(ls)?ls:[]).filter(x=>x&&typeof x=='object').map((x,i)=>{const kg=+(x.kg??x.weight_kg??x.weight)||0;
  return{id:'ls-'+(x.id??i),title:x.title||x.name||'My listing',type:bType(x.type||x.category||x.waste_type||x.title||x.name),ppk:+(x.pricePerKg??x.price_per_kg??x.ppk)||(+x.price||0)/(kg||1),kg,seller:x.seller||profile?.name||'You',area:x.area||x.location||'',photo:x.photo||x.image||x.img||x.photo_url||'',own:true}});
 return[...fromDb,...fromLs]}

function renderBuy(){const stock=lsGet('w2w_stock',{}),dem=demand(),q=BF.q.trim().toLowerCase(),mine=myBuys(),hot=hotTypes();
 $('#loc4').textContent='📍 '+(area||savedLoc()||'Your city');
 syncChips('#bcats',b=>b.dataset.c==BF.type);
 const S={demand:(a,b)=>(dem[b.type]||0)-(dem[a.type]||0),low:(a,b)=>a.ppk-b.ppk,high:(a,b)=>b.ppk-a.ppk,stock:(a,b)=>b.kg-a.kg};
 const l=[...SAMPLE_LISTINGS.map(x=>({...x,kg:x.id in stock?+stock[x.id]:x.kg})),...ownListings()]
  .filter(x=>(BF.type=='All'||x.type==BF.type)&&(!q||[x.title,x.type,x.seller,x.area].join(' ').toLowerCase().includes(q)))
  .sort((a,b)=>(a.kg<=0)-(b.kg<=0)||S[BF.sort](a,b)); // sold out always last
 $('#bcount').textContent=`${l.length} listing${l.length==1?'':'s'}${BF.type!='All'?' in '+BF.type:''}`;
 $('#bgrid').innerHTML=l.length?l.map(x=>bCard(x,hot)).join(''):'<div class="card empty"><div class="big">🔍</div><p>No waste matches that search. Try another type.</p></div>';
 $('#nochart').hidden=!!window.Chart;renderOrders(mine);renderDemand(dem);renderWeek();renderMyBuys(mine);renderHistory(mine)}

function bCard(x,hot){const out=x.kg<=0,dis=out||x.own,id=esc(x.id),b=[];
 if(out)b.push('<span class="badge sold">Sold out</span>');
 else{if(x.own)b.push('<span class="badge own">Your listing</span>');if(hot.has(x.type))b.push(BADGE.hot);
  if(x.kg<=LOW_KG)b.push(`<span class="badge low">Only ${fmtKg(x.kg)} left</span>`);if(nearUser(x.area))b.push(BADGE.near)}
 return `<article class="card bcard"><div class="ph c-${BCLS[x.type]}">${x.photo?`<img src="${esc(x.photo)}" alt="" loading="lazy" decoding="async">`:`<span aria-hidden="true">${BICON[x.type]}</span>`}<div class="badges">${b.join('')}</div></div>
 <div class="bd"><h3>${esc(x.title)}</h3><div class="muted">${BICON[x.type]} ${esc(x.type)}</div>${x.area?`<div class="loc-line">📍 ${esc(x.area)}</div>`:''}
 ${sellerRow(x.seller,{r:x.r,n:x.n,v:x.v,own:x.own})}
 <div class="ft"><span class="price">${inr2(x.ppk)}<span class="unit"> / kg</span></span><small>${out?'0 kg left':fmtKg(x.kg)+' available'}</small></div>
 <form class="buyf" data-id="${id}" novalidate><label class="sr" for="bq-${id}">Quantity in kg for ${esc(x.title)}</label>
 <input id="bq-${id}" type="number" inputmode="decimal" min="0.1" step="0.1"${out?'':` max="${x.kg}"`} placeholder="kg"${dis?' disabled':''}>
 <button class="btn sm"${dis?' disabled':''}>${out?'Sold out':x.own?'Your listing':'Buy now'}</button></form>
 <div class="err" role="alert"></div></div></article>`}

$('#bgrid').addEventListener('submit',e=>{e.preventDefault();const f=e.target.closest('.buyf');if(!f)return;
 const x=SAMPLE_LISTINGS.find(s=>s.id==f.dataset.id),err=f.nextElementSibling,inp=f.querySelector('input');err.textContent='';
 if(!x)return err.textContent='You cannot buy your own listing.';
 const stock=lsGet('w2w_stock',{}),left=x.id in stock?+stock[x.id]:x.kg,q=Math.round(parseFloat(inp.value)*10)/10;
 if(left<=0)return err.textContent='This listing is sold out.';
 if(!isFinite(q)||q<=0){err.textContent='Enter how many kg you want (at least 0.1 kg).';return inp.focus()}
 if(q>left){err.textContent=`Only ${fmtKg(left)} available.`;return inp.focus()}
 const total=Math.round(q*x.ppk*100)/100;
 if(!confirm(`Buy ${fmtKg(q)} of ${x.title} from ${x.seller} for ${inr2(total)}?`))return;
 const p=lsGet('w2w_purchases',[]),list=Array.isArray(p)?p:[],dem=demand();
 stock[x.id]=Math.round((left-q)*10)/10;dem[x.type]=(dem[x.type]||0)+q;
 const rec={id:Date.now().toString(36),buyer:user.id,date:new Date().toISOString(),listing:x.id,item:x.title,type:x.type,qty:q,ppk:x.ppk,total,seller:x.seller,stage:1};
 list.push(rec);
 if(!(lsSet('w2w_stock',stock)&&lsSet('w2w_purchases',list)&&lsSet('w2w_demand',dem)))return toast('Could not save. Your browser is blocking storage.');
 toast(`Bought ${fmtKg(q)} of ${x.title} for ${inr2(total)} 🎉`);renderBuy();showSuccess(rec)});
$('#bq').oninput=e=>{BF.q=e.target.value;renderBuy()};
$('#bcats').innerHTML=chipRow(BF.type);
$('#cats').innerHTML=chipRow(F.cat);
$('#filters').innerHTML=FILTERS.map(([k,l])=>`<button type="button" class="chip" data-f="${k}" aria-pressed="false">${l}</button>`).join('');
$('#bcats').onclick=e=>{const b=e.target.closest('[data-c]');if(b){BF.type=b.dataset.c;renderBuy()}};
$('#bsort').onchange=e=>{BF.sort=e.target.value;renderBuy()};
seg('#pseg',v=>{pBy=v;renderMyBuys(myBuys())});

// ---------- order tracking ----------
const STAGES=['Listed','Booked','Picked up','Paid'];
const stageOf=x=>Math.min(3,Math.max(1,+x.stage||1)); // older purchases start at "Booked"
const track=st=>`<ol class="track" aria-label="Order progress: ${STAGES[st]}">${STAGES.map((s,i)=>`<li class="${i<=st?'done':i==st+1?'next':''}"${i==st?' aria-current="step"':''}><span class="dot" aria-hidden="true">${i<=st?'✓':i+1}</span>${s}</li>`).join('')}</ol>`;
function renderOrders(list){const r=[...list].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6);$('#ordersCard').hidden=!r.length;
 $('#orders').innerHTML=r.map(x=>{const st=stageOf(x),nxt=st==1?'Mark as picked up':st==2?'Mark as paid':'';
  return `<div class="order"><div class="ot"><b>${BICON[x.type]||'♻️'} ${esc(x.item)}</b><span class="muted">${fmtKg(x.qty)} · ${inr2(x.total)}${x.seller?' · from '+esc(x.seller):''} · ${new Date(x.date).toLocaleDateString('en-IN',{dateStyle:'medium'})}</span></div>`+
   (nxt?`<button type="button" class="btn sm o" data-adv="${esc(x.id||x.date)}">${nxt}</button>`:'<span class="badge near">✓ Completed</span>')+track(st)+'</div>'}).join('')}
$('#orders').onclick=e=>{const b=e.target.closest('[data-adv]');if(!b)return;const p=lsGet('w2w_purchases',[]);if(!Array.isArray(p))return;
 const r=p.find(x=>x&&x.buyer==user.id&&(x.id||x.date)==b.dataset.adv);if(!r)return;r.stage=stageOf(r)+1;
 if(!lsSet('w2w_purchases',p))return toast('Could not save. Your browser is blocking storage.');
 toast(r.stage==3?'Payment recorded — order complete ✅':'Marked as picked up 🚚');renderBuy()};

function showSuccess(r){
 const conf=RM.matches?'':`<div class="confetti" aria-hidden="true">${Array.from({length:18},(_,i)=>`<i style="left:${(i*37+7)%100}%;background:${['#14573b','#f5b451','#5cc795','#b45309'][i%4]};animation-delay:${(i%6)*70}ms"></i>`).join('')}</div>`;
 $('#ov').innerHTML=`<div class="card success">${conf}<svg class="tick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-15"/></svg>
 <h2 id="ovh">Order booked!</h2><p class="muted">${fmtKg(r.qty)} of ${esc(r.item)} for <b class="price">${inr2(r.total)}</b>. ${esc(r.seller)} will contact you to arrange pickup.</p>${track(r.stage)}
 <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button type="button" class="btn" data-close>Done</button><button type="button" class="btn o" data-close data-goto="ordersCard">Track order</button></div></div>`;
 openOv()}

// ---------- charts ----------
const hexA=(h,a)=>{const n=parseInt(h.replace('#',''),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};
const CENTER={id:'center',afterDraw(c,_a,o){if(!o||!o.value)return;const a=c.chartArea,x=(a.left+a.right)/2,y=(a.top+a.bottom)/2,g=c.ctx;
 g.save();g.textAlign='center';g.textBaseline='middle';g.fillStyle=cssv('--ink');g.font='700 18px Poppins, system-ui, sans-serif';g.fillText(o.value,x,y-9);
 g.fillStyle=cssv('--muted');g.font='500 12px Inter, system-ui, sans-serif';g.fillText(o.label,x,y+13);g.restore()}};
if(window.Chart){Chart.defaults.font.family='Inter, system-ui, sans-serif';Chart.defaults.color=cssv('--muted')}
function donut(key,sel,rows,fmt,label){if(!window.Chart)return;const sum=rows.reduce((s,r)=>s+r[1],0);charts[key]?.destroy();
 charts[key]=new Chart($(sel),{type:'doughnut',data:{labels:rows.map(r=>r[0]),datasets:[{data:rows.map(r=>r[1]),backgroundColor:rows.map(r=>col(r[0])),borderColor:cssv('--surface'),borderWidth:2,borderRadius:4,hoverOffset:6}]},
  options:{responsive:true,maintainAspectRatio:false,cutout:'68%',animation:RM.matches?false:{duration:500},
   plugins:{legend:{display:false},center:{value:fmt(sum),label},tooltip:{callbacks:{label:c=>` ${fmt(c.raw)} · ${pct(c.raw,sum)}`}}}},plugins:[CENTER]})}
function renderDemand(dem){const rows=BTYPES.map(t=>[t,+dem[t]||0]).sort((a,b)=>b[1]-a[1]),sum=rows.reduce((s,r)=>s+r[1],0),avg=sum/rows.length;
 $('#dlegend').innerHTML=rows.map(([t,v])=>`<li><i style="background:${col(t)}"></i><span>${BICON[t]} ${t}</span><b>${pct(v,sum)}</b><em class="${v>=avg?'hi':'lo'}">${v>=avg?'High':'Low'}</em></li>`).join('');
 donut('demand','#dchart',rows,fmtKg,'total wanted')}
function renderWeek(){const list=allBuys(),t0=new Date();t0.setHours(0,0,0,0);
 const days=[...Array(7)].map((_,i)=>{const d=new Date(t0);d.setDate(d.getDate()-(6-i));return d});
 const vals=days.map(d=>{const a=d.getTime(),e=new Date(d);e.setDate(e.getDate()+1);const b=e.getTime();
  const kg=list.reduce((s,p)=>{const t=new Date(p.date).getTime();return t>=a&&t<b?s+(+p.qty||0):s},0);return Math.round((WEEK_BASE[d.getDay()]+kg)*10)/10});
 const total=vals.reduce((s,v)=>s+v,0),peak=vals.indexOf(Math.max(...vals));
 $('#wkTotal').textContent=fmtKg(total);$('#wkSub').textContent='busiest: '+days[peak].toLocaleDateString('en-IN',{weekday:'long'});
 if(!window.Chart)return;const brand=cssv('--brand'),muted=cssv('--muted');charts.week?.destroy();
 charts.week=new Chart($('#wchart'),{type:'line',data:{labels:days.map((d,i)=>i==6?'Today':d.toLocaleDateString('en-IN',{weekday:'short'})),
  datasets:[{data:vals,borderColor:brand,borderWidth:2,tension:.35,fill:true,
   backgroundColor:c=>{const a=c.chart.chartArea;if(!a)return'transparent';const g=c.chart.ctx.createLinearGradient(0,a.top,0,a.bottom);g.addColorStop(0,hexA(brand,.22));g.addColorStop(1,hexA(brand,0));return g},
   pointRadius:days.map((_,i)=>i==6?4:0),pointHoverRadius:5,pointBackgroundColor:brand,pointBorderColor:cssv('--surface'),pointBorderWidth:2}]},
  options:{responsive:true,maintainAspectRatio:false,animation:RM.matches?false:{duration:600},interaction:{mode:'index',intersect:false},
   plugins:{legend:{display:false},tooltip:{displayColors:false,callbacks:{label:c=>' '+fmtKg(c.raw)+' wanted'}}},
   scales:{x:{grid:{display:false},border:{display:false},ticks:{color:muted,font:{size:11}}},
    y:{beginAtZero:true,grid:{color:cssv('--line')},border:{display:false},ticks:{color:muted,font:{size:11},maxTicksLimit:4}}}}})}
function renderMyBuys(list){const has=list.length>0;$('#pempty').hidden=has;$('#pwrap').hidden=$('#pseg').hidden=!has;if(!has)return;
 const by={};list.forEach(x=>by[x.type]=(by[x.type]||0)+(pBy=='kg'?+x.qty:+x.total)||0);
 const rows=Object.entries(by).sort((a,b)=>b[1]-a[1]),sum=rows.reduce((s,r)=>s+r[1],0),f=pBy=='kg'?fmtKg:inr2;
 $('#plegend').innerHTML=rows.map(([t,v])=>`<li><i style="background:${col(t)}"></i><span>${BICON[t]||'♻️'} ${esc(t)}</span><b>${f(v)} · ${pct(v,sum)}</b></li>`).join('');
 donut('mine','#pchart',rows,f,pBy=='kg'?'total bought':'total spent')}
function renderHistory(list){const r=[...list].sort((a,b)=>String(b.date).localeCompare(String(a.date))),spent=r.reduce((s,x)=>s+(+x.total||0),0);
 $('#bspent').textContent=r.length?`${r.length} purchase${r.length==1?'':'s'} · ${inr2(spent)} spent`:'';
 $('#bhist').innerHTML=r.length?r.map(x=>`<tr><td>${new Date(x.date).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</td><td>${esc(x.item)}</td><td>${BICON[x.type]||'♻️'} ${esc(x.type)}</td><td class="num">${fmtKg(x.qty)}</td><td class="num">${inr2(x.total)}</td></tr>`).join('')
  :'<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">You have not bought anything yet</td></tr>'}

// ---------- modal ----------
function openOv(){lastFocus=document.activeElement;const o=$('#ov');o.setAttribute('aria-labelledby','ovh');o.hidden=false;
 setTimeout(()=>o.querySelector('[data-close],.btn,button')?.focus(),30)}
function closeOv(){stopCam();$('#ov').hidden=true;if(lastFocus&&lastFocus.isConnected)lastFocus.focus();lastFocus=null}

// ---------- listing detail ----------
document.addEventListener('click',e=>{const c=e.target.closest('.item,.mini');if(c&&c.dataset.id)openItem(c.dataset.id)});
document.addEventListener('keydown',e=>{if(e.key=='Enter'&&e.target.classList?.contains('item'))openItem(e.target.dataset.id);if(e.key=='Escape'&&!$('#ov').hidden)closeOv()});
function openItem(id){const x=all.find(i=>i.id==id);if(!x)return;const mine=x.seller_id==user.id,sold=!active(x);
 $('#ov').innerHTML=`<div class="card"><button class="x" aria-label="Close">×</button><div class="ph c-${tile(x)}">${x.photo_url?`<img src="${esc(x.photo_url)}" alt="">`:icon(x)}<div class="badges"><span class="badge ${sold?'sold':isAuction(x)?'live':''}">${sold?'Sold':isAuction(x)?'Live auction':'Buy now'}</span></div></div>
 <div class="mb"><h2 id="ovh" style="font-size:1.5rem">${esc(x.title)}</h2><div class="muted">${esc(x.cat)}${x.area?' · 📍 '+esc(x.area):''}</div>
 ${sellerRow(mine?'You':names[x.seller_id]||'Local seller',{own:mine})}
 <div style="display:flex;justify-content:space-between;align-items:end;margin:18px 0"><div><div class="muted">${isAuction(x)?'Starting price':'Price'}</div><div class="price" style="font-size:2rem">${inr(x.price)}</div></div><div class="muted" style="text-align:right">${esc(+x.weight_kg)} kg<br>≈ ${inr(x.price/(x.weight_kg||1))}/kg</div></div>
 <dl class="kv"><dt>Sale type</dt><dd>${isAuction(x)?'Auction · '+left(x):'Fixed price'}</dd><dt>Material</dt><dd>${esc(x.waste_type||x.cat)}</dd><dt>Listed</dt><dd>${ago(x.created_at)}</dd></dl>
 <div style="display:flex;gap:10px;margin-top:22px">${mine?(sold?'':`<button class="btn" data-sold="${esc(x.id)}" style="flex:1">✓ Mark as sold</button>`)+`<button class="btn danger" data-del="${esc(x.id)}">Delete</button>`
  :`<button class="btn" style="flex:1" data-ask="${esc(x.id)}">💬 Ask WasteBot about this</button>`}</div></div></div>`;openOv()}
$('#ov').onclick=async e=>{const t=e.target;if(t==$('#ov')||t.closest('.x'))return closeOv();
 const c=t.closest('[data-close]');if(c){const g=c.dataset.goto;closeOv();if(g)$('#'+g)?.scrollIntoView({behavior:RM.matches?'auto':'smooth',block:'start'});return}
 if(t.dataset.sold){const {error}=await db.from('listings').update({status:'sold'}).eq('id',t.dataset.sold);if(error)return toast(error.message);closeOv();toast('Marked as sold 🎉');refresh()}
 if(t.dataset.del){if(!confirm('Delete this listing?'))return;const {error}=await db.from('listings').delete().eq('id',t.dataset.del);if(error)return toast(error.message);closeOv();toast('Listing deleted');refresh()}
 if(t.dataset.ask){const x=all.find(i=>i.id==t.dataset.ask);closeOv();openChat();send(`Is ${inr(x.price)} a fair price for ${x.weight_kg} kg of ${x.title}?`)}};

// ---------- sell ----------
const DROP_EMPTY='<div><div class="big">📷</div><b>Photo of your waste</b><p class="muted">Tap to take a photo or upload from gallery,<br>or drag an image here</p></div>';
$('#drop').onclick=$('#gal').onclick=()=>{$('#ph').removeAttribute('capture');$('#ph').click()};
$('#drop').onkeydown=e=>{if(e.key=='Enter'||e.key==' '){e.preventDefault();$('#drop').click()}};
$('#cam').onclick=()=>takePhoto({facing:'environment',title:'Photo of your waste',input:'#ph'},load);
$('#ph').onchange=e=>e.target.files[0]&&load(e.target.files[0]);
['dragover','dragleave','drop'].forEach(t=>$('#drop').addEventListener(t,e=>{e.preventDefault();$('#drop').classList.toggle('over',t=='dragover');if(t=='drop'&&e.dataTransfer.files[0])load(e.dataTransfer.files[0])}));
// Photo is resized to max 800px and kept as a JPEG data URL (img) plus a blob for upload.
function load(f){const i=new Image();i.onload=()=>{const k=Math.min(1,800/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;
 c.getContext('2d').drawImage(i,0,0,c.width,c.height);img=c.toDataURL('image/jpeg',.8);c.toBlob(b=>blob=b,'image/jpeg',.8);
 $('#drop').innerHTML=`<img src="${img}" alt="Your waste photo"><div class="chg"><span class="btn o sm">Change photo</span><button type="button" class="btn danger sm" id="rmph">🗑 Remove photo</button></div>`;
 $('#rmph').onclick=e=>{e.stopPropagation();resetSell();toast('Photo removed')};analyze()};i.src=URL.createObjectURL(f)}
async function analyze(){const r=$('#res');an=null;$('#form').hidden=true;r.className='card ai';
 r.innerHTML='<span class="tag">AI analysis</span><h3>Looking at your photo…</h3><div class="sk" style="width:70%"></div><div class="sk" style="width:50%"></div><div class="sk" style="width:60%"></div>';
 const pic=img,{data,error}=await db.functions.invoke('ai',{body:{mode:'analyze',image:img}});
 if(img!==pic)return; // photo was removed or changed while the AI was working
 if(error||data?.error){r.innerHTML=`<span class="tag">AI analysis</span><h3>Couldn't analyse</h3><p class="muted">${esc(data?.error||'AI is not set up yet. Deploy the "ai" function in Supabase.')}</p><button class="btn sm" onclick="analyze()">Try again</button>`;return}
 an=data;if(an.hazardous){r.className='card warn';r.innerHTML=`<span class="tag" style="color:var(--danger)">⚠ Hazardous</span><h3>${esc(an.waste_type)}</h3><p>Hazardous waste can't be sold here. Please take it to an authorised collection centre.</p><p class="muted">${esc(an.tip||'')}</p>`;return}
 if(an.waste_type=='Not waste'||an.waste_type=='Unknown'){r.innerHTML='<span class="tag">AI analysis</span><h3>No waste found</h3><p class="muted">Try a clearer, closer photo of the material.</p>';return}
 const c=cat(an.waste_type);r.innerHTML=`<span class="tag">✨ AI analysis</span><h3>${ICON[c]} ${esc(an.waste_type)}</h3><dl class="kv"><dt>Category</dt><dd>${c}</dd><dt>Condition</dt><dd>${esc(an.condition)}</dd><dt>Hazardous</dt><dd>No</dd><dt>Rate</dt><dd class="price">${inr(an.price_per_kg_min)}–${inr(an.price_per_kg_max)} per kg</dd></dl>${an.tip?`<p class="muted" style="margin:12px 0 0">💡 ${esc(an.tip)}</p>`:''}<p class="muted" style="font-size:12px;margin:8px 0 0">Estimate only — real rates vary by city.</p>`;
 $('#ti').value=an.waste_type;$('#form').hidden=false;calc()}
function calc(){if(!an)return;const w=+$('#w').value||0,t=Math.round((an.price_per_kg_min+an.price_per_kg_max)/2*w);$('#rate').textContent=`${w} kg × ${inr((an.price_per_kg_min+an.price_per_kg_max)/2)}/kg`;$('#sug').textContent=inr(t);$('#pr').value=t}
$('#w').oninput=calc;let sale='auction';seg('#mseg',v=>{sale=v;$('#prl').textContent=v=='auction'?'Starting price (₹)':'Your price (₹)'});
$('#pub').onclick=async()=>{const b=$('#pub');if(!(+$('#pr').value>0)||!(+$('#w').value>0))return toast('Add a weight and price');b.disabled=true;b.innerHTML='<span class="spin"></span> Publishing…';
 try{// Upload to Supabase Storage; if that fails, store the photo itself as a data URL.
  let url=img;const path=user.id+'/'+Date.now()+'.jpg',up=blob?await db.storage.from('listing-photos').upload(path,blob,{contentType:'image/jpeg'}):{error:true};
  if(!up.error)url=db.storage.from('listing-photos').getPublicUrl(path).data.publicUrl;
  const ins=await db.from('listings').insert({seller_id:user.id,title:$('#ti').value.trim()||an.waste_type,waste_type:an.waste_type,weight_kg:+$('#w').value,price:+$('#pr').value,sale_type:sale,photo_url:url,area});if(ins.error)throw ins.error;
  resetSell();toast('Listed! 🎉 Buyers nearby can see it now');await refresh();if(location.hash=='#mine')route();else location.hash='#mine'}
 catch(x){toast(x.message)}finally{b.disabled=false;b.textContent='List it now'}};
function resetSell(){img='';blob=null;an=null;$('#ph').value='';$('#form').hidden=true;$('#drop').innerHTML=DROP_EMPTY;
 $('#res').className='card ai';$('#res').innerHTML='<span class="tag">AI analysis</span><h3>Waiting for a photo</h3><p class="muted" style="margin:0">Add a photo and our AI will identify the material and suggest a price.</p>'}

// ---------- camera ----------
// Laptops ignore the file input's "capture" hint and open the file picker,
// so we open a live camera preview instead. Phones without camera access
// in the browser fall back to the input's native camera.
let camStream=null,camDone=null;
const camOK=()=>!!(navigator.mediaDevices?.getUserMedia&&isSecureContext);
function camErr(e){const n=e?.name;return n=='NotAllowedError'||n=='SecurityError'?'Camera permission is blocked. Allow camera access for this site in your browser settings.'
 :n=='NotFoundError'||n=='OverconstrainedError'?'No camera found on this device.':n=='NotReadableError'?'The camera is being used by another app. Close it and try again.':'Could not open the camera.'}
function stopCam(result){camStream?.getTracks().forEach(t=>t.stop());camStream=null;const d=camDone;camDone=null;d?.(result??null)}
const getCam=facing=>navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:960}},audio:false});
// Opens the camera window. Resolves with a JPEG Blob, or null if cancelled.
function openCamera({facing='environment',title='Take a photo'}={}){return new Promise(async(res,rej)=>{
 try{stopCam();camStream=await getCam(facing)}catch(e){return rej(new Error(camErr(e)))}
 camDone=res;
 $('#ov').innerHTML=`<div class="card camwin"><h2 id="ovh">${esc(title)}</h2><video id="camv" autoplay playsinline muted></video>
  <div class="cam-act"><button type="button" class="btn" id="camShot">📸 Capture</button><button type="button" class="btn o" id="camFlip">🔄 Switch camera</button><button type="button" class="btn o" data-close>Cancel</button></div></div>`;
 const v=$('#camv');v.srcObject=camStream;v.classList.toggle('mirror',facing=='user');openOv();setTimeout(()=>$('#camShot')?.focus(),40);
 $('#camFlip').onclick=async()=>{facing=facing=='user'?'environment':'user';
  try{camStream.getTracks().forEach(t=>t.stop());camStream=await getCam(facing);v.srcObject=camStream;v.classList.toggle('mirror',facing=='user')}
  catch(e){toast('Only one camera available');try{facing=facing=='user'?'environment':'user';camStream=await getCam(facing);v.srcObject=camStream}catch{}}};
 $('#camShot').onclick=()=>{if(!v.videoWidth)return toast('Camera is still starting…');const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;
  const g=c.getContext('2d');if(facing=='user'){g.translate(c.width,0);g.scale(-1,1)}g.drawImage(v,0,0);
  c.toBlob(b=>{stopCam(b);closeOv()},'image/jpeg',.9)}})}
async function takePhoto({facing,title,input},cb){
 if(!camOK()){$(input).setAttribute('capture',facing);$(input).click();return}
 try{const b=await openCamera({facing,title});if(b)cb(b)}catch(e){toast(e.message)}}

// ---------- profile photo ----------
// Saved to Storage + the login account's metadata, so it follows the user to other devices.
// If upload is not allowed, it is kept on this device only.
const avKey=()=>'w2w_avatar_'+user.id;
const myAvatar=()=>user?.user_metadata?.avatar_url||lsGet(avKey(),'')||'';
function showAvatar(){const u=myAvatar(),ini=esc((profile?.name||'?')[0].toUpperCase());
 ['#avb','#avbig'].forEach(s=>$(s).innerHTML=u?`<img src="${esc(u)}" alt="">`:ini);$('#avdel').hidden=!u}
function squareJpeg(f,size=320){return new Promise((res,rej)=>{const i=new Image();
 i.onload=()=>{const s=Math.min(i.width,i.height),c=document.createElement('canvas');c.width=c.height=size;
  c.getContext('2d').drawImage(i,(i.width-s)/2,(i.height-s)/2,s,s,0,0,size,size);URL.revokeObjectURL(i.src);
  c.toBlob(b=>b?res({blob:b,data:c.toDataURL('image/jpeg',.85)}):rej(new Error('Could not read that photo')),'image/jpeg',.85)};
 i.onerror=()=>rej(new Error('That file is not a photo'));i.src=URL.createObjectURL(f)})}
async function setAvatar(f){if(!f)return;try{const {blob,data}=await squareJpeg(f);let url='';
  const path=user.id+'/avatar-'+Date.now()+'.jpg',up=await db.storage.from('listing-photos').upload(path,blob,{contentType:'image/jpeg'});
  if(!up.error){url=db.storage.from('listing-photos').getPublicUrl(path).data.publicUrl;
   const r=await db.auth.updateUser({data:{avatar_url:url}});if(r.error)url='';else user=r.data.user}
  if(!lsSet(avKey(),url||data)&&!url)return toast('Could not save the photo. Your browser is blocking storage.');
  showAvatar();toast(url?'Profile photo updated 👍':'Profile photo saved on this device')}
 catch(e){toast(e.message)}finally{$('#aph').value=''}}
$('#aph').onchange=e=>setAvatar(e.target.files[0]);
$('#avgal').onclick=()=>{$('#aph').removeAttribute('capture');$('#aph').click()};
$('#avcam').onclick=()=>takePhoto({facing:'user',title:'Profile photo',input:'#aph'},setAvatar);
$('#avdel').onclick=async()=>{try{localStorage.removeItem(avKey())}catch{}
 if(user.user_metadata?.avatar_url){const r=await db.auth.updateUser({data:{avatar_url:null}});if(!r.error)user=r.data.user}showAvatar();toast('Profile photo removed')};
$('#dd').addEventListener('click',e=>{if(!e.target.closest('#out'))e.stopPropagation();if(e.target.closest('button'))$('#dd').hidden=true});

// ---------- location ----------
function locate(){navigator.geolocation?.getCurrentPosition(async p=>{try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`),a=(await r.json()).address||{};
  area=[a.suburb||a.neighbourhood||a.village,a.city||a.town||a.state_district].filter(Boolean).join(', ');try{if(area)localStorage.setItem('w2w_location',area)}catch{}setLoc('📍 '+(area||'Location found'));render()}catch{setLoc('📍 Location unavailable')}},()=>setLoc('📍 Location unavailable'))}
const setLoc=t=>['#loc','#loc2','#loc3','#loc4'].forEach(s=>$(s).textContent=t);

// ---------- chat ----------
const openChat=()=>{$('#chat').hidden=false;$('#ci').focus()};
$('#fab').onclick=()=>$('#chat').hidden?openChat():$('#chat').hidden=true;$('#cx').onclick=()=>$('#chat').hidden=true;
$('#sugg').onclick=e=>e.target.tagName=='BUTTON'&&send(e.target.textContent);
$('#cf').onsubmit=e=>{e.preventDefault();const t=$('#ci').value.trim();if(t){$('#ci').value='';send(t)}};
async function send(t){add(t,'u');hist.push({role:'user',content:t});const w=add('Typing…','b');
 const {data,error}=await db.functions.invoke('ai',{body:{mode:'chat',messages:hist}});
 w.textContent=error||data?.error?(data?.error||'Chat is not set up yet.'):data.reply;if(data?.reply)hist.push({role:'assistant',content:data.reply});
 // show matching live listings under the answer
 const c=cat(t);if(c!='Other')all.filter(x=>active(x)&&x.cat==c&&x.seller_id!=user.id).slice(0,2).forEach(x=>{const d=document.createElement('div');d.className='mini';d.dataset.id=x.id;
  d.innerHTML=`<i class="c-${CLS[x.cat]}">${x.photo_url?`<img src="${esc(x.photo_url)}" alt="">`:ICON[x.cat]}</i><div><b>${esc(x.title)}, ${esc(+x.weight_kg)} kg</b><div class="muted" style="font-size:12px">${x.area?esc(x.area.split(',')[0])+' · ':''}${isAuction(x)?'Auction':'Buy now'} · ${inr(x.price)}</div></div>`;$('#msgs').append(d)});
 $('#msgs').scrollTop=1e9}
function add(t,c){const d=document.createElement('div');d.className='m '+c;d.textContent=t;$('#msgs').append(d);$('#msgs').scrollTop=1e9;return d}

// ---------- helpers ----------
function seg(s,fn){$(s).onclick=e=>{const b=e.target.closest('button');if(!b)return;$$(s+' button').forEach(x=>x.classList.toggle('on',x==b));fn(b.dataset.v)}}
function toast(t){const d=document.createElement('div');d.className='toast';d.setAttribute('role','status');d.textContent=t;$('#toasts').append(d);
 setTimeout(()=>{d.classList.add('out');setTimeout(()=>d.remove(),RM.matches?0:300)},3200)}
setInterval(()=>{if(user&&!document.hidden)render(true)},60000); // keep auction countdowns fresh

// Stay logged in after refresh
db.auth.getSession().then(({data})=>{if(data.session)enter(data.session.user)});
