-- BoltAp — grant the publishable/anon key full access (DEMO).
-- Run this ONCE in the Supabase SQL editor. Disables RLS and grants table
-- privileges, so the app can read & write with its public key.
--
-- ⚠️ DEMO SECURITY: open access. Tighten (RLS + real auth) before production.

do $$
declare t text;
begin
  foreach t in array array[
    'employees','attendance','ledger','salary_details',
    'salary_postings','advance_requests','settings'
  ]
  loop
    execute format('alter table public.%I disable row level security;', t);
    execute format('grant all privileges on public.%I to anon, authenticated;', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
