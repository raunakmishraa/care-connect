-- Enable caregiver request acceptance when an administrator approves an application.
-- Publication remains a separate verification decision.
create or replace function public.admin_review_provider_application(
  p_application_id uuid,
  p_status text,
  p_reviewer_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_row public.provider_applications%rowtype;
  caregiver_profile_id uuid;
  facility_slug text;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'::public.app_role
  ) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_status not in ('under_review', 'action_required', 'approved', 'rejected') then
    raise exception 'Invalid provider application status' using errcode = '22023';
  end if;

  select * into application_row
  from public.provider_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Provider application not found' using errcode = 'P0002';
  end if;

  update public.provider_applications
  set status = p_status,
      reviewer_notes = nullif(trim(coalesce(p_reviewer_notes, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_application_id;

  if p_status <> 'approved' then
    return application_row.id;
  end if;

  if application_row.application_type = 'caregiver' then
    insert into public.user_roles (user_id, role)
    values (application_row.user_id, 'caregiver'::public.app_role)
    on conflict (user_id, role) do nothing;

    insert into public.caregiver_profiles (
      user_id, public_name, headline, years_experience, service_areas,
      rate_amount, rate_unit, verification_status, accepting_requests, is_published
    )
    values (
      application_row.user_id,
      application_row.applicant_name,
      'Caregiver applicant',
      coalesce(application_row.years_experience, 0),
      array[application_row.service_area],
      application_row.rate_amount,
      coalesce(application_row.rate_unit, 'hour'),
      'submitted'::public.verification_status,
      true,
      false
    )
    on conflict (user_id) do update set
      public_name = excluded.public_name,
      years_experience = excluded.years_experience,
      service_areas = excluded.service_areas,
      rate_amount = excluded.rate_amount,
      rate_unit = excluded.rate_unit,
      accepting_requests = true,
      is_published = false
    returning id into caregiver_profile_id;

    insert into public.caregiver_services (caregiver_id, category_id)
    select caregiver_profile_id, sc.id
    from public.service_categories sc
    join (values
      ('Companionship', 'companionship'),
      ('Daily living support', 'daily-living'),
      ('Mobility assistance', 'mobility'),
      ('Light household support', 'light-household'),
      ('Overnight care', 'overnight')
    ) as service_map(service_name, service_slug)
      on service_map.service_slug = sc.slug
    where service_map.service_name = any(application_row.services)
    on conflict (caregiver_id, category_id) do nothing;
  else
    insert into public.user_roles (user_id, role)
    values (application_row.user_id, 'facility_manager'::public.app_role)
    on conflict (user_id, role) do nothing;

    facility_slug :=
      coalesce(nullif(trim(both '-' from regexp_replace(lower(application_row.facility_name), '[^a-z0-9]+', '-', 'g')), ''), 'care-home')
      || '-' || substr(application_row.id::text, 1, 8);

    insert into public.care_facilities (
      manager_user_id, name, slug, facility_type, description, area,
      services, capacity, indicative_monthly_fee, verification_status, is_published
    )
    values (
      application_row.user_id,
      application_row.facility_name,
      facility_slug,
      coalesce(application_row.facility_type, 'Residential care'),
      application_row.facility_description,
      application_row.facility_address,
      application_row.facility_services,
      application_row.facility_capacity,
      application_row.monthly_fee,
      'submitted'::public.verification_status,
      false
    );
  end if;

  return application_row.id;
end;
$$;

revoke all on function public.admin_review_provider_application(uuid, text, text) from public, anon;
grant execute on function public.admin_review_provider_application(uuid, text, text) to authenticated;


-- Allow administrators to inspect unpublished profiles in the verification queue.
drop policy if exists "Administrators can review caregiver profiles" on public.caregiver_profiles;
create policy "Administrators can review caregiver profiles"
  on public.caregiver_profiles for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'::public.app_role
  ));

-- Explicit admin action to complete verification and publish a caregiver listing.
create or replace function public.admin_publish_caregiver_profile(p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_user_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'::public.app_role
  ) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select cp.user_id into profile_user_id
  from public.caregiver_profiles cp
  where cp.id = p_profile_id
  for update;

  if not found then
    raise exception 'Caregiver profile not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.provider_applications pa
    where pa.user_id = profile_user_id
      and pa.application_type = 'caregiver'
      and pa.status = 'approved'
  ) then
    raise exception 'Caregiver application must be approved before publication' using errcode = '22023';
  end if;

  update public.caregiver_profiles
  set verification_status = 'approved'::public.verification_status,
      is_published = true,
      updated_at = now()
  where id = p_profile_id;

  return p_profile_id;
end;
$$;

revoke all on function public.admin_publish_caregiver_profile(uuid) from public, anon;
grant execute on function public.admin_publish_caregiver_profile(uuid) to authenticated;
