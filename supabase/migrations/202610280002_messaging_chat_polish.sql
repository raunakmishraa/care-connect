-- Permit a request participant to read only the family's display name for that request.
-- Users retain own-row-only access; do not broaden SELECT on public.users.
create or replace function public.care_request_family_display_name(p_request_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_family_user_id uuid;
  v_caregiver_user_id uuid;
  v_facility_manager_user_id uuid;
  v_full_name text;
begin
  select cr.family_user_id, cp.user_id, cf.manager_user_id, u.full_name
    into v_family_user_id, v_caregiver_user_id, v_facility_manager_user_id, v_full_name
  from public.care_requests cr
  left join public.caregiver_profiles cp on cp.id = cr.caregiver_profile_id
  left join public.care_facilities cf on cf.id = cr.facility_id
  left join public.users u on u.id = cr.family_user_id
  where cr.id = p_request_id;

  if not found then
    return null;
  end if;

  if auth.uid() is null
     or (auth.uid() is distinct from v_family_user_id
         and auth.uid() is distinct from v_caregiver_user_id
         and auth.uid() is distinct from v_facility_manager_user_id) then
    raise exception 'Not authorized to view this request participant name';
  end if;

  return coalesce(nullif(btrim(v_full_name), ''), 'Family');
end;
$function$;

revoke all on function public.care_request_family_display_name(uuid) from public;
revoke all on function public.care_request_family_display_name(uuid) from anon;
grant execute on function public.care_request_family_display_name(uuid) to authenticated;
