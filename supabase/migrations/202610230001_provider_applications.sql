-- Provider applications are separate from account roles. Submitting an application never grants provider access.
create table if not exists public.provider_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  application_type text not null check (application_type in ('caregiver', 'care_home')),
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'action_required', 'approved', 'rejected')),
  applicant_name text not null check (length(trim(applicant_name)) between 1 and 160),
  contact_email text not null,
  contact_phone text not null check (length(trim(contact_phone)) between 7 and 30),
  service_area text,
  years_experience integer check (years_experience is null or years_experience between 0 and 80),
  services text[] not null default '{}',
  rate_amount numeric(12,2) check (rate_amount is null or rate_amount >= 0),
  rate_unit text check (rate_unit is null or rate_unit in ('hour', 'visit', 'night', 'day')),
  facility_name text,
  facility_type text,
  facility_address text,
  facility_description text,
  facility_services text[] not null default '{}',
  facility_capacity integer check (facility_capacity is null or facility_capacity >= 0),
  monthly_fee numeric(12,2) check (monthly_fee is null or monthly_fee >= 0),
  registration_number text,
  additional_notes text,
  reviewer_notes text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_application_type_fields check (
    (application_type = 'caregiver' and service_area is not null and length(trim(service_area)) > 0)
    or
    (application_type = 'care_home' and facility_name is not null and length(trim(facility_name)) > 0
      and facility_address is not null and length(trim(facility_address)) > 0)
  )
);

create index if not exists provider_applications_owner_created_idx
  on public.provider_applications(user_id, created_at desc);
create index if not exists provider_applications_review_queue_idx
  on public.provider_applications(status, created_at)
  where status in ('submitted', 'under_review', 'action_required');

create unique index if not exists provider_applications_one_active_per_type_idx
  on public.provider_applications(user_id, application_type)
  where status in ('submitted', 'under_review', 'action_required', 'approved');

alter table public.provider_applications enable row level security;
grant select, insert, update on public.provider_applications to authenticated;

drop policy if exists "Applicants can view their own applications" on public.provider_applications;
create policy "Applicants can view their own applications"
  on public.provider_applications for select to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'admin'::public.app_role
  ));

drop policy if exists "Applicants can submit their own applications" on public.provider_applications;
create policy "Applicants can submit their own applications"
  on public.provider_applications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'submitted'
    and reviewed_by is null
    and reviewed_at is null
    and reviewer_notes is null
  );

drop policy if exists "Administrators can review provider applications" on public.provider_applications;
create policy "Administrators can review provider applications"
  on public.provider_applications for update to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'admin'::public.app_role
  ))
  with check (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'admin'::public.app_role
  )); 

-- Admin-only review RPC: provider roles and draft profiles are created only after
-- an administrator approves an application. Public listing publication remains off.
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
      false,
      false
    )
    on conflict (user_id) do update set
      public_name = excluded.public_name,
      years_experience = excluded.years_experience,
      service_areas = excluded.service_areas,
      rate_amount = excluded.rate_amount,
      rate_unit = excluded.rate_unit,
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
