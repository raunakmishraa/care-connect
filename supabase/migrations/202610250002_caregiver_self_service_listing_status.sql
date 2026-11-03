-- Secure self-service controls for an already-approved caregiver.
-- The caller can change only accepting_requests and is_published for their own
-- approved profile. Verification status and all other profile fields are untouched.
create or replace function public.caregiver_update_own_listing_status(
  p_accepting_requests boolean,
  p_is_published boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.caregiver_profiles
     set accepting_requests = p_accepting_requests,
         is_published = p_is_published,
         updated_at = now()
   where user_id = auth.uid()
     and verification_status = 'approved'::public.verification_status;

  if not found then
    raise exception 'No approved caregiver profile is available for self-service updates'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.caregiver_update_own_listing_status(boolean, boolean) from public;
grant execute on function public.caregiver_update_own_listing_status(boolean, boolean) to authenticated;
