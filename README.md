# Rozgar — Full Project (Next.js + Supabase)

Everything in one place: database schema, backend functions, and the Next.js frontend.

## Setup (in this order)

1. **Run the database schema first.** Open `schema.sql`, copy the whole file, paste it into
   Supabase Dashboard → SQL Editor → New Query → Run. This creates all tables, security
   policies/functions, and seeds the 3 products.
   - Already have a Rozgar database running? Don't re-run `schema.sql` (it has `create table`
     statements that will fail on existing tables) — instead run `schema-seller-assignment-fix.sql`,
     which only adds/updates what's needed and is safe to re-run.
2. `lib/supabaseClient.js` already has this project's real `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   filled in. If you're pointing at a different Supabase project, replace them (Supabase
   Dashboard → Project Settings → API).
3. Copy `.env.local.example` to `.env.local` and fill in:
   - `XAI_API_KEY` — powers the Employee Dashboard's AI sales assistant (get one at console.x.ai).
     Without it, the assistant automatically falls back to a simple rule-based reply.
   - `ELEVENLABS_API_KEY` (optional) — makes the AI's spoken voice replies sound natural
     (get one at elevenlabs.io). Without it, voice replies fall back to the browser's
     built-in text-to-speech.
4. Install dependencies:
   ```
   npm install
   ```
5. Run the dev server:
   ```
   npm run dev
   ```
6. Open **http://localhost:3000**

## Project structure

```
rozgar-project/
  schema.sql                          <- fresh install: run this in Supabase first
  schema-seller-assignment-fix.sql    <- already have a DB? run this instead (idempotent)
  lib/
    supabaseClient.js  <- Supabase URL + key
    auth.js            <- signup/login functions
    api.js             <- applications, orders, commissions, product-assignment functions
  pages/
    index.js            <- customer marketplace (browse, cart, checkout) — this is the home page
    login.js             <- staff (employee/admin) login
    signup.js            <- signup (customer/employee/admin) — employees pick a product to sell
    customer/index.js    <- redirects to / (kept for old links/bookmarks)
    employee/index.js    <- employee (seller) dashboard
    admin/index.js       <- admin dashboard
    api/ai-assistant.js  <- server-side Grok-powered AI sales assistant (text + voice)
    api/tts.js           <- server-side ElevenLabs text-to-speech proxy
```

## What's included

| Page | Route | What it does |
| --- | --- | --- |
| Customer marketplace | `/` | Browse products, add to cart, checkout as guest or logged-in customer (creates real orders), view order history |
| Staff login | `/login` | Log in as employee or admin |
| Signup | `/signup` | Create account as customer / employee (seller, picks a product they want to sell) / admin |
| Employee dashboard | `/employee` | Your one assigned product, record walk-in sales, request to switch products, AI sales assistant (text + voice) |
| Admin dashboard | `/admin` | Approve/reject applications (assigning each seller a product), manage approved sellers' product assignments, manage the product catalog |

## The seller-assigned-product model

Each approved seller specializes in **exactly one product** at a time:
- At signup, a seller picks which product they'd like to sell (`requested_product_id`).
- Admin approves the application and confirms/assigns the actual product (`assigned_product_id`)
  — usually the same one, but Admin has final say.
- A seller can request to switch to a different product later; Admin approves or rejects the
  switch. Admin can also directly reassign a seller's product at any time, no request needed.
- Customer checkout looks up sellers who are **approved AND assigned to that exact product**
  and randomly picks one to credit with the sale — not just "any approved seller."
- Sellers can also record a **walk-in / door-to-door sale** directly from their own dashboard
  (customer name + phone, no customer account needed) for in-person sales.

## Test flow (do this first)

1. Sign up as **admin** → note this account, log out.
2. Sign up as **employee** (pick a product you'd like to sell — this creates a Pending
   application) → log out.
3. Log in as **admin** → approve the employee's application, assigning them a product.
4. Go to `/` as a guest (or sign up as **customer**) → browse products → add to cart → checkout.
5. Log in as the **employee** account again → commission summary should now show the sale.

## Notes

- The AI sales assistant (`pages/api/ai-assistant.js`) calls xAI's Grok API with a system prompt
  grounded in the live product catalog, and automatically falls back to a simple rule-based reply
  if no API key is set or the call fails — it never breaks the demo either way.
- The 🎤 mic button uses the browser's built-in Web Speech API for voice input, and replies are
  spoken back using ElevenLabs (falling back to the browser's built-in voice if that's not
  configured). Voice input needs a Chromium-based browser (Chrome/Edge) — text always works
  as a fallback everywhere.
- Checkout, order placement, and commission math all run through the `place_order` and
  `get_approved_sellers` Postgres functions (see `schema-seller-assignment-fix.sql`) rather than
  raw table inserts — this keeps an order and its commission atomic (never one without the
  other), and means the seller's approval/product-assignment and the commission amounts are
  always verified/computed on the server, never trusted from the client.
