-- Authenticated users can select and update only their own public.users row.
-- The existing "Users can update own user record" RLS policy enforces id = auth.uid().
grant usage on schema public to authenticated;
grant select, update on table public.users to authenticated;
