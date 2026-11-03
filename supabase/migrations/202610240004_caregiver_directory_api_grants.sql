-- Ensure the Supabase API roles have table privileges in addition to RLS policies.
-- RLS policies do not grant SQL privileges by themselves.
grant select on table public.caregiver_profiles to anon, authenticated;
grant select on table public.caregiver_services to anon, authenticated;
grant select on table public.service_categories to anon, authenticated;

-- Public users may see service labels only for caregiver profiles already published.
drop policy if exists "Public can view services for published caregivers" on public.caregiver_services;
create policy "Public can view services for published caregivers"
  on public.caregiver_services
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.caregiver_profiles cp
      where cp.id = caregiver_id
        and cp.is_published = true
        and cp.verification_status = 'approved'::public.verification_status
    )
  );

-- Explicitly allow the admin verification queue to read unpublished caregiver profiles.
-- The row-level policy remains restricted to users with the admin role.
drop policy if exists "Administrators can review caregiver profiles" on public.caregiver_profiles;
create policy "Administrators can review caregiver profiles"
  on public.caregiver_profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role = 'admin'::public.app_role
    )
  );
