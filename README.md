# Rozgar — AI-Powered Reselling & Education Fund Platform

**"Create income today, educate the next generation tomorrow."**

Rozgar is an AI-guided digital marketplace where low-income individuals — with no formal sales background — resell digital licenses and subscriptions and earn commission on every verified sale. A fixed, transparent share of platform revenue is automatically routed into an **Education Fund** that supports the education of children from low-income families. It is not a charity model: every rupee in the fund is a byproduct of a real, admin-verified, commission-driven transaction, which is what makes it sustainable at scale.

Full stack in one repository: Postgres database (Supabase), a Next.js frontend, an AI sales assistant, and a fraud-safe sale-verification pipeline — all built for a hackathon and structured to read like a real product, not a demo.

<p>
  <img alt="stack" src="https://img.shields.io/badge/frontend-Next.js-black">
  <img alt="db" src="https://img.shields.io/badge/database-Supabase%20(Postgres)-3ecf8e">
  <img alt="ai" src="https://img.shields.io/badge/AI-xAI%20Grok%20%2B%20rule--based%20fallback-blueviolet">
  <img alt="status" src="https://img.shields.io/badge/status-hackathon%20MVP-orange">
  <img alt="license" src="https://img.shields.io/badge/license-project--private-lightgrey">
</p>

---

## Table of Contents

1. [Why Rozgar Exists](#why-rozgar-exists)
2. [How It Works](#how-it-works)
3. [What's Included (Hackathon MVP)](#whats-included-hackathon-mvp)
4. [Architecture](#architecture)
5. [Tech Stack](#tech-stack)
6. [Project Structure](#project-structure)
7. [Getting Started](#getting-started)
8. [Environment Variables](#environment-variables)
9. [Security Model](#security-model)
10. [Fraud Prevention: How a Sale Becomes a Commission](#fraud-prevention-how-a-sale-becomes-a-commission)
11. [Revenue & Commission Structure](#revenue--commission-structure)
12. [AI Sales Assistant](#ai-sales-assistant)
13. [Public Impact Page](#public-impact-page)
14. [End-to-End Test Flow](#end-to-end-test-flow)
15. [Roadmap](#roadmap)
16. [Team](#team)
17. [Notes & Known Limitations](#notes--known-limitations)

---

## Why Rozgar Exists

Two problems, one system:

| Problem | How Rozgar addresses it |
| --- | --- |
| Formal jobs are scarce, and a job-listing portal only surfaces existing vacancies — it doesn't *create* income | Rozgar turns anyone into a verified reseller of digital products, earning commission with no prior sales experience required |
| A household's financial stress raises the risk of child dropout / child labour | A flat, non-negotiable share of company revenue is automatically diverted into an Education Fund — funded by business activity, not donations |

Existing alternatives — job portals, generic e-commerce, generic chatbots — each solve one half of this. Rozgar is built to solve both halves with the same transaction.

## How It Works

```
Seller applies  →  Admin approves  →  AI assists the sale  →  Sale is verified
        →  Commission is released  →  Education Fund grows  →  Impact is public, live
```

Every step above is a real, working feature in this repository — nothing here is a slide-only promise.

## What's Included (Hackathon MVP)

- **Public storefront** — browse products and complete guest checkout, no login required.
- **Seller (employee) onboarding** — signup auto-creates a pending application; goes live only after Admin approval.
- **Employee dashboard** — AI sales assistant (chat), assigned product, live commission summary, "confirm a sale" flow with payment-screenshot upload.
- **Admin dashboard** — approve/reject seller applications, approve/reject sale requests (with proof-of-payment review), manage products.
- **Fraud-safe walk-in sales** — a seller can never create a commission directly; every walk-in sale is Admin-reviewed first.
- **Public `/impact` page** — live, aggregate platform numbers (sellers employed, sales completed, commissions paid, Education Fund total), with zero row-level data exposure.
- **3 seeded pilot categories** — Antivirus/Security, Online Courses, Mobile Data bundles.

Deliberately **not** shipped in this MVP: the voice assistant (mic UI was removed rather than shipped half-working) and an AI pre-check on seller applications. Both are scoped roadmap items — see [Roadmap](#roadmap).

## Architecture

```
                         ┌─────────────────────────┐
                         │        Supabase          │
                         │  Postgres + Auth + RLS   │
                         │  Storage (2 buckets)     │
                         └────────────┬─────────────┘
                                      │
                     lib/supabaseClient.js, lib/auth.js, lib/api.js
                                      │
                     ┌────────────────┼────────────────┐
                     │                │                 │
              ┌──────▼─────┐   ┌──────▼──────┐   ┌──────▼──────┐
              │ Storefront │   │  Employee    │   │    Admin     │
              │     /      │   │  /employee   │   │   /admin     │
              │ guest      │   │  AI chat,    │   │  approvals,  │
              │ checkout   │   │  commission, │   │  products,   │
              │            │   │  confirm sale│   │  sale review │
              └────────────┘   └──────┬───────┘   └──────────────┘
                                       │
                              pages/api/ai-assistant.js
                                       │
                         xAI Grok API ──▶ (falls back to rule-based
                                            reply if key missing/down)
```

All three dashboards share one Next.js codebase and one data layer (`lib/api.js`), so a change made once (a price, a commission %) is instantly consistent everywhere — the storefront, the employee dashboard, and the admin dashboard never disagree with each other.

## Tech Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js (React 18) | File-based routing, fast to ship a 3-dashboard app from one codebase |
| Database + Auth | Supabase (Postgres) | Generous free tier, SQL-based Row Level Security enforces rules at the DB level too, not just in the frontend |
| File storage | Supabase Storage (2 buckets) | `product-images` public, `payment-screenshots` private with signed-URL access |
| AI assistant | xAI Grok API + rule-based fallback | Reliability-first: the assistant never breaks a demo, live API or not |
| Hosting (recommended) | Vercel | Free tier pairs naturally with Next.js + Supabase |

> **Note:** the original plan used Firebase; the as-built platform uses Supabase instead, for the same role-based-auth goal but with database-enforced Row Level Security.

## Project Structure

```
rozgar-main/
├── schema.sql                        ← run this first, in Supabase SQL Editor
├── schema-admin-logs-fix.sql         ← older migration, already folded into schema.sql
├── schema-seller-assignment-fix.sql  ← older migration, already folded into schema.sql
├── env.local.example                 ← copy to .env.local and fill in
├── package.json / package-lock.json
├── next.config.js
├── styles/
│   └── globals.css
├── lib/
│   ├── supabaseClient.js   ← Supabase client (reads .env.local, falls back to shared demo project)
│   ├── auth.js             ← signUp, signIn, signOut, getCurrentUser
│   └── api.js              ← applications, orders, commissions, sale requests
└── pages/
    ├── _app.js
    ├── index.js            ← public storefront (browse + guest checkout)
    ├── login.js            ← staff (seller/admin) login
    ├── signup.js           ← customer / employee signup (never admin — see Security)
    ├── impact.js           ← public /impact aggregate-numbers page
    ├── customer/index.js   ← redirects to "/" (kept so old links still work)
    ├── employee/index.js   ← seller dashboard (AI chat, commission, confirm sale)
    ├── admin/index.js      ← admin dashboard (approvals, products, sale requests)
    └── api/ai-assistant.js ← Grok-powered sales assistant + rule-based fallback
```

## Getting Started

1. **Run the database schema.** Open `schema.sql`, copy the whole file, and run it in **Supabase Dashboard → SQL Editor → New Query**. This creates every table, every RLS policy, every function, and seeds the 3 pilot products.
   *(`schema-admin-logs-fix.sql` and `schema-seller-assignment-fix.sql` are historical migrations already folded into `schema.sql` — on a fresh project you only need `schema.sql`.)*
2. **Create two Storage buckets** in Supabase:
   - `product-images` — **Public bucket: ON**
   - `payment-screenshots` — **Public bucket: OFF** (holds proof-of-payment; viewed only via short-lived signed URLs, never a public link)
3. **Configure environment variables** — copy `env.local.example` to `.env.local` and fill in your Supabase URL + anon key (Supabase Dashboard → Project Settings → API). See [Environment Variables](#environment-variables) for what each key does.
4. **Install dependencies**
   ```bash
   npm install
   ```
5. **Run the dev server**
   ```bash
   npm run dev
   ```
6. Open **http://localhost:3000**

## Environment Variables

The app is designed to keep working — with safe fallbacks — even if every value below is left blank, so a missing key never breaks a live demo.

| Variable | Required? | Effect if blank |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Recommended | Falls back to the shared hackathon demo project hardcoded in `lib/supabaseClient.js` — set your own so you're not sharing one database with everyone else running this repo |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Recommended | Same as above |
| `XAI_API_KEY` | Optional | AI assistant automatically switches to a grounded rule-based reply |
| `GROK_MODEL` | Optional | Defaults to `grok-4-fast` |

`.env.local` is already git-ignored — never commit real keys.

## Security Model

- **Admin is never self-serve.** `/signup` only offers Customer or Employee. To create an Admin:
  1. Sign up normally as a customer.
  2. In Supabase Dashboard → SQL Editor, run:
     ```sql
     update users set role = 'admin' where id = '<their auth user id>';
     ```
     (find the user id under Supabase → Authentication → Users)
- **Enforced twice, not once.** The `users` table's Row Level Security policy independently blocks any signup from ever inserting itself as `admin` — even if the frontend were bypassed entirely, the database rejects it.
- **Private storage, signed access.** Payment screenshots live in a private bucket; only short-lived signed URLs (generated on approval review) can view them — there is no public link to a customer's proof of payment.

## Fraud Prevention: How a Sale Becomes a Commission

This is the platform's core trust mechanism, and it's worth understanding in full:

1. A seller **never** creates a commission directly. Confirming a walk-in sale on the Employee dashboard uploads the payment screenshot to the private bucket and creates a `Pending` row in `sale_requests` — no `orders` or `commissions` row exists yet.
2. The Admin dashboard's **Sale requests** panel lists every pending request and lets the Admin open the screenshot (via a short-lived signed URL) to verify proof of payment.
3. Only on **Approve** does the app create the real `orders` row and calculate the `commissions` row — this is the *only* moment a seller's commission total increases.
4. **Reject** leaves the request marked `Rejected` — no order or commission is ever created from it.
5. Customers checking out through the public storefront still use the original instant `placeOrder()` flow — this approval step exists specifically for sales an employee records themselves.

Without this step, any seller could claim a fake sale and pocket a commission. With it, every walk-in sale passes a human check before company money — commission *and* Education Fund contribution — is ever released.

## Revenue & Commission Structure

- Each product category carries its own seller commission percentage, reflecting that margin differs by category (software licenses margin higher than telecom data bundles, for example).
- The **Education Fund receives a flat 5% of company revenue** — calculated *after* seller commission is taken out, and never deducted from the seller's own earnings. This keeps seller income stable and the fund's growth predictable and separate.

## AI Sales Assistant

The Employee dashboard's chat calls `pages/api/ai-assistant.js`, which talks to xAI's Grok API and provides:

- **Product recommendations** — contextual to the seller's assigned product.
- **Sales script generation** — ready-to-say pitch lines for a customer conversation.
- **FAQ / objection handling** — answers to common customer pushback.
- **Reliability-first fallback** — if the Grok call fails or no key is configured, an instant rule-based reply is returned instead of an error, so the demo (or a live seller mid-conversation) never breaks.

Voice input/output was originally scoped but isn't wired up yet — the mic button was removed deliberately rather than shipping something half-working. It remains a near-term roadmap item.

## Public Impact Page

`/impact` is a public, no-login page showing real, live numbers pulled from Supabase: sellers employed, sales completed, total commissions paid out, and total Education Fund contribution. It calls a `security definer` SQL function (`get_platform_impact`, defined in `schema.sql`) so that anonymous visitors only ever see these 4 aggregate numbers — never any individual user's row-level data. It's linked from the storefront footer as "Our impact," and exists specifically because the Education Fund's credibility depends on visible proof that it's actually growing.

## End-to-End Test Flow

Run through this once after setup to see the whole product work together:

1. Sign up as a customer, then promote that account to **admin** as described in [Security Model](#security-model) → log out.
2. Sign up as an **employee** (this auto-creates a Pending application) → log out.
3. Log in as **admin** at `/login` → approve the employee's application, assigning a product.
4. Log in as the **employee** → under "Just sold to a customer? Confirm it here," fill in the customer's details, attach a payment screenshot, and submit. This creates a **Pending** sale request — no commission yet.
5. Log in as **admin** → open **Sale requests (payment screenshot approval)** → "View screenshot" to check proof of payment → Approve (or Reject).
6. Log in as the **employee** again → the commission summary now updates, reflecting only Admin-approved sales.
7. Visit `/impact` (no login needed) to see the same activity reflected in the platform's public numbers.

## Roadmap

**Immediate next steps**
- Wire up the in-app voice assistant (Speech-to-Text → AI → Text-to-Speech), replacing the removed mic button.
- AI first-level pre-check on new seller applications (CNIC/NGO-reference format check) before they reach the Admin queue.
- A seller-selection dropdown at storefront checkout (currently auto-assigned to keep the MVP simple).

**Standard e-commerce essentials**
- Real payment gateways (JazzCash, Easypaisa, card, bank transfer) — checkout is currently mock/manual.
- Inventory/vendor management, invoicing, coupons, product reviews, SEO.
- Returns/disputes, Terms of Service / Privacy Policy pages, a customer helpdesk, and a BI/analytics dashboard.

**Seller-focused (low-income context)**
- Mobile-wallet payouts for sellers without a bank account.
- Low-data / SMS fallback mode, and simple audio/video training material.
- A tiered commission / growth path for long-tenured sellers.

**Business & compliance**
- Business registration and tax compliance (SECP, etc.), vendor/supplier contracts.
- KYC/AML compliance if payment volume grows; liability coverage for seller-side fraud.
- Full WhatsApp Business API integration for off-website voice/text access.

**New revenue line — in-house AI tools for shops (Phase 2)**
Beyond reselling third-party licenses, Rozgar's Phase 2 plan has the platform build and sell its own lightweight AI tools to small shopkeepers on a recurring subscription basis — using the same seller network to pitch and onboard shop owners. This turns a one-time resale commission model into a recurring-revenue business line, feeding the same Education Fund from a second, more stable source.

## Team

Rozgar was built by a 6-member team with clearly divided ownership: frontend for the customer experience, frontend for the employee/admin dashboards, backend/database, AI integration, voice (in progress), and pitch/demo/data coordination — structured deliberately like departments in a real company rather than an undifferentiated group project.

## Notes & Known Limitations

- Checkout currently auto-assigns an approved seller for the chosen product to keep the MVP simple; a seller-selection dropdown is a straightforward addition later.
- Voice input/output is intentionally not wired up (see [Roadmap](#roadmap)) rather than shipped in a broken state.
- The AI pre-check on new seller applications does not exist yet — every application is reviewed directly by a human Admin in this MVP.
