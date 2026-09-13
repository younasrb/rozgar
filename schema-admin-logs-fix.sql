-- NOTE: this migration is now folded into schema.sql — a fresh setup only needs to run
-- schema.sql. Keep this file only if you already ran it separately against an older deploy.

-- ================================================================
-- Rozgar — Admin Management + Activity Log Migration
-- Run this ONCE in Supabase Dashboard > SQL Editor > New Query > Run.
-- Safe to re-run (idempotent).
-- ================================================================

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
