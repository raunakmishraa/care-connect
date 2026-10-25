-- Durable family recipients and secure care-request lifecycle for AashrayaCare.
create table if not exists public.family_care_recipients (
  id uuid primary key default gen_random_uuid(),
  family_user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 160),
  relationship text not null default 'Recipient' check (length(trim(relationship)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists family_care_recipients_owner_created_idx
  on public.family_care_recipients(family_user_id, created_at);

create table if not exists public.care_requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  family_user_id uuid not null references auth.users(id) on delete cascade,
  caregiver_profile_id uuid not null references public.caregiver_profiles(id) on delete restrict,
  recipient_name text not null check (length(trim(recipient_name)) between 1 and 160),
  service text not null check (length(trim(service)) between 1 and 160),
  service_date date not null,
  start_time time not null,
  end_time time not null,
  service_area text not null check (length(trim(service_area)) between 1 and 240),
  tasks text not null default '' check (length(tasks) <= 1500),
  notes text not null default '' check (length(notes) <= 1000),
  budget_amount numeric(12,2) not null default 0 check (budget_amount >= 0),
  status text not null default 'pending_response'
    check (status in ('pending_response','clarification_requested','accepted_pending_terms','confirmed','completed','cancelled')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_requests_valid_time check (end_time > start_time)
);
create index if not exists care_requests_family_created_idx on public.care_requests(family_user_id, created_at desc);
create index if not exists care_requests_caregiver_created_idx on public.care_requests(caregiver_profile_id, created_at desc);

create table if not exists public.care_request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.care_requests(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (length(trim(message)) between 1 and 1500),
  created_at timestamptz not null default now()
);
create index if not exists care_request_messages_request_created_idx on public.care_request_messages(request_id, created_at);

alter table public.family_care_recipients enable row level security;
alter table public.care_requests enable row level security;
alter table public.care_request_messages enable row level security;

drop policy if exists "family manage own care recipients" on public.family_care_recipients;
create policy "family manage own care recipients" on public.family_care_recipients
  for all to authenticated using (family_user_id = (select auth.uid()))
  with check (family_user_id = (select auth.uid()));

drop policy if exists "family and assigned caregiver read care requests" on public.care_requests;
create policy "family and assigned caregiver read care requests" on public.care_requests
  for select to authenticated using (
    family_user_id = (select auth.uid()) or exists (
      select 1 from public.caregiver_profiles cp
      where cp.id = caregiver_profile_id and cp.user_id = (select auth.uid())
    )
  );

drop policy if exists "family creates own care requests for accepting caregivers" on public.care_requests;
create policy "family creates own care requests for accepting caregivers" on public.care_requests
  for insert to authenticated with check (
    family_user_id = (select auth.uid())
    and exists (
      select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role::text = 'family'
    )
    and exists (
      select 1 from public.caregiver_profiles cp
      where cp.id = caregiver_profile_id
        and cp.verification_status::text = 'approved'
        and cp.is_published = true
        and cp.accepting_requests = true
    )
  );

drop policy if exists "assigned caregiver responds to care requests" on public.care_requests;
create policy "assigned caregiver responds to care requests" on public.care_requests
  for update to authenticated using (
    exists (select 1 from public.caregiver_profiles cp where cp.id = caregiver_profile_id and cp.user_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.caregiver_profiles cp where cp.id = caregiver_profile_id and cp.user_id = (select auth.uid()))
    and status in ('pending_response','clarification_requested','accepted_pending_terms')
  );

drop policy if exists "participants read request messages" on public.care_request_messages;
create policy "participants read request messages" on public.care_request_messages
  for select to authenticated using (
    exists (select 1 from public.care_requests cr where cr.id = request_id
      and (cr.family_user_id = (select auth.uid()) or exists (
        select 1 from public.caregiver_profiles cp where cp.id = cr.caregiver_profile_id and cp.user_id = (select auth.uid())
      )))
  );

drop policy if exists "participants send request messages" on public.care_request_messages;
create policy "participants send request messages" on public.care_request_messages
  for insert to authenticated with check (
    sender_user_id = (select auth.uid()) and exists (
      select 1 from public.care_requests cr where cr.id = request_id
      and (cr.family_user_id = (select auth.uid()) or exists (
        select 1 from public.caregiver_profiles cp where cp.id = cr.caregiver_profile_id and cp.user_id = (select auth.uid())
      ))
    )
  );

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.family_care_recipients to authenticated;
revoke update on public.care_requests from authenticated;
grant select, insert on public.care_requests to authenticated;
grant update (status, responded_at) on public.care_requests to authenticated;
grant select, insert on public.care_request_messages to authenticated;
