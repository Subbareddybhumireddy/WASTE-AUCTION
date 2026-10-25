// =========================================================
// Waste2Worth — material catalogue and reference prices
// Indicative South India street / dealer ranges (INR), not a live feed.
// Each row: [name, category, icon, unit, min, max, altUnit, altMin, altMax]
// =========================================================
const PRICES_UPDATED = Date.parse('2026-10-24T12:00:00+05:30');
const CATS = ['Paper', 'Plastic', 'Metals', 'Glass', 'E-waste', 'Textiles', 'Other'];
const CAT_ICON = { Paper: '📦', Plastic: '🧴', Metals: '🔩', Glass: '🍾', 'E-waste': '💻', Textiles: '👕', Other: '♻️' };

const CATALOG_RAW = [
 // Paper
 ['Newspaper','Paper','📰','kg',11,16],['Cardboard','Paper','📦','kg',7,13],['Corrugated cardboard','Paper','📦','kg',8,13],
 ['Books and notebooks','Paper','📚','kg',9,15],['Office paper','Paper','📄','kg',12,20],['White paper','Paper','📃','kg',12,18],
 ['Magazines','Paper','🗞️','kg',6,10],['Paper cartons','Paper','🗃️','kg',7,12],['Kraft paper','Paper','📜','kg',9,14],
 ['Paper bags','Paper','🛍️','kg',7,12],['Paper cups','Paper','🥤','kg',2,6],['Paper egg trays','Paper','🥚','kg',4,8],
 ['Junk mail','Paper','✉️','kg',6,11],['Shredded paper','Paper','📃','kg',4,9],['Tetra packs','Paper','🧃','kg',3,6],
 // Plastic
 ['PET bottles','Plastic','🧴','kg',12,22],['HDPE plastic','Plastic','🪣','kg',20,35],['LDPE plastic','Plastic','🛍️','kg',10,25],
 ['PVC plastic','Plastic','🧱','kg',8,16],['Hard plastic','Plastic','🧺','kg',15,28],['Mixed plastic','Plastic','♻️','kg',5,14],
 ['Plastic pipes','Plastic','🚰','kg',12,22],['Plastic containers','Plastic','🫙','kg',12,24],['PET jars','Plastic','🫙','kg',12,22],
 ['Plastic film','Plastic','🎞️','kg',8,15],['Plastic bags','Plastic','🛍️','kg',6,12],['Plastic crates','Plastic','🧺','kg',20,35],
 ['Plastic buckets','Plastic','🪣','kg',18,30],['Plastic drums','Plastic','🛢️','kg',20,35],['Plastic chairs','Plastic','🪑','piece',25,70,'kg',12,25],
 ['Acrylic plastic','Plastic','🧊','kg',25,55],['Polypropylene plastic','Plastic','♻️','kg',15,30],['Polystyrene foam','Plastic','🧽','kg',4,12],
 ['Plastic toys','Plastic','🧸','kg',10,20],['Plastic packaging','Plastic','📦','kg',6,14],
 // Metals
 ['Iron scrap','Metals','🔩','kg',25,35],['Steel scrap','Metals','🏗️','kg',30,42],['Stainless steel','Metals','🍴','kg',50,80],
 ['Aluminium scrap','Metals','🔧','kg',140,190],['Aluminium cans','Metals','🥫','kg',110,150],['Copper scrap','Metals','🟠','kg',750,950],
 ['Copper wire','Metals','🔌','kg',650,900],['Brass','Metals','🟡','kg',420,560],['Zinc','Metals','🔘','kg',170,230],
 ['Tin scrap','Metals','🥫','kg',12,22],['Iron rods','Metals','🔩','kg',30,40],['Cast iron','Metals','⚙️','kg',26,36],
 ['Brass fittings','Metals','🚰','kg',400,540],['Aluminium wire','Metals','🔌','kg',150,195],['Aluminium utensils','Metals','🍲','kg',130,170],
 ['Metal cans','Metals','🥫','kg',14,22],['Zinc sheets','Metals','📄','kg',170,230],['Lead scrap','Metals','⚖️','kg',110,150],
 ['Metal pipes','Metals','🛠️','kg',28,40],['Metal roofing sheets','Metals','🏠','kg',22,32],['Metal utensils','Metals','🍴','kg',40,70],
 ['Scrap motors','Metals','⚙️','kg',50,95],['Mixed appliance scrap','Metals','🌬️','kg',22,40],
 // Glass
 ['Clear glass bottles','Glass','🍾','kg',2,5],['Coloured glass bottles','Glass','🍷','kg',1,4],['Mixed glass','Glass','🪟','kg',1,3],
 ['Glass jars','Glass','🫙','kg',2,5],['Glass tumblers','Glass','🥛','kg',2,5],['Window glass','Glass','🪟','kg',1,3],
 ['Glass sheets','Glass','🪟','kg',1,4],['Glass scrap','Glass','♻️','kg',1,3],
 // E-waste
 ['Mobile phones','E-waste','📱','piece',50,400,'kg',500,1500],['Smartphones','E-waste','📱','piece',100,800,'kg',500,1500],
 ['Feature phones','E-waste','📱','piece',20,120,'kg',300,900],['Tablets','E-waste','📱','piece',150,800,'kg',300,1000],
 ['Laptops','E-waste','💻','piece',400,2500,'kg',200,900],['Desktop computers','E-waste','🖥️','piece',300,1500,'kg',30,150],
 ['Printers and scanners','E-waste','🖨️','piece',100,600,'kg',15,60],['Monitors','E-waste','🖥️','piece',80,450,'kg',15,60],
 ['Small electronic appliances','E-waste','🔌','piece',50,300,'kg',20,60],['Keyboards and mice','E-waste','⌨️','piece',10,40,'kg',20,50],
 ['Hard drives','E-waste','💽','piece',40,250,'kg',80,500],['Routers and modems','E-waste','📡','piece',30,200,'kg',60,300],
 ['Audio equipment','E-waste','🔊','piece',50,400,'kg',30,100],['Cameras','E-waste','📷','piece',100,800,'kg',200,1000],
 ['UPS units','E-waste','🔋','piece',250,1200,'kg',30,100],['Circuit boards','E-waste','🟩','kg',150,450,'piece',30,250],
 ['Cables and chargers','E-waste','🔌','kg',20,60,'piece',3,25],['Mixed e-waste','E-waste','♻️','kg',10,40,'piece',10,150],
 ['Power supplies','E-waste','🔌','kg',25,70,'piece',50,250],['Computer peripherals','E-waste','⌨️','kg',15,40,'piece',10,80],
 // Textiles
 ['Reusable clothes','Textiles','👕','piece',10,60,'kg',10,40],['Cotton textile waste','Textiles','🧵','kg',4,10],
 ['Mixed textile waste','Textiles','🧶','kg',2,7],['Denim textile waste','Textiles','👖','kg',8,15],['Wool textile waste','Textiles','🧶','kg',8,20],
 ['Synthetic textile waste','Textiles','🧵','kg',2,6],['Bedsheets and linen','Textiles','🛏️','kg',5,12],['Fabric offcuts','Textiles','🧵','kg',8,20],
 ['Carpets and rugs','Textiles','🧶','kg',3,8],['Shoes and footwear','Textiles','👟','piece',8,40,'kg',8,25],['Reusable bags','Textiles','🎒','piece',15,80,'kg',20,80],
 // Other
 ['Rubber scrap','Other','⚫','kg',8,15],['Rubber tubes','Other','⚫','kg',15,30],['Tyres','Other','🛞','piece',60,350,'kg',8,20],
 ['Wooden scrap','Other','🪵','kg',3,8],['Wooden pallets','Other','🪵','piece',80,350,'kg',4,10],['Wooden furniture','Other','🪑','piece',200,2000,'kg',8,25],
 ['Wooden doors','Other','🚪','piece',300,1500,'kg',6,20],['Coconut shells','Other','🥥','kg',2,5],['Used cooking oil','Other','🛢️','kg',25,45],
 ['Lead-acid batteries','Other','🔋','kg',70,110,'piece',1000,3500],['Inverter batteries','Other','⚡','kg',70,110,'piece',1800,5500],
 ['Car batteries','Other','🔋','kg',70,110,'piece',700,1600],['UPS batteries','Other','🔋','kg',70,110,'piece',500,1200],
 ['Dry-cell batteries','Other','🔋','kg',10,25,'piece',1,5],['Reusable refrigerators','Other','🧊','piece',2000,8000,'kg',25,100],
 ['Reusable washing machines','Other','🧺','piece',1500,6000,'kg',25,90],['Reusable air conditioners','Other','❄️','piece',3000,12000,'kg',60,200],
 ['Reusable microwaves','Other','📻','piece',600,2500,'kg',30,100]
];
const MATS = CATALOG_RAW.map(([m, c, i, u, a, b, u2, a2, b2]) => ({ m, c, i, u, r: [a, b], u2: u2 || null, r2: u2 ? [a2, b2] : null }));
const MAT = Object.fromEntries(MATS.map(d => [d.m, d]));

// kg CO2 saved per kg recycled (typical factors, estimates only)
const CO2_BY_CAT = { Paper: 1, Plastic: 1.5, Metals: 1.5, Glass: .3, 'E-waste': 2, Textiles: 3, Other: 1 };
const co2f = m => /alumin/i.test(m) ? 9 : /copper/i.test(m) ? 3 : /brass|stainless|zinc/i.test(m) ? 2.5 : (CO2_BY_CAT[MAT[m]?.c] || 1);

const TIPS_BY_CAT = {
 Paper: 'Keep paper dry and tied in bundles. Wet or oily paper loses most of its value.',
 Plastic: 'Rinse and sort by type. Hard plastic and PET fetch more than mixed plastic.',
 Metals: 'Use a magnet: non-magnetic metals (copper, brass, aluminium) pay far more than iron.',
 Glass: 'Pack bottles in a crate so they don’t break during pickup.',
 'E-waste': 'Keep devices intact and wipe your data. Never burn or break e-waste.',
 Textiles: 'Wash and dry clothes. Reusable items are priced per piece.',
 Other: 'Keep items dry and separated. Batteries must stay intact and unopened.'
};
const TIPS = {
 'Aluminium cans': 'Cans pay well per kg. Crush them and keep them apart from other metal.',
 'Cardboard': 'Flatten boxes and keep them dry. Wet cardboard loses value.',
 'Copper scrap': 'Strip plastic from wires. Clean copper fetches the highest rate.',
 'Copper wire': 'Stripped wire is worth much more than wire with its insulation on.',
 'PET bottles': 'Empty and crush bottles to save space.',
 'Iron scrap': 'Separate iron from steel and aluminium to get better rates.',
 'Newspaper': 'Keep newspapers dry and tied in bundles.',
 'Lead-acid batteries': 'Do not open or drain them. Only intact batteries are accepted.'
};
const tipFor = m => TIPS[m] || TIPS_BY_CAT[MAT[m]?.c] || TIPS_BY_CAT.Other;

// Map an AI answer ("aluminium cans", "plastic bottle"…) onto a catalogue name.
const ALIASES = [
 [/battery|batteries/, 'Lead-acid batteries'], [/copper/, 'Copper scrap'], [/brass/, 'Brass'],
 [/soda can|beverage can|aluminium can|aluminum can|\bcans?\b/, 'Aluminium cans'], [/alumin/, 'Aluminium scrap'],
 [/stainless/, 'Stainless steel'], [/steel/, 'Steel scrap'], [/zinc/, 'Zinc'], [/\blead\b/, 'Lead scrap'],
 [/iron|metal|rust/, 'Iron scrap'], [/phone|mobile/, 'Mobile phones'], [/laptop/, 'Laptops'],
 [/computer|\bpc\b|cpu/, 'Desktop computers'], [/monitor|\btv\b|television/, 'Monitors'], [/printer/, 'Printers and scanners'],
 [/circuit|pcb/, 'Circuit boards'], [/cable|charger|wire/, 'Cables and chargers'], [/e-?waste|electronic/, 'Mixed e-waste'],
 [/glass|jar/, 'Clear glass bottles'], [/\bpet\b|plastic bottle|bottle/, 'PET bottles'], [/bucket|hdpe/, 'HDPE plastic'],
 [/polythene|film|ldpe|carry bag/, 'LDPE plastic'], [/pipe|pvc/, 'PVC plastic'], [/plastic/, 'Mixed plastic'],
 [/newspaper/, 'Newspaper'], [/corrugat/, 'Corrugated cardboard'], [/cardboard|carton|box/, 'Cardboard'],
 [/book|notebook/, 'Books and notebooks'], [/magazine/, 'Magazines'], [/tetra/, 'Tetra packs'], [/paper/, 'Office paper'],
 [/shoe|footwear|sandal/, 'Shoes and footwear'], [/cloth|textile|garment|shirt|fabric/, 'Mixed textile waste'],
 [/tyre|tire/, 'Tyres'], [/rubber/, 'Rubber scrap'], [/furniture|chair|table/, 'Wooden furniture'], [/wood|timber/, 'Wooden scrap'],
 [/oil/, 'Used cooking oil'], [/coconut/, 'Coconut shells']
];
const BY_LEN = MATS.map(d => d.m).sort((a, b) => b.length - a.length);
function canon(name) {
 const s = String(name || '').toLowerCase().trim();
 if (!s) return null;
 const exact = MATS.find(d => d.m.toLowerCase() == s); if (exact) return exact.m;
 const inside = BY_LEN.find(m => s.includes(m.toLowerCase())); if (inside) return inside;
 const a = ALIASES.find(([re]) => re.test(s)); return a ? a[1] : null;
}
