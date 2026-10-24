-- Ensure signed-in users can read and update only their own profile row.
-- Row-level security policies in the initial schema enforce id = auth.uid().
grant usage on schema public to authenticated;
grant select, update on table public.users to authenticated;
