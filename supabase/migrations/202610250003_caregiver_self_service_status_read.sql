-- Read the signed-in caregiver's own listing status without relying on
-- direct SELECT permissions/RLS on caregiver_profiles.
create or replace function public.caregiver_get_own_listing_status()
returns table (
  id uuid,
  verification_status public.verification_status,
  is_published boolean,
  accepting_requests boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select cp.id, cp.verification_status, cp.is_published, cp.accepting_requests
    from public.caregiver_profiles as cp
   where auth.uid() is not null
     and cp.user_id = auth.uid()
   limit 1;
$$;

revoke all on function public.caregiver_get_own_listing_status() from public;
grant execute on function public.caregiver_get_own_listing_status() to authenticated;
