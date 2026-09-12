# Rozgar — Full Project (Next.js + Supabase)

Everything in one place: database schema, backend functions, and the Next.js frontend.

## Setup (in this order)

1. **Run the database schema first.** Open `schema.sql`, copy the whole file, paste it into
   Supabase Dashboard → SQL Editor → New Query → Run. This creates all tables, security
   policies, and seeds the 3 products.
2. Open `lib/supabaseClient.js` and paste in your real `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   (from Supabase Dashboard → Project Settings → API).
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
| Employee dashboard | `/employee` | Rule-based AI sales assistant chat, assigned products, live commission summary |
| Admin dashboard | `/admin` | View + approve/reject pending seller applications |

## Test flow (do this first)

1. Sign up as **admin** → note this account, log out.
2. Sign up as **employee** (this auto-creates a Pending application) → log out.
3. Log in as **admin** → approve the employee's application.
4. Sign up as **customer** → browse products → add to cart → checkout.
5. Log in as the **employee** account again → commission summary should now show the sale.

## Notes

- The AI chat on the Employee dashboard is rule-based (no external API key needed) so it never fails during a demo. To upgrade to a real Claude/OpenAI-powered assistant later, replace the `getAIResponse()` function in `pages/employee/index.js` with a fetch call to your AI endpoint (Member 4's task).
- The 🎤 mic button is a placeholder — wire it to Web Speech API (Member 5's task) by calling the same chat input.
- Checkout currently auto-assigns the first approved seller to keep the demo simple — you can add a seller-selection dropdown later if needed.
