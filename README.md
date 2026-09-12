# Rozgar — Full Project (Next.js + Supabase)

Everything in one place: database schema, backend functions, and the Next.js frontend.

## Setup (in this order)

1. **Run the database schema first.** Open `schema.sql`, copy the whole file, paste it into
   Supabase Dashboard → SQL Editor → New Query → Run. This creates all tables, security
   policies, and seeds the 3 products.
2. Open `lib/supabaseClient.js` and paste in your real `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   (from Supabase Dashboard → Project Settings → API).
   Also create a second Storage bucket named exactly `payment-screenshots` (Storage → New bucket).
   **Leave "Public bucket" OFF** for this one — it holds proof-of-payment screenshots, so it
   must stay private (screenshots are viewed via short-lived signed URLs, never a public link).
3. Install dependencies:
   ```
   npm install
   ```
4. Run the dev server:
   ```
   npm run dev
   ```
5. Open **http://localhost:3000**

## Project structure

```
rozgar-project/
  schema.sql          <- run this in Supabase first
  lib/
    supabaseClient.js  <- put your URL + key here
    auth.js            <- signup/login functions
    api.js             <- applications, orders, commissions functions
  pages/
    index.js           <- login
    signup.js           <- signup (customer/employee/admin)
    customer/index.js   <- customer dashboard
    employee/index.js   <- employee dashboard
    admin/index.js      <- admin dashboard
```

## What's included

| Page | Route | What it does |
| --- | --- | --- |
| Login | `/` | Log in, redirects based on role |
| Signup | `/signup` | Create account as customer / employee (seller) / admin. Employees auto-create a pending application. |
| Customer dashboard | `/customer` | Browse products, add to cart, checkout (creates real orders), view order history |
| Employee dashboard | `/employee` | Rule-based AI sales assistant chat, assigned products, live commission summary, record a sale with a payment screenshot |
| Admin dashboard | `/admin` | View + approve/reject pending seller applications |

## Test flow (do this first)

1. Sign up as **admin** → note this account, log out.
2. Sign up as **employee** (this auto-creates a Pending application) → log out.
3. Log in as **admin** → approve the employee's application.
4. Log in as the **employee** account → in "Just sold to a customer? Confirm it here", fill in the
   customer's details, attach a payment screenshot, and submit. This does **not** add commission
   yet — it just sends a Pending sale request to the Admin.
5. Log in as **admin** → open the "Sale requests (payment screenshot approval)" panel → click
   "View screenshot" to check the proof of payment → Approve (or Reject).
6. Log in as the **employee** account again → the commission summary now updates, but only for
   sales the Admin approved.

## How door-to-door sale approval works

- A seller never creates a commission directly. Confirming a sale on the Employee dashboard
  uploads the payment screenshot to a private Storage bucket and creates a `Pending` row in the
  `sale_requests` table — no `orders` or `commissions` row exists yet.
- The Admin dashboard's "Sale requests" panel lists every Pending request, lets the Admin open the
  screenshot (via a short-lived signed URL, since the bucket is private), and Approve or Reject it.
- Only on **Approve** does the app create the real `orders` row and calculate the `commissions` row
  (same math as the old instant-checkout flow) — that's the only moment a seller's commission
  total goes up. **Reject** leaves the request marked `Rejected` with no order or commission ever
  created.
- Customers checking out through the main storefront still go through the original instant
  `placeOrder()` flow — this approval step only applies to sales an employee records themselves
  on their dashboard.

## Notes

- The AI chat on the Employee dashboard is rule-based (no external API key needed) so it never fails during a demo. To upgrade to a real Claude/OpenAI-powered assistant later, replace the `getAIResponse()` function in `pages/employee/index.js` with a fetch call to your AI endpoint (Member 4's task).
- The 🎤 mic button is a placeholder — wire it to Web Speech API (Member 5's task) by calling the same chat input.
- Checkout currently auto-assigns the first approved seller to keep the demo simple — you can add a seller-selection dropdown later if needed.
