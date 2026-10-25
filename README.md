# Waste to Worth (Waste2Worth)

## ▶️ Auction marketplace (index.html) — setup in 2 steps

1. **Supabase → SQL Editor → New query**: paste [supabase/setup.sql](supabase/setup.sql) and press **Run** (once).
2. Optional: **Authentication → Providers → Email** → turn off *Confirm email* so new accounts can log in straight away.

Then open `index.html` (or deploy the folder). Sign up as seller, buyer or collector; the first person can also create the single **admin** account and load demo data from the admin overview.

Files: `catalog.js` (materials + reference prices), `js/core.js` (data sync, login, layout, camera), `js/market.js` (bidding rules, fees, maps), `js/seller.js`, `js/buyer.js`, `js/collector.js`, `js/admin.js`, `js/landing.js`, `app.js` (wiring). The previous version is in `waste2worth-backup/`.

---

> **"Turn your waste into worth"** — India's Premier B2B Recyclables, Scrap & Circular Economy Marketplace.

---

## ▶️ Simple site: index.html + Express backend (`npm start`)

`index.html` is served by `server.js` (Node.js + Express). Its colocated `styles.css`, `catalog.js`, `app.js`, and files under `js/` are served as static frontend assets. The static-file routes are limited to frontend paths so server files, `.env`, and `db.json` are not exposed. Users, sessions and listings are saved in `db.json` (created automatically).

```powershell
npm install
$env:ANTHROPIC_API_KEY="sk-ant-..."   # or add ANTHROPIC_API_KEY=... to the .env file
npm start                             # → http://localhost:3000
```

On macOS/Linux use `export ANTHROPIC_API_KEY=sk-ant-...` instead. AI pricing (`/api/analyze`) and the chat (`/api/chat`) need the key; everything else works without it. The Next.js app below is still available with `npm run dev` / `npm run start:next`.

For Render, use `npm start` as the start command and set any required environment variables in the Render dashboard. The Express server listens on Render's `PORT`; no separate frontend build is needed for the root `index.html` app. The `npm run build` script builds the separate Next.js app.

---

## 🌟 Features Overview

- **Database Architecture (Prisma ORM & SQLite / PostgreSQL)**:
  - `users`: Role-based authentication (`SELLER`, `BUYER`, `ADMIN`), phone verification status, credentials, and business metadata.
  - `categories`: Metals, Paper & Cardboard, Plastics, E-Waste, Batteries, Glass.
  - `scrap_rates`: Live benchmark rates (min, max, current price, 24h change).
  - `listings`: Scrap lots posted by sellers with quantities, expected price, condition, location.
  - `listing_images`: Image gallery for listings.
  - `bids`: Offers submitted by buyers with custom pricing and logistics notes.
  - `orders`: Confirmed pickup orders with weighbridge slip tracking and payment statuses.
  - `reviews`: Mutual ratings and reviews between counterparties.
  - `reports`: Platform dispute and audit reporting system.
  - `otp_verifications`: Secure numeric OTP codes with expiration for phone verification.

- **Authentication System**:
  - **Login Page**:
    - Eco-green header with logo and tagline: *"Turn your waste into worth"*.
    - Toggle: *"I want to sell / I want to buy"*.
    - Phone-or-email input field.
    - Password field.
    - *"Login with OTP instead"* (instant switch to SMS/OTP verification).
    - *"Forgot password?"* modal.
    - *"Log in"* button.
    - *"Continue with Google"* button.
    - *"Create an account"* link.
    - 1-Click Demo login buttons for Seller, Buyer, and Admin.
  - **Sign-up Flow**:
    - Role choice: Scrap Seller vs Scrap Buyer.
    - Phone OTP verification with dev-mode helper and countdown resend timer.
    - Account credentials setup and immediate session creation.
  - **Role-Based Protected Routes**:
    - `/seller/*`: Restricted to `SELLER` and `ADMIN`.
    - `/buyer/*`: Restricted to `BUYER` and `ADMIN`.
    - `/admin/*`: Restricted to `ADMIN`.
    - Next.js Edge Middleware (`middleware.ts`) automatically validates JWT cookies and redirects unauthorized users.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js 18+ (tested on v20.18.0)
- npm 9+

### 2. Environment Setup
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```

### 3. Database Migration & Seed
Run Prisma to set up the database and pre-populate sample data:
```bash
npm run prisma:push
npm run prisma:seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Demo Credentials

| Role | Email / Phone | Password | Target Dashboard |
| :--- | :--- | :--- | :--- |
| **Seller** | `seller@waste2worth.com` / `+19876543210` | `Password123!` | `/seller/dashboard` |
| **Buyer** | `buyer@waste2worth.com` / `+11234567890` | `Password123!` | `/buyer/dashboard` |
| **Admin** | `admin@waste2worth.com` / `+15550001111` | `Admin123!` | `/admin/dashboard` |

---

## 📱 Phone OTP in Development Mode
When `OTP_DEV_MODE=true` in `.env`:
- OTP codes are printed directly to the terminal console.
- OTP codes are displayed in an amber auto-fill banner on the UI for effortless testing without waiting for an SMS.

## Provider configuration and new flows

Copy `.env.example` to `.env.local` (or `.env`) and configure integrations before using them:

- `ANTHROPIC_API_KEY` enables server-side Claude photo analysis and WasteBot. Keep this key server-only.
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` enable up to five unsigned image uploads. Restrict the preset to images.
- `STRIPE_SECRET_KEY` must be a Stripe test-mode key to run test checkout. Stripe Connect onboarding is required for seller transfers. Checkout uses manual capture; the buyer's pickup confirmation triggers capture and seller payout. Ensure your Stripe account supports INR and Connect transfers.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` enable OAuth. Register `${NEXT_PUBLIC_APP_URL}/api/auth/google/callback` as an authorized redirect URI.
- `CRON_SECRET` protects the Vercel auction-finalization cron at `/api/cron/auctions`; for non-Vercel hosts, schedule an authenticated GET to that endpoint.

Run `npx prisma db push` after schema changes. The marketplace is at `/marketplace`; sellers create AI-assisted listings at `/seller/sell`; orders and sales history are at `/orders/[id]` and `/sales-history`.

Listings expose only an approximate area and rounded coordinates. Seller pickup addresses are withheld from public APIs until the buyer has authorized payment. City-level IP geolocation is used before requesting optional browser GPS; denying GPS leaves the IP-based city in place.

Before deployment, configure provider webhooks/alerts, abuse-rate limiting storage suitable for the deployment topology, and production payment and seller verification policies. The chatbot rate limiter is in-memory and is intended for a single-process development deployment.
