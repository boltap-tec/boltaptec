-- BoltAp — grant the publishable/anon key full access (DEMO).
-- Robust version: `if exists` so a missing table can't abort the whole script,
-- and blanket grants so every current & future table is covered.
-- Run this ONCE in the Supabase SQL editor after schema.sql.
--
-- ⚠️ DEMO SECURITY: open access. Tighten (RLS + real auth) before production.

alter table if exists public.employees        disable row level security;
alter table if exists public.attendance       disable row level security;
alter table if exists public.ledger           disable row level security;
alter table if exists public.salary_details   disable row level security;
alter table if exists public.salary_postings  disable row level security;
alter table if exists public.advance_requests disable row level security;
alter table if exists public.settings         disable row level security;

grant usage on schema public to anon, authenticated;
grant all on all tables    in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- make future tables accessible too
alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
