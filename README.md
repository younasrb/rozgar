<div align="center">

# 🚀 Rozgar
### AI-Powered Reselling & Education Fund Platform

**"Create income today, educate the next generation tomorrow."**

Rozgar turns anyone — with zero formal sales experience — into a verified, AI-guided digital reseller who earns real commission. A fixed slice of every rupee earned is automatically routed into an **Education Fund** for children from low-income families. Not charity — a byproduct of real, verified business.

<p>
  <img alt="frontend" src="https://img.shields.io/badge/frontend-Next.js-black?style=for-the-badge&logo=next.js">
  <img alt="database" src="https://img.shields.io/badge/database-Supabase-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white">
  <img alt="ai" src="https://img.shields.io/badge/AI-xAI%20Grok-8A2BE2?style=for-the-badge">
  <img alt="status" src="https://img.shields.io/badge/status-Hackathon%20MVP-orange?style=for-the-badge">
</p>

`Seller applies` → `Admin approves` → `AI assists the sale` → `Sale verified` → `Commission released` → `Education Fund grows` → **`Impact visible, live`**

</div>

---

## 📑 Table of Contents

| | | |
|---|---|---|
| [🎯 Why Rozgar Exists](#-why-rozgar-exists) | [🏗️ Architecture](#️-architecture) | [🔐 Security Model](#-security-model) |
| [✨ What's Included](#-whats-included-hackathon-mvp) | [🧰 Tech Stack](#-tech-stack) | [🛡️ Fraud Prevention](#️-fraud-prevention-how-a-sale-becomes-a-commission) |
| [🚦 Getting Started](#-getting-started) | [📁 Project Structure](#-project-structure) | [💰 Revenue & Commission](#-revenue--commission-structure) |
| [🤖 AI Sales Assistant](#-ai-sales-assistant) | [📊 Public Impact Page](#-public-impact-page) | [✅ Test Flow](#-end-to-end-test-flow) |
| [🗺️ Roadmap](#️-roadmap) | [👥 Team](#-team) | [⚠️ Known Limitations](#️-notes--known-limitations) |

---

## 🎯 Why Rozgar Exists

Two problems. One system.

| 😟 The Problem | ✅ How Rozgar Solves It |
|---|---|
| Formal jobs are scarce — a job-listing portal only shows existing vacancies, it doesn't *create* income | Rozgar turns anyone into a verified reseller of digital products, earning commission with **zero prior sales experience** |
| A household's financial stress raises the risk of child dropout / child labour | A flat, non-negotiable slice of company revenue is automatically diverted into an **Education Fund** — funded by business, not donations |

Job portals, generic e-commerce, generic chatbots — each solve *half* of this. Rozgar solves both halves with the same transaction.

---

## ✨ What's Included (Hackathon MVP)

| Feature | Status |
|---|---|
| 🛒 Public storefront — browse + guest checkout, no login needed | ✅ Live |
| 📝 Seller onboarding — signup → pending application → Admin approval | ✅ Live |
| 💼 Employee dashboard — AI chat, assigned product, live commission summary | ✅ Live |
| 🛡️ Fraud-safe walk-in sales — screenshot upload → Admin review → Approve/Reject | ✅ Live |
| 🧑‍💼 Admin dashboard — approvals, product management, sale review | ✅ Live |
| 📊 Public `/impact` page — live aggregate numbers, zero private-data leakage | ✅ Live |
| 🎧 In-app voice assistant | 🔜 Roadmap |
| 🤖 AI pre-check on new seller applications | 🔜 Roadmap |

3 seeded pilot categories at launch: **Antivirus/Security · Online Courses · Mobile Data bundles.**

---

## 🏗️ Architecture

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

All three dashboards share **one** Next.js codebase and **one** data layer (`lib/api.js`) — a price or commission % changed once is instantly consistent everywhere.

---

## 🧰 Tech Stack

| Layer | Choice | Why |
|---|---|---|
| 🎨 Frontend | Next.js (React 18) | File-based routing, ships a 3-dashboard app from one codebase |
| 🗄️ Database + Auth | Supabase (Postgres) | Generous free tier + SQL-based Row Level Security enforced at the DB, not just the frontend |
| 📦 File storage | Supabase Storage (2 buckets) | `product-images` public, `payment-screenshots` private + signed-URL access |
| 🤖 AI assistant | xAI Grok + rule-based fallback | Reliability-first — the assistant never breaks a live demo |
| ☁️ Hosting (recommended) | Vercel | Free tier pairs naturally with Next.js + Supabase |

> **Note:** the original plan used Firebase; the as-built platform uses Supabase instead, for the same role-based-auth goal but with database-enforced Row Level Security.

---

## 📁 Project Structure

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
│   ├── supabaseClient.js   ← Supabase client (falls back to shared demo project)
│   ├── auth.js             ← signUp, signIn, signOut, getCurrentUser
│   └── api.js              ← applications, orders, commissions, sale requests
└── pages/
    ├── _app.js
    ├── index.js            ← public storefront (browse + guest checkout)
    ├── login.js            ← staff (seller/admin) login
    ├── signup.js           ← customer / employee signup (never admin)
    ├── impact.js           ← public /impact aggregate-numbers page
    ├── customer/index.js   ← redirects to "/" (kept for old links)
    ├── employee/index.js   ← seller dashboard (AI chat, commission, confirm sale)
    ├── admin/index.js      ← admin dashboard (approvals, products, sale requests)
    └── api/ai-assistant.js ← Grok-powered sales assistant + rule-based fallback
```

---

## 🚦 Getting Started

1. **Run the database schema** — open `schema.sql`, copy it all, run in **Supabase → SQL Editor → New Query**. Creates every table, RLS policy, function, and seeds the 3 pilot products.
   *(`schema-admin-logs-fix.sql` / `schema-seller-assignment-fix.sql` are old migrations already folded into `schema.sql` — you only need `schema.sql` on a fresh project.)*
2. **Create two Storage buckets:**
   - `product-images` → **Public: ON**
   - `payment-screenshots` → **Public: OFF** (private, viewed only via short-lived signed URLs)
3. **Set environment variables** — copy `env.local.example` → `.env.local`, fill in your Supabase URL + anon key. See [table below](#-environment-variables).
4. **Install dependencies**
   ```bash
   npm install
   ```
5. **Run the dev server**
   ```bash
   npm run dev
   ```
6. Open **http://localhost:3000** 🎉

### 🔑 Environment Variables

| Variable | Required? | If left blank |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Recommended | Falls back to a shared hackathon demo project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Recommended | Same as above |
| `XAI_API_KEY` | Optional | AI assistant switches to a rule-based reply |
| `GROK_MODEL` | Optional | Defaults to `grok-4-fast` |

`.env.local` is already git-ignored — never commit real keys.

---

## 🔐 Security Model

- 🚫 **Admin is never self-serve.** `/signup` only offers Customer or Employee. To create an Admin: sign up as a customer, then in Supabase SQL Editor run:
  ```sql
  update users set role = 'admin' where id = '<their auth user id>';
  ```
- 🔒 **Enforced twice, not once.** Row Level Security on `users` independently blocks any signup from inserting itself as `admin` — even if the frontend were bypassed, the database rejects it.
- 🖼️ **Private storage, signed access.** Payment screenshots live in a private bucket; only short-lived signed URLs can view them — never a public link.

---

## 🛡️ Fraud Prevention: How a Sale Becomes a Commission

```
Seller confirms sale  →  screenshot uploaded  →  "Pending" sale_request created
        │                                              (no commission yet)
        ▼
Admin opens signed screenshot URL  →  reviews proof of payment
        │
        ├── ✅ Approve → real order + commission created (only trigger point!)
        └── ❌ Reject  → marked Rejected, nothing ever created
```

Customers checking out through the public storefront still use the instant `placeOrder()` flow — this approval gate exists specifically for sales an **employee** records themselves. Without it, a seller could fabricate a sale and pocket a commission; with it, every walk-in sale passes a human check before company money moves.

---

## 💰 Revenue & Commission Structure

- Each product category has its own seller commission % (software licenses margin higher than telecom data bundles, for example).
- The **Education Fund gets a flat 5% of company revenue** — calculated *after* seller commission, and never deducted from the seller's earnings. Seller income stays stable; fund growth stays predictable.

---

## 🤖 AI Sales Assistant

`pages/api/ai-assistant.js` talks to xAI's Grok API and gives sellers:

- 🎯 **Product recommendations** — contextual to their assigned product
- 💬 **Sales script generation** — ready-to-say pitch lines
- ❓ **FAQ / objection handling** — answers to common pushback
- 🛟 **Reliability-first fallback** — if Grok fails or no key is set, an instant rule-based reply fires instead of an error, so a live demo (or a real seller mid-chat) never breaks

Voice input/output was scoped but isn't wired up yet — the mic button was deliberately removed rather than shipped half-working. Near-term roadmap item.

---

## 📊 Public Impact Page

`/impact` — a public, no-login page with real, live numbers: sellers employed, sales completed, commissions paid, Education Fund total. Powered by a `security definer` SQL function (`get_platform_impact`) so anonymous visitors see only 4 aggregate numbers — **zero row-level data exposure.** Linked from the storefront footer as "Our impact," because the Education Fund's credibility depends on visible, live proof it's actually growing.

---

## ✅ End-to-End Test Flow

1. Sign up as a customer → promote to **admin** (see [Security Model](#-security-model)) → log out.
2. Sign up as an **employee** (auto-creates a Pending application) → log out.
3. Log in as **admin** → approve the employee's application, assigning a product.
4. Log in as **employee** → "Confirm sale" with customer details + payment screenshot → creates a Pending sale request.
5. Log in as **admin** → open **Sale requests** → view screenshot → Approve / Reject.
6. Log in as **employee** again → commission summary updates for approved sales only.
7. Visit `/impact` (no login) → see the same activity reflected in the live public numbers.

---

## 🗺️ Roadmap

<details>
<summary><b>🔜 Immediate next steps</b></summary>

- Wire up the in-app voice assistant (Speech-to-Text → AI → Text-to-Speech)
- AI first-level pre-check on new seller applications (CNIC/NGO-reference format check)
- Seller-selection dropdown at storefront checkout (currently auto-assigned)
</details>

<details>
<summary><b>🛒 Standard e-commerce essentials</b></summary>

- Real payment gateways (JazzCash, Easypaisa, card, bank transfer)
- Inventory/vendor management, invoicing, coupons, product reviews, SEO
- Returns/disputes, ToS/Privacy pages, helpdesk, BI/analytics dashboard
</details>

<details>
<summary><b>🤝 Seller-focused (low-income context)</b></summary>

- Mobile-wallet payouts for sellers without a bank account
- Low-data / SMS fallback mode + simple audio/video training material
- Tiered commission / growth path for long-tenured sellers
</details>

<details>
<summary><b>🏛️ Business & compliance</b></summary>

- Business registration & tax compliance (SECP, etc.), vendor/supplier contracts
- KYC/AML compliance at scale; liability coverage for seller-side fraud
- Full WhatsApp Business API integration for off-website access
</details>

<details>
<summary><b>💡 New revenue line — in-house AI tools for shops (Phase 2)</b></summary>

Beyond reselling third-party licenses, Phase 2 has Rozgar build and sell its own lightweight AI tools to small shopkeepers on recurring subscription — using the same seller network to pitch and onboard shop owners. One-time resale commission → recurring SaaS revenue, feeding the same Education Fund from a second, more stable source.
</details>

---

## 👥 Team

Built by a 6-member team with clearly divided ownership — customer-facing frontend, employee/admin dashboards, backend/database, AI integration, voice (in progress), and pitch/demo/data coordination — structured like departments in a real company, not an undifferentiated group project.

---

## ⚠️ Notes & Known Limitations

> ⚠️ **Everything is currently public / unverified.** As of this build, the `/admin` route and seller (employee) account creation are **not gated by any real verification** — anyone can reach the admin panel, and a seller account can be created without going through an actual identity/approval check. Fine for a hackathon demo, but a **must-fix before any real deployment**: lock `/admin` behind real authentication + role checks (frontend route guard *and* Supabase RLS), and require genuine Admin approval before any dashboard access is granted, not just before commissions are paid out.

- Checkout currently auto-assigns an approved seller for the chosen product to keep the MVP simple.
- Voice input/output is intentionally not wired up rather than shipped in a broken state.
- The AI pre-check on new seller applications doesn't exist yet — every application is reviewed directly by a human Admin.

<div align="center">

---

**Rozgar** — *Create income today, educate the next generation tomorrow.* 🌱

</div>
