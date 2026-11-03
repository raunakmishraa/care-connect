-- Restore the minimum PostgreSQL privileges needed for the client to read its own role.
-- Row-level security remains enabled and restricts visible rows to auth.uid().
grant usage on schema public to authenticated;
grant select on table public.user_roles to authenticated;

drop policy if exists "Users can view own roles" on public.user_roles;
create policy "Users can view own roles"
  on public.user_roles
  for select
  to authenticated
  using (user_id = (select auth.uid()));
