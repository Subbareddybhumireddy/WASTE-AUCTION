// =====================================================================
// Waste2Worth backend (Node.js + Express)
//
// Start it with:  npm start   → then open http://localhost:3000
//
// What it does:
//   • serves the website (index.html)
//   • sign-up / login / logout with hashed passwords and session tokens
//   • saves users and listings in db.json
//   • /api/analyze → sends a scrap photo to Claude and returns a price estimate
//   • /api/chat    → the Waste2Worth chat assistant
//   • /api/place   → turns GPS coordinates into "Area, City" (OpenStreetMap)
//
// The Claude API key is read from the ANTHROPIC_API_KEY environment variable.
// It stays on the server and is never sent to the browser.
// =====================================================================

const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Anthropic } = require("@anthropic-ai/sdk");

const PORT = process.env.PORT || 3000;
const MODEL = "claude-opus-5-5"; // Claude model used for photo pricing and chat
const DB_FILE = path.join(__dirname, "db.json");
const SESSION_DAYS = 30; // how long a login stays valid
const CATEGORIES = ["Metal", "Plastic", "Paper", "E-waste", "Glass", "Other"];

const app = express();
app.use(express.json({ limit: "6mb" })); // photos arrive as base64 text, so allow a few MB

// ---------------------------------------------------------------------
// Tiny JSON "database": everything lives in db.json
//   users:    [{ id, name, email, role, passwordHash, createdAt }]
//   sessions: { token: { userId, createdAt } }
//   listings: [{ id, sellerId, name, weight, price, ... }]
// ---------------------------------------------------------------------
function loadDb() {
  if (!fs.existsSync(DB_FILE)) return { users: [], sessions: {}, listings: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
const db = loadDb();
function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const newId = () => crypto.randomUUID();

// Only send safe fields to the browser (never the password hash)
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt });
const publicListing = ({ bidderId, ...rest }) => rest;

// Create a random session token for a user and remember it
function startSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  db.sessions[token] = { userId: user.id, createdAt: Date.now() };
  saveDb();
  return token;
}

// Middleware: only lets the request through if it has a valid "Authorization: Bearer <token>" header
function requireLogin(req, res, next) {
  const token = (req.get("Authorization") || "").replace(/^Bearer /, "");
  const session = db.sessions[token];
  const expired = session && Date.now() - session.createdAt > SESSION_DAYS * 24 * 60 * 60 * 1000;
  const user = session && !expired && db.users.find((u) => u.id === session.userId);
  if (!user) return res.status(401).json({ error: "Please log in again." });
  req.user = user;
  req.token = token;
  next();
}

// ---------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------
app.post("/api/signup", async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 60);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const role = req.body.role === "buyer" ? "buyer" : "seller";

  if (!name || !email || !password) return res.status(400).json({ error: "Please fill in your name, email and password." });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  if (db.users.some((u) => u.email === email)) {
    return res.status(409).json({ error: "An account with this email already exists. Please log in." });
  }

  // Hash the password — we never store the real password
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: newId(), name, email, role, passwordHash, createdAt: new Date().toISOString() };
  db.users.push(user);
  const token = startSession(user); // also saves db.json
  res.json({ token, user: publicUser(user), returning: false });
});

app.post("/api/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.users.find((u) => u.email === email);
  // Compare the typed password with the saved hash
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Wrong email or password." });
  }
  const token = startSession(user);
  res.json({ token, user: publicUser(user), returning: true });
});

// Used after a page refresh to check the saved token is still valid
app.get("/api/me", requireLogin, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post("/api/logout", requireLogin, (req, res) => {
  delete db.sessions[req.token];
  saveDb();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------
app.get("/api/listings", requireLogin, (req, res) => {
  res.json({ listings: db.listings.map(publicListing) });
});

// Remembers each AI result for a while, so publishing can check
// "was this photo flagged as hazardous?" on the server, not just in the browser
const analyses = new Map(); // analysisId → { userId, result }

app.post("/api/listings", requireLogin, (req, res) => {
  const b = req.body;
  const name = String(b.name || "").trim().slice(0, 80);
  const weight = Number(b.weight);
  const price = Math.round(Number(b.price));
  if (!name || !(weight > 0) || !(price > 0)) {
    return res.status(400).json({ error: "Please add a title, a weight and a total price." });
  }

  // If the photo was analysed, block hazardous waste
  let estimate = null;
  const analysis = analyses.get(b.analysisId);
  if (analysis && analysis.userId === req.user.id) {
    if (analysis.result.hazardous) {
      return res.status(400).json({ error: "Hazardous waste can't be sold on Waste2Worth. Please dispose of it safely." });
    }
    estimate = analysis.result;
  }

  const photo = typeof b.photo === "string" && b.photo.startsWith("data:image/") && b.photo.length < 1500000 ? b.photo : null;
  const lat = Number.isFinite(Number(b.lat)) && b.lat !== null ? Math.round(b.lat * 100) / 100 : null; // rounded ≈1 km for privacy
  const lon = Number.isFinite(Number(b.lon)) && b.lon !== null ? Math.round(b.lon * 100) / 100 : null;
  const mode = b.mode === "auction" ? "auction" : "fixed";
  const now = Date.now();

  const listing = {
    id: newId(),
    sellerId: req.user.id,
    sellerName: req.user.name,
    name,
    category: CATEGORIES.includes(b.category) ? b.category : "Other",
    condition: String(b.condition || (estimate && estimate.condition) || "Good").slice(0, 40),
    weight,
    price, // total price for the whole lot (₹)
    mode, // "fixed" or "auction"
    bid: null, // highest bid so far (auctions only)
    bidCount: 0,
    bidderId: null,
    photo,
    lat,
    lon,
    place: String(b.place || "").slice(0, 80),
    estimate: estimate && { wasteType: estimate.waste_type, min: estimate.price_per_kg_min, max: estimate.price_per_kg_max },
    createdAt: now,
    endsAt: mode === "auction" ? now + 3 * 24 * 60 * 60 * 1000 : null, // auctions run for 3 days
  };
  db.listings.unshift(listing);
  saveDb();
  res.json({ listing: publicListing(listing) });
});

app.post("/api/listings/:id/bid", requireLogin, (req, res) => {
  const listing = db.listings.find((l) => l.id === req.params.id);
  const amount = Math.round(Number(req.body.amount));
  if (!listing || listing.mode !== "auction") return res.status(404).json({ error: "Auction not found." });
  if (listing.sellerId === req.user.id) return res.status(400).json({ error: "You can't bid on your own listing." });
  if (listing.endsAt <= Date.now()) return res.status(400).json({ error: "This auction has ended." });
  const current = listing.bid || listing.price;
  if (!(amount > current)) return res.status(400).json({ error: `Your bid must be higher than ₹${current.toLocaleString("en-IN")}.` });

  listing.bid = amount;
  listing.bidderId = req.user.id;
  listing.bidCount += 1;
  saveDb();
  res.json({ listing: publicListing(listing) });
});

app.delete("/api/listings/:id", requireLogin, (req, res) => {
  const index = db.listings.findIndex((l) => l.id === req.params.id && l.sellerId === req.user.id);
  if (index === -1) return res.status(404).json({ error: "Listing not found." });
  db.listings.splice(index, 1);
  saveDb();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// Claude helpers
// ---------------------------------------------------------------------
let claude = null;
function getClaude() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error("AI is not set up yet: add ANTHROPIC_API_KEY and restart the server.");
    err.noKey = true;
    throw err;
  }
  if (!claude) claude = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  return claude;
}

// Calls Claude and returns the text of the reply.
// "fallbacks: default" lets the API retry on a backup model if the main one declines a request.
async function askClaude({ system, messages, effort, format }) {
  const response = await getClaude().beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages,
    output_config: format ? { effort, format } : { effort },
  });
  if (response.stop_reason === "refusal") return null;
  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? textBlock.text : null;
}

// Turns any AI error into a friendly message for the browser
function sendAiError(res, err) {
  console.error("Claude API error:", err.message);
  if (err.noKey) return res.status(503).json({ error: err.message });
  if (err instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: "The ANTHROPIC_API_KEY is not valid." });
  if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "The AI is busy right now. Please try again in a minute." });
  res.status(502).json({ error: "The AI request failed. Please try again." });
}

// ---------------------------------------------------------------------
// /api/analyze — photo → AI price estimate
// ---------------------------------------------------------------------
const ANALYZE_PROMPT = `You are the scrap pricing assistant for Waste2Worth, a scrap and recycling marketplace in India.
Look at the photo and identify the waste or scrap material.
- waste_type: short name, e.g. "Aluminium cans" or "Corrugated cardboard". Use "Unknown" if the photo shows no waste.
- condition: short phrase, e.g. "Clean & sorted", "Mixed", "Wet / dirty".
- price_per_kg_min / price_per_kg_max: typical price range in Indian rupees (INR) per kg that a local scrap dealer in India would pay. Use 0 if unknown or hazardous.
- tip: one short sentence. If it is sellable, how to get a better price. If hazardous, how to dispose of it safely.
- hazardous: true for batteries, chemicals, paint, oil, pesticides, medical waste, asbestos, CFL/tube lights, swollen or leaking electronics.
- confidence: "low", "medium" or "high".`;

// Claude must reply with exactly this JSON shape
const ESTIMATE_SCHEMA = {
  type: "object",
  properties: {
    waste_type: { type: "string" },
    condition: { type: "string" },
    price_per_kg_min: { type: "number" },
    price_per_kg_max: { type: "number" },
    tip: { type: "string" },
    hazardous: { type: "boolean" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["waste_type", "condition", "price_per_kg_min", "price_per_kg_max", "tip", "hazardous", "confidence"],
  additionalProperties: false,
};

app.post("/api/analyze", requireLogin, async (req, res) => {
  // The browser sends the photo as a data URL: "data:image/jpeg;base64,...."
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(String(req.body.image || ""));
  if (!match) return res.status(400).json({ error: "Please add a photo first." });

  try {
    const text = await askClaude({
      system: ANALYZE_PROMPT,
      effort: "low",
      format: { type: "json_schema", schema: ESTIMATE_SCHEMA },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } },
            { type: "text", text: "Estimate this scrap. Reply with JSON only." },
          ],
        },
      ],
    });
    if (!text) return res.status(422).json({ error: "The AI couldn't analyse this photo. Please try another one." });

    const raw = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    // Clean up the numbers so the page always gets sensible values
    let min = Math.max(0, Math.round(Number(raw.price_per_kg_min) || 0));
    let max = Math.max(0, Math.round(Number(raw.price_per_kg_max) || 0));
    if (min > max) [min, max] = [max, min];
    const result = {
      waste_type: String(raw.waste_type || "Unknown"),
      condition: String(raw.condition || "Unknown"),
      price_per_kg_min: min,
      price_per_kg_max: max,
      tip: String(raw.tip || ""),
      hazardous: raw.hazardous === true,
      confidence: String(raw.confidence || "low"),
    };

    const analysisId = newId();
    analyses.set(analysisId, { userId: req.user.id, result });
    if (analyses.size > 500) analyses.delete(analyses.keys().next().value); // forget the oldest
    res.json({ analysisId, ...result });
  } catch (err) {
    sendAiError(res, err);
  }
});

// ---------------------------------------------------------------------
// /api/chat — Waste2Worth assistant
// ---------------------------------------------------------------------
const CHAT_PROMPT = `You are the Waste2Worth assistant, a friendly helper for a waste and recycling marketplace in India.
You help people sort, price, sell, buy and recycle scrap.
Rules:
- Any price you mention is only a rough estimate. Say so, and mention that real rates vary by city, quality and quantity.
- Never encourage selling hazardous waste (batteries, chemicals, paint, oil, medical waste, asbestos, broken CFLs, leaking electronics). Explain safe disposal instead, such as authorised collection centres.
- Keep answers short and simple: a few sentences or a short list.
- Always reply in the same language the user writes in.`;

app.post("/api/chat", requireLogin, async (req, res) => {
  // Keep only valid messages, and only the last 10 as context
  const history = (Array.isArray(req.body.messages) ? req.body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (history.length && history[0].role !== "user") history.shift(); // Claude needs the first message to be from the user
  if (!history.length || history[history.length - 1].role !== "user") {
    return res.status(400).json({ error: "Please type a message." });
  }

  try {
    const reply = await askClaude({ system: CHAT_PROMPT, effort: "low", messages: history });
    res.json({ reply: reply || "Sorry, I can't help with that. Please ask me something else about waste or recycling." });
  } catch (err) {
    sendAiError(res, err);
  }
});

// ---------------------------------------------------------------------
// /api/place — coordinates → "Area, City" using OpenStreetMap Nominatim
// (done on the server so we can send the User-Agent that Nominatim asks for)
// ---------------------------------------------------------------------
const placeCache = new Map();

app.get("/api/place", requireLogin, async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: "Missing coordinates." });

  const key = lat.toFixed(3) + "," + lon.toFixed(3);
  if (placeCache.has(key)) return res.json({ place: placeCache.get(key) });

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1&lat=${lat}&lon=${lon}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Waste2Worth/1.0 (student project)", "Accept-Language": "en" },
    });
    if (!response.ok) throw new Error("Nominatim returned " + response.status);
    const a = (await response.json()).address || {};
    const area = a.suburb || a.neighbourhood || a.quarter || a.village || a.hamlet || a.city_district;
    const city = a.city || a.town || a.municipality || a.county || a.state_district || a.state;
    const place = [...new Set([area, city].filter(Boolean))].join(", ");
    if (!place) throw new Error("No place name found");
    placeCache.set(key, place);
    res.json({ place });
  } catch (err) {
    console.error("Location lookup failed:", err.message);
    res.status(502).json({ error: "Location unavailable" });
  }
});

// ---------------------------------------------------------------------
// Website assets: serve only the frontend files and asset directories.
// Keeping the root directory off the public static path protects db.json,
// .env, and the rest of the server project.
// ---------------------------------------------------------------------
const publicAssetFiles = new Set(["/styles.css", "/catalog.js", "/app.js"]);
const publicAssetDirectories = /^\/(?:js|assets|images|fonts)(?:\/|$)/;
const servePublicAssets = express.static(__dirname, {
  dotfiles: "deny",
  index: false,
});

app.use((req, res, next) => {
  if (!publicAssetFiles.has(req.path) && !publicAssetDirectories.test(req.path)) {
    return next();
  }
  servePublicAssets(req, res, next);
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

app.listen(PORT, () => {
  console.log(`Waste2Worth is listening on port ${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("Note: ANTHROPIC_API_KEY is not set, so AI pricing and chat will not work until you add it.");
  }
});
