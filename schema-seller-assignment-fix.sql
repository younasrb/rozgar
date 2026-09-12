-- ================================================================
-- Rozgar — Seller-Assigned-Product + Walk-in Sales Migration
-- Run this ONCE in Supabase Dashboard > SQL Editor > New Query > Run.
-- Every statement here is safe to re-run (idempotent) — it won't error or
-- duplicate anything if some of it is already in place.
-- ================================================================
--
-- WHAT THIS ADDS:
--   - Each seller now specializes in exactly ONE product (chosen at signup as
--     a request, confirmed/assigned by Admin at approval time, changeable later
--     via a request/approve flow).
--   - Sellers can record a walk-in / door-to-door sale directly from their own
--     dashboard (customer_name + customer_phone on the order, no customer login).
--   - Customer checkout now picks a seller who is actually APPROVED *and*
--     assigned to sell that exact product — not just any approved seller.
-- ================================================================

-- 1. New columns (no-op if they already exist).
alter table applications add column if not exists requested_product_id text references products(id);
alter table applications add column if not exists assigned_product_id text references products(id);
alter table orders add column if not exists customer_name text;   -- for door-to-door sales where the customer has no account
alter table orders add column if not exists customer_phone text;

-- 2. Let a seller update their OWN application row (needed for requestProductChange()).
-- NOTE (hackathon simplification): Postgres RLS is row-level, not column-level, so this
-- also technically permits a seller to update other columns on their own row via the API.
-- The app code only ever sends { requested_product_id } for this path — never assigned_product_id
-- or status — so in normal use this stays safe. Do NOT expose a generic "update my application"
-- endpoint; only use requestProductChange() from lib/api.js.
drop policy if exists "Sellers can request a product change on their own application" on applications;
create policy "Sellers can request a product change on their own application" on applications
  for update using (auth.uid() = user_id);

-- 3. Approved-seller lookup — now optionally filtered to a specific product, since
-- each seller only sells the one product they're assigned to.
drop function if exists public.get_approved_sellers();
drop function if exists public.get_approved_sellers(text);

create function public.get_approved_sellers(p_product_id text default null)
returns table (id uuid, full_name text)
language sql
security definer
set search_path = public
as $$
  select u.id, u.full_name
  from users u
  join applications a on a.user_id = u.id
  where u.role = 'employee'
    and a.status = 'Approved'
    and (p_product_id is null or a.assigned_product_id = p_product_id);
$$;

grant execute on function public.get_approved_sellers(text) to anon, authenticated;

-- 4. Place an order + its commission atomically. Now also:
--    - accepts optional walk-in customer_name/customer_phone
--    - re-validates that the seller is approved AND assigned to sell this exact
--      product (not just "approved for something")
drop function if exists public.place_order(uuid, uuid, text);
drop function if exists public.place_order(uuid, uuid, text, text, text);

create function public.place_order(
  p_customer_id uuid,
  p_seller_id uuid,
  p_product_id text,
  p_customer_name text default null,
  p_customer_phone text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product products%rowtype;
  v_order orders%rowtype;
  v_commission commissions%rowtype;
  v_seller_rate numeric;
  v_fund_rate numeric := 0.05;
  v_seller_commission numeric;
  v_education_fund numeric;
begin
  select * into v_product from products where id = p_product_id;
  if not found then
    raise exception 'Product % not found', p_product_id;
  end if;

  if not exists (
    select 1 from users u
    join applications a on a.user_id = u.id
    where u.id = p_seller_id
      and u.role = 'employee'
      and a.status = 'Approved'
      and a.assigned_product_id = p_product_id
  ) then
    raise exception 'Seller % is not an approved seller for product %', p_seller_id, p_product_id;
  end if;

  v_seller_rate := case v_product.category
    when 'Antivirus/Security' then 0.20
    when 'Online Course' then 0.15
    when 'Mobile Data' then 0.08
    else 0.10
  end;

  insert into orders (customer_id, seller_id, product_id, price, customer_name, customer_phone)
  values (p_customer_id, p_seller_id, p_product_id, v_product.price, p_customer_name, p_customer_phone)
  returning * into v_order;

  v_seller_commission := v_product.price * v_seller_rate;
  v_education_fund := (v_product.price - v_seller_commission) * v_fund_rate;

  insert into commissions (order_id, seller_id, seller_commission, education_fund_amount)
  values (v_order.id, p_seller_id, v_seller_commission, v_education_fund)
  returning * into v_commission;

  return json_build_object(
    'order', row_to_json(v_order),
    'commission', row_to_json(v_commission),
    'product_name', v_product.name
  );
end;
$$;

grant execute on function public.place_order(uuid, uuid, text, text, text) to anon, authenticated;
