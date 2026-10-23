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
