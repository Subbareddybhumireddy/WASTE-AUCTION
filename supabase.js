const SUPABASE_URL = "https://elnvrseohlokdpqcgdzc.supabase.co";
const SUPABASE_ANON_KEY = "PASTE_YOUR_ANON_KEY_HERE";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const categoryStyle = { Metal: "metal", Plastic: "plastic", Paper: "paper", "E-waste": "ewaste", Glass: "glass", Other: "glass" };
const categoryEmoji = { Metal: "⚙️", Plastic: "🧴", Paper: "📦", "E-waste": "💻", Glass: "🍾", Other: "♻️" };
const state = { view: "all", category: "All", search: "", mode: "all", sort: "newest" };
let listings = [];
let me = null;
let authMode = "login";
let chatHistory = [];
let chatWaiting = false;
const favorites = new Set(JSON.parse(localStorage.getItem("w2w-favorites") || "[]"));
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const money = value => "₹" + Math.round(Number(value) || 0).toLocaleString("en-IN");

function showNotice(id, text) {
  $(id).textContent = text;
  $(id).classList.add("show");
}

function hideNotice(id) {
  $(id).classList.remove("show");
}

function errorMessage(error) {
  return error?.message || "Something went wrong. Please try again.";
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelector(".auth-card").dataset.mode = mode;
  document.querySelectorAll("[data-auth-tab]").forEach(button => button.classList.toggle("active", button.dataset.authTab === mode));
  $("auth-submit").textContent = mode === "login" ? "Log in" : "Create account";
  $("auth-name").required = mode === "signup";
  $("auth-password").autocomplete = mode === "login" ? "current-password" : "new-password";
  hideNotice("auth-error");
}

function openModal(id) {
  $(id).classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal(element) {
  if (!element) return;
  element.classList.remove("open");
  if (!document.querySelector(".modal-backdrop.open")) document.body.style.overflow = "";
}

function showWelcome() {
  $("welcome-title").textContent = `Welcome, ${me.name}!`;
  $("welcome-sub").textContent = me.role === "buyer"
    ? "Browse materials from local sellers."
    : "Snap a photo of your scrap to get an AI price, then list it.";
  openModal("welcome-modal");
}

async function loadProfile(user) {
  const { data, error } = await db.from("profiles").select("id,name,role").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (data) return {
    ...data,
    name: data.name || user.user_metadata?.name || user.email?.split("@")[0] || "Member",
    role: data.role || user.user_metadata?.role || "seller",
    email: user.email
  };

  const profile = {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split("@")[0] || "Member",
    role: user.user_metadata?.role || "seller"
  };
  const { error: saveError } = await db.from("profiles").upsert(profile);
  if (saveError) throw saveError;
  return { ...profile, email: user.email };
}

async function showApp({ welcome = false } = {}) {
  document.body.classList.replace("logged-out", "logged-in");
  $("avatar").textContent = me.name.charAt(0).toUpperCase();
  $("account-info").innerHTML = `<b>${esc(me.name)}</b><br>${esc(me.email || "")}<br>${me.role === "buyer" ? "🛒 I want to buy" : "📦 I want to sell"}`;
  resetChat();
  try {
    await loadListings();
  } catch (error) {
    showNotice("listing-error", errorMessage(error));
  }
  if (welcome) showWelcome();
}

function logoutLocal() {
  me = null;
  listings = [];
  state.view = "all";
  $("chat-panel").classList.remove("open");
  document.querySelectorAll(".modal-backdrop.open").forEach(closeModal);
  document.body.classList.replace("logged-in", "logged-out");
}

async function logout() {
  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;
    logoutLocal();
  } catch (error) {
    alert(errorMessage(error));
  }
}

$("auth-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const email = String(values.get("email")).trim();
  const password = String(values.get("password"));
  $("auth-submit").disabled = true;
  hideNotice("auth-error");
  try {
    let user;
    if (authMode === "signup") {
      const name = String(values.get("name")).trim();
      const role = String(values.get("role"));
      const { data, error } = await db.auth.signUp({ email, password, options: { data: { name, role } } });
      if (error) throw error;
      if (!data.user) throw new Error("Account creation did not return a user. Please try again.");
      if (!data.session) {
        setAuthMode("login");
        form.reset();
        showNotice("auth-error", "Account created. Check your email to confirm it, then log in.");
        return;
      }
      const { error: profileError } = await db.from("profiles").upsert({ id: data.user.id, name, role });
      if (profileError) throw profileError;
      user = data.user;
    } else {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Login did not return a user. Please try again.");
      user = data.user;
    }
    me = await loadProfile(user);
    form.reset();
    await showApp({ welcome: true });
  } catch (error) {
    showNotice("auth-error", errorMessage(error));
  } finally {
    $("auth-submit").disabled = false;
  }
});

async function loadListings() {
  hideNotice("listing-error");
  const { data, error } = await db.from("listings")
    .select("id,seller_id,title,waste_type,weight_kg,price,sale_type,photo_url,area,status");
  if (error) {
    showNotice("listing-error", errorMessage(error));
    throw error;
  }
  listings = data || [];
  renderAll();
}

function guessCategory(type) {
  const text = String(type || "").toLowerCase();
  if (/e-waste|electronic|circuit|computer|laptop|phone|mobile|charger|keyboard|monitor/.test(text)) return "E-waste";
  if (/glass/.test(text)) return "Glass";
  if (/paper|cardboard|carton|newspaper|book|magazine/.test(text)) return "Paper";
  if (/plastic|pet|hdpe|polythene|pvc/.test(text)) return "Plastic";
  if (/metal|alumin|copper|brass|iron|steel|tin|can/.test(text)) return "Metal";
  return "Other";
}

function renderListings() {
  const mine = state.view === "mine";
  const grid = $("listing-grid");
  $("market-title").textContent = mine ? "My listings" : "Materials near you";
  $("market-sub").textContent = mine ? "Everything you have listed for sale." : "Find your next deal from local sellers.";
  document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === state.view));
  document.querySelectorAll(".navlinks [data-view-link]").forEach(link => link.classList.toggle("active", link.dataset.viewLink === state.view));

  const pool = listings.filter(item => !mine || item.seller_id === me.id);
  if (!pool.length) {
    grid.innerHTML = '<div class="empty">No listings yet. Be the first to sell waste.</div>';
    return;
  }
  let shown = pool.filter(item => {
    const category = guessCategory(item.waste_type);
    const text = `${item.title} ${item.waste_type} ${item.area || ""}`.toLowerCase();
    return (state.category === "All" || category === state.category)
      && text.includes(state.search)
      && (state.mode === "all" || item.sale_type === state.mode);
  });
  shown.sort((a, b) => state.sort === "price" ? Number(a.price) - Number(b.price) : 0);
  if (!shown.length) {
    grid.innerHTML = '<div class="empty">No listings match those filters. Try another search or material category.</div>';
    return;
  }

  grid.innerHTML = shown.map(item => {
    const own = item.seller_id === me.id;
    const category = guessCategory(item.waste_type);
    const weight = Number(item.weight_kg) || 0;
    const price = Number(item.price) || 0;
    const saleType = item.sale_type === "auction" ? "AUCTION" : "BUY NOW";
    const button = own
      ? `<button class="btn btn-light" style="width:100%;margin-top:12px" data-action="delete" data-id="${esc(item.id)}">Delete listing</button>`
      : '<button class="btn btn-light" style="width:100%;margin-top:12px" disabled>Listing available</button>';
    return `<article class="card">
      <div class="cover cover-${categoryStyle[category] || "metal"}${item.photo_url ? " has-photo" : ""}">${item.photo_url ? `<img class="cover-photo" src="${esc(item.photo_url)}" alt="${esc(item.title)}">` : `<span class="cover-emoji">${categoryEmoji[category] || "♻️"}</span>`}<span class="badge">${esc(saleType)}</span><button class="heart ${favorites.has(item.id) ? "saved" : ""}" data-fav="${esc(item.id)}" title="Save listing" aria-label="Save ${esc(item.title)}">${favorites.has(item.id) ? "♥" : "♡"}</button></div>
      <div class="card-body"><div class="card-title-row"><h3>${esc(item.title)}</h3><span class="quality">${esc(item.status || "Available")}</span></div><div class="meta">${esc(item.waste_type)} &nbsp;·&nbsp; ${weight.toLocaleString("en-IN")} kg &nbsp;·&nbsp; ${own ? "Your listing" : "Local seller"}</div>
        <div class="price-row"><div class="price">${money(price)} <small>total</small></div><span class="per-kg">≈ ${weight ? money(price / weight) : money(price)}/kg</span></div>
        <div class="card-foot"><span class="distance">⌖ ${esc(item.area || "Location not shared")}</span><span>${esc(item.status || "Available")}</span></div>
        ${button}</div></article>`;
  }).join("");
}

function renderStats() {
  const kg = listings.reduce((total, item) => total + (Number(item.weight_kg) || 0), 0);
  const value = listings.reduce((total, item) => total + (Number(item.price) || 0), 0);
  const auctions = listings.filter(item => item.sale_type === "auction" && item.status === "active").length;
  const kgText = Math.round(kg).toLocaleString("en-IN") + " kg";
  $("stat-count").textContent = listings.length.toLocaleString("en-IN");
  $("stat-kg").textContent = kgText;
  $("impact-kg").textContent = kgText;
  $("stat-value").textContent = money(value);
  $("stat-auctions").textContent = auctions.toLocaleString("en-IN");
}

function renderRecent() {
  $("recent-list").innerHTML = listings.length
    ? listings.slice(0, 4).map(item => `<div class="sold-row"><b>${esc(item.title)} · ${Number(item.weight_kg || 0).toLocaleString("en-IN")} kg</b><span>${money(item.price)}${item.area ? " · " + esc(item.area) : ""}</span></div>`).join("")
    : '<div class="sold-row"><span>Nothing listed yet.</span></div>';
}

function renderAll() {
  renderListings();
  renderStats();
  renderRecent();
}

function setView(view) {
  state.view = view;
  renderListings();
  $("mobile-nav").classList.remove("open");
}

document.addEventListener("click", async event => {
  const target = event.target;
  const opener = target.closest("[data-open]");
  if (opener) {
    event.preventDefault();
    openModal(opener.dataset.open);
  }
  if (target.closest("[data-close]")) closeModal(target.closest(".modal-backdrop"));
  if (target.classList.contains("modal-backdrop")) closeModal(target);
  const authTab = target.closest("[data-auth-tab]");
  if (authTab) setAuthMode(authTab.dataset.authTab);
  if (target.closest("[data-logout]")) {
    event.preventDefault();
    await logout();
    return;
  }
  const tab = target.closest("[data-view]");
  if (tab) setView(tab.dataset.view);
  const viewLink = target.closest("[data-view-link]");
  if (viewLink) {
    setView(viewLink.dataset.viewLink);
    $("marketplace").scrollIntoView({ behavior: "smooth" });
  }
  const chip = target.closest("[data-category]");
  if (chip) {
    state.category = chip.dataset.category;
    document.querySelectorAll(".chip").forEach(button => button.classList.toggle("selected", button === chip));
    renderListings();
  }
  const favorite = target.closest("[data-fav]");
  if (favorite) {
    const id = favorite.dataset.fav;
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    localStorage.setItem("w2w-favorites", JSON.stringify([...favorites]));
    renderListings();
  }
  const action = target.closest("[data-action]");
  if (action?.dataset.action === "delete") {
    const item = listings.find(listing => listing.id === action.dataset.id);
    if (!item || !confirm(`Delete "${item.title}"?`)) return;
    try {
      const { error } = await db.from("listings").delete().eq("id", item.id).eq("seller_id", me.id);
      if (error) throw error;
      listings = listings.filter(listing => listing.id !== item.id);
      renderAll();
    } catch (error) {
      alert(errorMessage(error));
    }
  }
});

$("search").addEventListener("input", event => {
  state.search = event.target.value.toLowerCase().trim();
  renderListings();
});
$("sale-type").addEventListener("change", event => {
  state.mode = event.target.value;
  renderListings();
});
$("sort").addEventListener("change", event => {
  state.sort = event.target.value;
  renderListings();
});
$("clear-filters").addEventListener("click", () => {
  state.category = "All";
  state.search = "";
  state.mode = "all";
  state.sort = "newest";
  document.querySelectorAll(".chip").forEach(chip => chip.classList.toggle("selected", chip.dataset.category === "All"));
  $("search").value = "";
  $("sale-type").value = "all";
  $("sort").value = "newest";
  renderListings();
});
$("menu-toggle").addEventListener("click", () => $("mobile-nav").classList.toggle("open"));

const sell = { photoData: null, photoUrl: null, photoPath: null, analysis: null, priceEdited: false };

function resetSellForm() {
  $("sell-form").reset();
  Object.assign(sell, { photoData: null, photoUrl: null, photoPath: null, analysis: null, priceEdited: false });
  $("photo-preview").classList.remove("show");
  $("photo-preview").removeAttribute("src");
  $("ai-btn").hidden = true;
  $("estimate").hidden = true;
  $("publish-btn").disabled = false;
  ["hazard-warning", "sell-success", "sell-error"].forEach(hideNotice);
  $("price-help").textContent = "Enter the total price you want for the whole lot.";
}

function resizeImage(file, maxSize = 800) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Unable to process this photo in your browser."));
        return;
      }
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(image.src);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    image.onerror = () => reject(new Error("That file doesn't look like a photo. Please try another one."));
    image.src = URL.createObjectURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const [metadata, encoded] = dataUrl.split(",");
  const mime = metadata.match(/data:(.*?);base64/)?.[1];
  if (!mime || !encoded) throw new Error("Unable to prepare the photo for upload.");
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

async function onPhotoChosen(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  ["hazard-warning", "sell-error", "sell-success"].forEach(hideNotice);
  $("ai-btn").hidden = true;
  $("ai-btn").disabled = true;
  try {
    if (sell.photoPath) {
      const { error: removeError } = await db.storage.from("listing-photos").remove([sell.photoPath]);
      if (removeError) throw removeError;
      sell.photoPath = null;
      sell.photoUrl = null;
    }
    sell.photoData = await resizeImage(file);
    $("photo-preview").src = sell.photoData;
    $("photo-preview").classList.add("show");
    const path = `${me.id}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await db.storage.from("listing-photos").upload(path, dataUrlToBlob(sell.photoData), {
      contentType: "image/jpeg",
      upsert: false
    });
    if (uploadError) throw uploadError;
    sell.photoPath = path;
    sell.photoUrl = db.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
    $("ai-btn").hidden = false;
  } catch (error) {
    showNotice("sell-error", errorMessage(error));
  } finally {
    $("ai-btn").disabled = false;
  }
}

$("camera-input").addEventListener("change", onPhotoChosen);
$("gallery-input").addEventListener("change", onPhotoChosen);
$("ai-btn").addEventListener("click", async () => {
  if (!sell.photoData || !sell.photoUrl) return;
  const button = $("ai-btn");
  button.disabled = true;
  button.textContent = "Analysing photo…";
  hideNotice("sell-error");
  try {
    const { data, error } = await db.functions.invoke("ai", { body: { mode: "analyze", image: sell.photoData } });
    if (error) throw error;
    if (!data || !data.waste_type) throw new Error("The AI response did not include a waste type.");
    sell.analysis = data;
    showEstimate(data);
  } catch (error) {
    showNotice("sell-error", errorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = "✨ Get AI price";
  }
});

function showEstimate(result) {
  $("estimate").innerHTML = `<h4>${esc(result.waste_type)}</h4><div>Condition: <b>${esc(result.condition || "Unspecified")}</b></div>
    ${result.hazardous ? "" : `<div class="est-price">${money(result.price_per_kg_min)} – ${money(result.price_per_kg_max)} <small>per kg</small></div>`}
    <div>💡 ${esc(result.tip || "")}</div><div class="est-note">Estimate only, real rates vary.</div>`;
  $("estimate").hidden = false;
  $("item-name").value = $("item-name").value || result.waste_type;
  $("item-category").value = guessCategory(result.waste_type);
  $("item-condition").value = $("item-condition").value || String(result.condition || "").slice(0, 40);
  if (result.hazardous) {
    showNotice("hazard-warning", "⚠️ This looks like hazardous waste, so it can't be listed. Please take it to an authorised hazardous-waste collection centre.");
    $("publish-btn").disabled = true;
    return;
  }
  hideNotice("hazard-warning");
  $("publish-btn").disabled = false;
  sell.priceEdited = false;
  updateTotal();
}

function updateTotal() {
  const weight = Number($("item-weight").value) || 0;
  const analysis = sell.analysis;
  if (!analysis || analysis.hazardous || !Number(analysis.price_per_kg_max)) {
    $("price-help").textContent = "Enter the total price you want for the whole lot.";
    return;
  }
  const average = (Number(analysis.price_per_kg_min) + Number(analysis.price_per_kg_max)) / 2;
  $("price-help").textContent = `AI suggests about ${money(average)}/kg. The total is filled in for you, and you can change it.`;
  if (!sell.priceEdited && weight) $("item-price").value = Math.round(weight * average);
}

$("item-weight").addEventListener("input", updateTotal);
$("item-price").addEventListener("input", () => { sell.priceEdited = true; });
$("sell-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!sell.analysis || !sell.photoUrl) {
    showNotice("sell-error", "Add a photo and get its AI estimate before publishing.");
    return;
  }
  if (sell.analysis.hazardous) return;
  const values = new FormData(event.currentTarget);
  const weight = Number(values.get("weight"));
  const price = Number(values.get("price"));
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(price) || price <= 0) {
    showNotice("sell-error", "Enter a valid weight and total price.");
    return;
  }
  $("publish-btn").disabled = true;
  hideNotice("sell-error");
  try {
    const listing = {
      seller_id: me.id,
      title: String(values.get("name")).trim(),
      waste_type: sell.analysis.waste_type,
      weight_kg: weight,
      price,
      sale_type: String(values.get("sale")),
      photo_url: sell.photoUrl,
      area: String(values.get("area")).trim(),
      status: "active"
    };
    const { data, error } = await db.from("listings").insert(listing)
      .select("id,seller_id,title,waste_type,weight_kg,price,sale_type,photo_url,area,status").single();
    if (error) throw error;
    listings.unshift(data);
    renderAll();
    showNotice("sell-success", "Your listing is live! You can find it under “My listings”.");
    setTimeout(() => {
      closeModal($("sell-modal"));
      resetSellForm();
      setView("mine");
      $("marketplace").scrollIntoView({ behavior: "smooth" });
    }, 1200);
  } catch (error) {
    showNotice("sell-error", errorMessage(error));
    $("publish-btn").disabled = false;
  }
});

function addBubble(role, text) {
  const bubble = document.createElement("div");
  bubble.className = "msg " + (role === "user" ? "user" : "bot");
  bubble.textContent = text;
  $("chat-log").appendChild(bubble);
  $("chat-log").scrollTop = $("chat-log").scrollHeight;
  return bubble;
}

function resetChat() {
  chatHistory = [];
  $("chat-log").innerHTML = "";
  addBubble("assistant", "Hi! 👋 Ask me about scrap prices, sorting or recycling.");
}

$("chat-fab").addEventListener("click", () => {
  $("chat-panel").classList.toggle("open");
  if ($("chat-panel").classList.contains("open")) $("chat-input").focus();
});
$("chat-close").addEventListener("click", () => $("chat-panel").classList.remove("open"));
$("chat-form").addEventListener("submit", async event => {
  event.preventDefault();
  const text = $("chat-input").value.trim();
  if (!text || chatWaiting) return;
  $("chat-input").value = "";
  addBubble("user", text);
  chatHistory.push({ role: "user", content: text });
  const typing = addBubble("assistant", "Typing…");
  typing.classList.add("typing");
  chatWaiting = true;
  try {
    const { data, error } = await db.functions.invoke("ai", { body: { mode: "chat", messages: chatHistory.slice(-10) } });
    if (error) throw error;
    if (!data?.reply) throw new Error("The assistant returned an empty reply.");
    typing.remove();
    addBubble("assistant", data.reply);
    chatHistory.push({ role: "assistant", content: data.reply });
  } catch (error) {
    typing.remove();
    addBubble("assistant", "⚠️ " + errorMessage(error));
  } finally {
    chatWaiting = false;
  }
});

$("year").textContent = new Date().getFullYear();
setAuthMode("login");
db.auth.onAuthStateChange(event => {
  if (event === "SIGNED_OUT" && me) logoutLocal();
});

(async function initialize() {
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) return;
    me = await loadProfile(data.session.user);
    await showApp();
  } catch (error) {
    showNotice("auth-error", errorMessage(error));
  }
})();
