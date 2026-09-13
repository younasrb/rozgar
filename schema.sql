-- Rozgar Supabase Schema
-- Paste this into Supabase Dashboard > SQL Editor > New Query > Run

-- USERS (extends Supabase auth.users with role + profile info)
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('customer','employee','admin')),
  city text,
  created_at timestamp with time zone default now()
);

-- PRODUCTS
create table products (
  id text primary key,               -- e.g. 'P001'
  name text not null,
  category text not null,            -- 'Antivirus/Security' | 'Online Course' | 'Mobile Data'
  price numeric not null,
  description text,
  image_url text                     -- public URL from the 'product-images' storage bucket
);

-- APPLICATIONS (sellers applying to become employees)
create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  full_name text not null,
  city text,
  ngo_reference text,
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  requested_product_id text references products(id), -- what the seller asked to sell
  assigned_product_id text references products(id),  -- what the Admin actually approved (usually the same)
  created_at timestamp with time zone default now()
);

-- ORDERS
create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references users(id),
  customer_name text,   -- for door-to-door sales where the customer has no account
  customer_phone text,
  seller_id uuid references users(id),
  product_id text references products(id),
  price numeric not null,
  created_at timestamp with time zone default now()
);

-- COMMISSIONS (one row per order, calculated automatically)
create table commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  seller_id uuid references users(id),
  seller_commission numeric not null,
  education_fund_amount numeric not null,
  created_at timestamp with time zone default now()
);

-- SELLER_PRODUCTS (a seller can request to sell as many products as they like;
-- each request needs Admin approval before it counts as "assigned" to that seller)
create table seller_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references users(id) on delete cascade,
  product_id text references products(id),
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  created_at timestamp with time zone default now()
);

-- SALE_REQUESTS (a seller records a sale with proof-of-payment; the order + commission
-- are only created once an Admin reviews the screenshot and approves the request)
create table sale_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references users(id) on delete cascade,
  product_id text references products(id),
  customer_name text not null,
  customer_phone text,
  price numeric not null,                 -- snapshot of the product price at request time
  payment_screenshot_path text not null,  -- path inside the 'payment-screenshots' storage bucket
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  order_id uuid references orders(id),    -- filled in once Admin approves and the order is created
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security (RLS)
alter table users enable row level security;
alter table products enable row level security;
alter table applications enable row level security;
alter table orders enable row level security;
alter table commissions enable row level security;
alter table seller_products enable row level security;
alter table sale_requests enable row level security;

-- Basic policies (hackathon-simple: tighten later if needed)
create policy "Users can view own profile" on users
  for select using (auth.uid() = id);

-- SECURITY: only 'customer' and 'employee' can be self-registered from the public signup
-- form. Without this restriction, anyone could pick "Admin" in the signup dropdown and
-- insert their own profile row with role = 'admin', bypassing every admin-only check in
-- the app. Create admin accounts by signing up as a customer, then promoting the row from
-- the Supabase SQL editor: update users set role = 'admin' where id = '<their auth uid>';
create policy "Users can insert own profile (non-admin roles only)" on users
  for insert with check (auth.uid() = id and role in ('customer', 'employee'));

create policy "Admins can view all users" on users
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "Anyone can view products" on products
  for select using (true); -- customers browse without logging in

create policy "Admins can insert products" on products
  for insert with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "Admins can delete products" on products
  for delete using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "Admins can update products" on products
  for update using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "Users can view own applications" on applications
  for select using (auth.uid() = user_id);

create policy "Admins can view all applications" on applications
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "Admins can update applications" on applications
  for update using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "Sellers can request a product change on their own application" on applications
  for update using (auth.uid() = user_id);
-- NOTE (hackathon simplification): Postgres RLS is row-level, not column-level, so this
-- also technically permits a seller to update other columns on their own row via the API.
-- The app code only ever sends { requested_product_id } for this path — never assigned_product_id
-- or status — so in normal use this stays safe. Do NOT expose a generic "update my application"
-- endpoint; only use requestProductChange() from lib/api.js.

create policy "Anyone authenticated can insert applications" on applications
  for insert with check (auth.role() = 'authenticated');

create policy "Sellers view own orders" on orders
  for select using (auth.uid() = seller_id or auth.uid() = customer_id);

create policy "Anyone can create orders" on orders
  for insert with check (true); -- allows guest checkout, no login required

create policy "Sellers view own commissions" on commissions
  for select using (auth.uid() = seller_id);

create policy "Anyone can insert commissions" on commissions
  for insert with check (true); -- placeOrder() writes this row right after the order

create policy "Anyone can view approved employees" on users
  for select using (role = 'employee'); -- needed so guest checkout can pick a seller to assign

-- Sellers can view their own product requests (Pending/Approved/Rejected), and can create new
-- requests for themselves (always starting Pending — only an Admin can approve/reject).
create policy "Sellers view own seller_products" on seller_products
  for select using (auth.uid() = seller_id);

create policy "Sellers can request a new product (Pending only)" on seller_products
  for insert with check (auth.uid() = seller_id and status = 'Pending');

create policy "Admins view all seller_products" on seller_products
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "Admins can insert seller_products" on seller_products
  for insert with check (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "Admins can approve/reject seller_products" on seller_products
  for update using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

-- Sellers can view their own sale requests (Pending/Approved/Rejected) and create new ones —
-- always starting Pending, since only an Admin can approve/reject. This is what powers the
-- "Confirm sale" flow: the seller uploads a payment screenshot and waits for Admin review
-- before any commission is credited.
create policy "Sellers view own sale requests" on sale_requests
  for select using (auth.uid() = seller_id);

create policy "Sellers can create own sale requests (Pending only)" on sale_requests
  for insert with check (auth.uid() = seller_id and status = 'Pending');

create policy "Admins view all sale requests" on sale_requests
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "Admins can approve/reject sale requests" on sale_requests
  for update using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

-- Seed products (matches mock data used across all member modules)
insert into products (id, name, category, price, description) values
  ('P001', 'SecureShield 1-Year Antivirus License', 'Antivirus/Security', 1000, 'Full-year protection, easy activation, great for first-time sellers.'),
  ('P002', 'Digital Skills Starter Course', 'Online Course', 1500, 'Beginner-friendly online course bundle with certificate.'),
  ('P003', '10GB Monthly Data Bundle', 'Mobile Data', 500, 'Prepaid mobile data bundle, instant activation code.');

-- ================================================================
-- PRODUCT IMAGES (Supabase Storage)
-- IMPORTANT: before running the policies below, first create the bucket:
-- Dashboard > Storage > New bucket > name it exactly "product-images" > toggle "Public bucket" ON > Save.
-- Then run this part.
-- ================================================================

create policy "Public can view product images"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "Admins can upload product images"
on storage.objects for insert
with check (
  bucket_id = 'product-images'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

create policy "Admins can delete product images"
on storage.objects for delete
using (
  bucket_id = 'product-images'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

-- ================================================================
-- PAYMENT SCREENSHOTS (Supabase Storage)
-- These can contain sensitive proof-of-payment info, so this bucket must stay PRIVATE
-- (unlike product-images). Files are viewed via short-lived signed URLs, never public URLs.
-- IMPORTANT: before running the policies below, first create the bucket:
-- Dashboard > Storage > New bucket > name it exactly "payment-screenshots" > leave
-- "Public bucket" OFF > Save.
-- The app always uploads to the path "<seller_id>/<filename>", so a seller's own uploads
-- live in a folder named after their own user id — that's what these policies check.
-- ================================================================

create policy "Sellers can upload own payment screenshots"
on storage.objects for insert
with check (
  bucket_id = 'payment-screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Sellers can view own payment screenshots"
on storage.objects for select
using (
  bucket_id = 'payment-screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Admins can view all payment screenshots"
on storage.objects for select
using (
  bucket_id = 'payment-screenshots'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

-- ================================================================
-- MERGED MIGRATIONS (previously separate schema-*-fix.sql files — folded in here
-- so a fresh setup only needs to run this ONE file). Everything below is
-- idempotent (safe to re-run) and matches schema-admin-logs-fix.sql +
-- schema-seller-assignment-fix.sql exactly, for anyone who already ran those
-- against an existing project.
-- ================================================================

-- --- Admin activity log ---
create table if not exists admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references users(id),
  admin_name text not null,
  action text not null,          -- e.g. 'approved_application', 'rejected_application', 'created_admin'
  details text,
  created_at timestamp with time zone default now()
);

alter table admin_logs enable row level security;

drop policy if exists "Admins can view all logs" on admin_logs;
create policy "Admins can view all logs" on admin_logs
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  );

drop policy if exists "Admins can insert logs" on admin_logs;
create policy "Admins can insert logs" on admin_logs
  for insert with check (auth.role() = 'authenticated');

-- --- Seller-assigned-product + walk-in sales ---
alter table applications add column if not exists requested_product_id text references products(id);
alter table applications add column if not exists assigned_product_id text references products(id);
alter table orders add column if not exists customer_name text;
alter table orders add column if not exists customer_phone text;

drop policy if exists "Sellers can request a product change on their own application" on applications;
create policy "Sellers can request a product change on their own application" on applications
  for update using (auth.uid() = user_id);

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

-- ================================================================
-- PLATFORM IMPACT (public transparency numbers)
-- Powers the public /impact page: how many sellers have jobs on Rozgar, how much
-- they've earned in commission, and how much has gone into the Education Fund.
-- security definer + a narrow return shape means anon visitors get only these
-- 4 aggregate numbers — never row-level access to users, orders, or commissions.
-- ================================================================

drop function if exists public.get_platform_impact();

create function public.get_platform_impact()
returns table (
  sellers_employed bigint,
  total_sales bigint,
  total_commissions_paid numeric,
  total_education_fund numeric
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from applications where status = 'Approved') as sellers_employed,
    (select count(*) from commissions) as total_sales,
    (select coalesce(sum(seller_commission), 0) from commissions) as total_commissions_paid,
    (select coalesce(sum(education_fund_amount), 0) from commissions) as total_education_fund;
$$;

grant execute on function public.get_platform_impact() to anon, authenticated;
