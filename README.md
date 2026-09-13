# Rozgar — Full Project (Next.js + Supabase)

Everything in one place: database schema, backend functions, and the Next.js frontend.

## Setup (in this order)

1. **Run the database schema.** Open `schema.sql`, copy the whole file, paste it into
   Supabase Dashboard → SQL Editor → New Query → Run. This creates all tables, security
   policies, functions, and seeds the 3 products. (`schema-admin-logs-fix.sql` and
   `schema-seller-assignment-fix.sql` are older migrations that are now folded into
   `schema.sql` — you only need to run `schema.sql` on a fresh project.)
2. Create two Storage buckets:
   - `product-images` — **Public bucket ON**.
   - `payment-screenshots` — **Public bucket OFF** (holds proof-of-payment screenshots, so it
     must stay private; screenshots are viewed via short-lived signed URLs, never a public link).
3. Copy `env.local.example` to `.env.local` and fill in your own Supabase URL + anon key
   (Supabase Dashboard → Project Settings → API). Everything else in that file is optional —
   see the comments in `env.local.example` for what each key unlocks and what happens if
   it's left blank.
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
rozgar-main/
  schema.sql             <- run this in Supabase first
  env.local.example      <- copy to .env.local and fill in
  lib/
    supabaseClient.js     <- reads URL + key from .env.local (falls back to shared demo project)
    auth.js               <- signup/login functions
    api.js                <- applications, orders, commissions functions
  pages/
    index.js               <- public storefront (browse + guest checkout)
    login.js                <- staff (seller/admin) login
    signup.js               <- signup (customer / employee only — see Security below)
    customer/index.js       <- redirects to "/" (kept so old links still work)
    employee/index.js       <- employee (seller) dashboard
    admin/index.js          <- admin dashboard
    api/
      ai-assistant.js        <- AI sales assistant (xAI Grok, with rule-based fallback)
```

## What's included

| Page | Route | What it does |
| --- | --- | --- |
| Storefront | `/` | Browse products and guest checkout — no login required |
| Staff login | `/login` | Log in as seller or admin, redirects based on role |
| Signup | `/signup` | Create account as customer or employee (seller). Employees auto-create a pending application |
| Employee dashboard | `/employee` | AI sales assistant (chat + voice), assigned product, live commission summary, record a sale with a payment screenshot |
| Admin dashboard | `/admin` | Approve/reject seller applications and sale requests, manage products |

## Security: how Admin accounts work

Admin is **not** a self-serve option on `/signup` — the signup form only offers Customer or
Seller. This matters because the whole approval flow (admin approves sellers, admin approves
sale requests) only works if "admin" is a trusted, limited role. To create an admin account:

1. Sign up normally as a customer.
2. In Supabase Dashboard → SQL Editor, run:
   ```sql
   update users set role = 'admin' where id = '<their auth user id>';
   ```
   (Find the user id in Supabase → Authentication → Users.)

The database also enforces this independently of the frontend: the RLS policy on `users` only
allows a signed-up account to insert its own profile as `customer` or `employee`, never `admin`.

## Test flow (do this first)

1. Sign up as a customer, then promote that account to admin as described above → log out.
2. Sign up as **employee** (this auto-creates a Pending application) → log out.
3. Log in as **admin** at `/login` → approve the employee's application, assigning a product.
4. Log in as the **employee** account → in "Just sold to a customer? Confirm it here", fill in
   the customer's details, attach a payment screenshot, and submit. This does **not** add
   commission yet — it just sends a Pending sale request to the Admin.
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
  — that's the only moment a seller's commission total goes up. **Reject** leaves the request
  marked `Rejected` with no order or commission ever created.
- Customers checking out through the main storefront still go through the original instant
  `placeOrder()` flow — this approval step only applies to sales an employee records themselves
  on their dashboard.

## AI assistant

The Employee dashboard's chat calls `pages/api/ai-assistant.js`, which talks to xAI's Grok API
(see `env.local.example` for the key). If no key is set, or the request fails for any reason, it
automatically replies using a grounded rule-based fallback — the assistant never breaks a demo
either way. Voice input/output (Member 5's task) isn't wired up yet — the mic button was removed
until that's built properly, rather than shipping one that doesn't work.

## Fraud prevention: sale requests are now actually enforced

`schema.sql` always defined a `sale_requests` table + storage policies for door-to-door sales
with proof-of-payment, and the README described that flow — but the frontend was never wired to
it, so recording a walk-in sale used to create an instant, unverified commission. That's fixed:

- Employee dashboard's "Confirm sale" form now requires a payment screenshot and calls
  `createSaleRequest()`, which creates a `Pending` row — no commission yet.
- Admin dashboard has a "Sale requests" panel to view the screenshot (via a short-lived signed
  URL) and Approve or Reject. Only Approve creates the real order + commission.

## Public impact page (`/impact`)

A public, no-login page showing the platform's real numbers pulled live from Supabase: sellers
employed, sales completed, total commissions paid out, and total contributed to the Education
Fund. It calls a `security definer` SQL function (`get_platform_impact`, in `schema.sql`) so
anonymous visitors see only these 4 aggregate numbers — never row-level access to any user's
data. Linked from the storefront footer ("Our impact").

## Notes

- Checkout currently auto-assigns an approved seller for the chosen product to keep the demo
  simple — you can add a seller-selection dropdown later if needed.
