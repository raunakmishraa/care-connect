-- AashrayaCare MVP baseline migration. PostgreSQL 15+ / Supabase.
-- The supplied backend artifact was a schema README, not the referenced care_connect_schema.sql.
-- This migration implements its documented domains and core relationships; reconcile against canonical DDL before production.
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create type public.app_role as enum ('family','caregiver','facility_manager','admin','operations','support');
create type public.verification_status as enum ('incomplete','submitted','under_review','action_required','approved','rejected','suspended');
create type public.request_status as enum ('draft','submitted','viewed','needs_clarification','accepted','declined','expired','cancelled','converted');
create type public.booking_status as enum ('pending_confirmation','confirmed','care_in_progress','completed','cancelled','no_show','disputed');
create type public.payment_status as enum ('not_recorded','pending','partially_paid','paid_recorded','disputed','refunded_adjusted');
create type public.enquiry_status as enum ('submitted','contacted','visit_scheduled','visited','shortlisted','closed','cancelled');
create type public.case_status as enum ('open','triaged','in_progress','resolved','closed');

create table public.users (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (length(trim(full_name)) between 1 and 160),
 phone text,
 phone_verified_at timestamptz,
 preferred_language text not null default 'en' check (preferred_language in ('en','ne')),
 theme_preference text not null default 'system' check (theme_preference in ('light','dark','system')),
 email text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
 role public.app_role not null, granted_by uuid references public.users(id), created_at timestamptz not null default now(),
 unique(user_id,role)
);
create table public.consent_records (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
 consent_type text not null, policy_version text not null, action text not null check(action in ('accepted','declined','withdrawn')),
 recorded_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);
create table public.family_profiles (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.users(id) on delete cascade,
 service_area text, contact_preference text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.care_recipients (
 id uuid primary key default gen_random_uuid(), family_user_id uuid not null references public.users(id) on delete cascade,
 preferred_name text not null check(length(trim(preferred_name)) between 1 and 120), relationship text,
 age_band text, care_preferences text, accessibility_preferences text, safety_notes_private text,
 permission_confirmed boolean not null default false, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.service_categories (
 id uuid primary key default gen_random_uuid(), slug text unique not null, name_en text not null, name_ne text,
 description_en text, is_active boolean not null default true, sort_order int not null default 0
);
insert into public.service_categories(slug,name_en,name_ne,sort_order) values
 ('companionship','Companionship','साथ र संगत',1),('daily-living','Daily living support','दैनिक जीवन सहयोग',2),
 ('mobility','Mobility assistance','हिँडडुल सहयोग',3),('light-household','Light household support','हल्का घरायसी सहयोग',4),
 ('overnight','Overnight care','रात्री हेरचाह',5) on conflict(slug) do nothing;
create table public.caregiver_profiles (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.users(id) on delete cascade,
 public_name text not null, headline text, bio text, years_experience int not null default 0 check(years_experience>=0),
 languages text[] not null default '{}', service_areas text[] not null default '{}', rate_amount numeric(12,2) check(rate_amount is null or rate_amount>=0),
 rate_unit text not null default 'hour' check(rate_unit in ('hour','visit','night','day')),
 profile_photo_key text, verification_status public.verification_status not null default 'incomplete',
 accepting_requests boolean not null default false, is_published boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.caregiver_services (
 id uuid primary key default gen_random_uuid(), caregiver_id uuid not null references public.caregiver_profiles(id) on delete cascade,
 category_id uuid not null references public.service_categories(id), scope_notes text, is_active boolean not null default true,
 unique(caregiver_id,category_id)
);
create table public.caregiver_availability (
 id uuid primary key default gen_random_uuid(), caregiver_id uuid not null references public.caregiver_profiles(id) on delete cascade,
 starts_at timestamptz not null, ends_at timestamptz not null, is_available boolean not null default true,
 check(ends_at>starts_at)
);
create table public.caregiver_evidence (
 id uuid primary key default gen_random_uuid(), caregiver_id uuid not null references public.caregiver_profiles(id) on delete cascade,
 evidence_type text not null, object_key text not null, status public.verification_status not null default 'submitted',
 submitted_at timestamptz not null default now(), reviewed_by uuid references public.users(id), reviewed_at timestamptz,
 reviewer_notes_private text, decision_reason text
);
create table public.care_requests (
 id uuid primary key default gen_random_uuid(), public_reference text unique not null,
 family_user_id uuid not null references public.users(id), recipient_id uuid not null references public.care_recipients(id),
 caregiver_id uuid not null references public.caregiver_profiles(id), service_category_id uuid references public.service_categories(id),
 service_label text not null, tasks text not null, location_area text not null, address_private text,
 access_instructions_private text, starts_at timestamptz not null, ends_at timestamptz not null,
 rate_amount numeric(12,2) check(rate_amount is null or rate_amount>=0), rate_unit text not null default 'hour',
 budget_min numeric(12,2), budget_max numeric(12,2), family_message text, cancellation_policy_version text,
 status public.request_status not null default 'draft', expires_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ends_at>starts_at), check(budget_min is null or budget_min>=0), check(budget_max is null or budget_max>=0),
 check(budget_min is null or budget_max is null or budget_min<=budget_max)
);
create index care_requests_family_status_idx on public.care_requests(family_user_id,status,created_at desc);
create index care_requests_caregiver_status_idx on public.care_requests(caregiver_id,status,created_at desc);
create table public.bookings (
 id uuid primary key default gen_random_uuid(), public_reference text unique not null,
 request_id uuid not null unique references public.care_requests(id), family_user_id uuid not null references public.users(id),
 caregiver_id uuid not null references public.caregiver_profiles(id), recipient_id uuid not null references public.care_recipients(id),
 starts_at timestamptz not null, ends_at timestamptz not null, agreed_rate numeric(12,2) not null check(agreed_rate>=0),
 rate_unit text not null, agreed_total numeric(12,2) check(agreed_total is null or agreed_total>=0),
 currency char(3) not null default 'NPR' check(currency='NPR'), status public.booking_status not null default 'pending_confirmation',
 cancellation_policy_version text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ends_at>starts_at),
 exclude using gist (caregiver_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
 where (status in ('confirmed','care_in_progress'))
);
create index bookings_family_status_idx on public.bookings(family_user_id,status,starts_at);
create index bookings_caregiver_status_idx on public.bookings(caregiver_id,status,starts_at);
create table public.booking_status_history (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade,
 from_status public.booking_status, to_status public.booking_status not null, actor_user_id uuid references public.users(id),
 reason text, created_at timestamptz not null default now()
);
create table public.care_visit_records (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references public.bookings(id),
 arrived_at timestamptz, started_at timestamptz, ended_at timestamptz, agreed_tasks text not null,
 family_summary text, operations_notes_private text, recorded_by uuid references public.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ended_at is null or started_at is null or ended_at>=started_at)
);
create table public.payment_records (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references public.bookings(id),
 agreed_total numeric(12,2) not null default 0 check(agreed_total>=0), amount_paid numeric(12,2) not null default 0 check(amount_paid>=0),
 amount_refunded numeric(12,2) not null default 0 check(amount_refunded>=0 and amount_refunded<=amount_paid),
 currency char(3) not null default 'NPR' check(currency='NPR'), arrangement text, method text,
 payment_reference text, status public.payment_status not null default 'not_recorded', recorded_by uuid references public.users(id),
 recorded_at timestamptz, private_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(amount_paid<=agreed_total or status='disputed')
);
create table public.payment_adjustments (
 id uuid primary key default gen_random_uuid(), payment_record_id uuid not null references public.payment_records(id),
 prior_amount_paid numeric(12,2) not null, new_amount_paid numeric(12,2) not null, prior_total numeric(12,2) not null,
 new_total numeric(12,2) not null, reason text not null, actor_user_id uuid not null references public.users(id),
 created_at timestamptz not null default now()
);
create table public.care_facilities (
 id uuid primary key default gen_random_uuid(), manager_user_id uuid not null references public.users(id),
 name text not null, slug text unique not null, facility_type text not null, description text, area text not null,
 services text[] not null default '{}', amenities text[] not null default '{}', languages text[] not null default '{}',
 capacity int check(capacity is null or capacity>=0), indicative_monthly_fee numeric(12,2) check(indicative_monthly_fee is null or indicative_monthly_fee>=0),
 availability_note text, availability_updated_at timestamptz, verification_status public.verification_status not null default 'incomplete',
 is_published boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.facility_photos (
 id uuid primary key default gen_random_uuid(), facility_id uuid not null references public.care_facilities(id) on delete cascade,
 object_key text not null, alt_text text not null, is_public boolean not null default false, sort_order int not null default 0
);
create table public.facility_evidence (
 id uuid primary key default gen_random_uuid(), facility_id uuid not null references public.care_facilities(id) on delete cascade,
 evidence_type text not null, object_key text not null, status public.verification_status not null default 'submitted',
 submitted_at timestamptz not null default now(), reviewed_by uuid references public.users(id), reviewed_at timestamptz,
 reviewer_notes_private text, decision_reason text
);
create table public.facility_enquiries (
 id uuid primary key default gen_random_uuid(), public_reference text unique not null,
 facility_id uuid not null references public.care_facilities(id), family_user_id uuid not null references public.users(id),
 care_needs_summary text, preferred_move_in_date date, budget_min numeric(12,2), budget_max numeric(12,2),
 question text, status public.enquiry_status not null default 'submitted', scheduled_visit_at timestamptz,
 internal_notes_private text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.conversations (
 id uuid primary key default gen_random_uuid(), booking_id uuid references public.bookings(id), enquiry_id uuid references public.facility_enquiries(id),
 created_at timestamptz not null default now(), check(booking_id is not null or enquiry_id is not null)
);
create table public.conversation_participants (
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references public.users(id) on delete cascade, joined_at timestamptz not null default now(),
 primary key(conversation_id,user_id)
);
create table public.messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_user_id uuid not null references public.users(id), body text not null check(length(trim(body)) between 1 and 5000),
 created_at timestamptz not null default now(), read_at timestamptz
);
create index messages_conversation_created_idx on public.messages(conversation_id,created_at desc);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
 event_type text not null, title text not null, body text, target_path text, read_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.reviews (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
 reviewer_user_id uuid not null references public.users(id), subject_caregiver_id uuid not null references public.caregiver_profiles(id),
 rating int not null check(rating between 1 and 5), body text check(body is null or length(body)<=2000),
 moderation_status text not null default 'pending' check(moderation_status in ('pending','published','hidden','reported')),
 created_at timestamptz not null default now(), unique(booking_id,reviewer_user_id)
);
create table public.support_cases (
 id uuid primary key default gen_random_uuid(), public_reference text unique not null,
 opened_by uuid not null references public.users(id), assigned_to uuid references public.users(id),
 category text not null, subject text not null, description_private text, status public.case_status not null default 'open',
 resolution_private text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.safety_incidents (
 id uuid primary key default gen_random_uuid(), public_reference text unique not null,
 reported_by uuid not null references public.users(id), booking_id uuid references public.bookings(id),
 severity text not null default 'untriaged' check(severity in ('untriaged','low','medium','high','critical')),
 description_private text not null, immediate_danger boolean, status public.case_status not null default 'open',
 assigned_to uuid references public.users(id), escalation_notes_private text, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), actor_user_id uuid references public.users(id), action text not null,
 target_type text not null, target_id uuid, before_values jsonb, after_values jsonb, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table public.idempotency_records (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id), idempotency_key text not null,
 operation text not null, response_status int, response_body jsonb, created_at timestamptz not null default now(),
 unique(user_id,operation,idempotency_key)
);

-- Keep private facility address separate from public directory fields. Access it only from authorized server functions.
create table public.facility_private_details (
 facility_id uuid primary key references public.care_facilities(id) on delete cascade,
 full_address text, access_notes_private text, updated_at timestamptz not null default now()
);

-- Prevent profile owners/managers from self-approving or publishing a listing.
create or replace function public.guard_verification_fields() returns trigger language plpgsql as $$
begin
 if auth.uid() is not null and current_user <> 'service_role' then
   if tg_table_name = 'caregiver_profiles' then
     if (tg_op = 'INSERT' and (new.verification_status <> 'incomplete' or new.is_published)) or
        (tg_op = 'UPDATE' and (new.verification_status is distinct from old.verification_status or new.is_published is distinct from old.is_published)) then
       raise exception 'Verification and publication decisions require authorized operations staff';
     end if;
   elsif tg_table_name = 'care_facilities' then
     if (tg_op = 'INSERT' and (new.verification_status <> 'incomplete' or new.is_published)) or
        (tg_op = 'UPDATE' and (new.verification_status is distinct from old.verification_status or new.is_published is distinct from old.is_published)) then
       raise exception 'Verification and publication decisions require authorized operations staff';
     end if;
   end if;
 end if;
 return new;
end $$;
create trigger caregiver_verification_guard before insert or update on public.caregiver_profiles for each row execute function public.guard_verification_fields();
create trigger facility_verification_guard before insert or update on public.care_facilities for each row execute function public.guard_verification_fields();

-- Authorization baseline: deny public access to tables. Specific policies are added after role/ownership review.
-- Supabase Edge Functions / narrowly scoped SECURITY DEFINER functions should perform sensitive mutations.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('alter table public.%I enable row level security',t.tablename);
 end loop;
end $$;
-- Public directory reads are limited to approved/published profiles/facilities.
create policy "Public can view published caregiver profiles" on public.caregiver_profiles for select to anon, authenticated using (is_published = true and verification_status = 'approved');
create policy "Public can view active service categories" on public.service_categories for select to anon, authenticated using (is_active = true);
create policy "Public can view published facilities" on public.care_facilities for select to anon, authenticated using (is_published = true and verification_status = 'approved');
-- Private user-owned records. These policies are intentionally narrow; staff policies require a reviewed authorization helper.
create policy "Users can view own user record" on public.users for select to authenticated using (id = auth.uid());
create policy "Users can update own user record" on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Users can view own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "Family owns own profile" on public.family_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Family owns recipients" on public.care_recipients for all to authenticated using (family_user_id = auth.uid()) with check (family_user_id = auth.uid());
create policy "Caregiver owns profile" on public.caregiver_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Caregiver manages own services" on public.caregiver_services for all to authenticated using (exists(select 1 from public.caregiver_profiles cp where cp.id=caregiver_id and cp.user_id=auth.uid())) with check (exists(select 1 from public.caregiver_profiles cp where cp.id=caregiver_id and cp.user_id=auth.uid()));
create policy "Caregiver manages own availability" on public.caregiver_availability for all to authenticated using (exists(select 1 from public.caregiver_profiles cp where cp.id=caregiver_id and cp.user_id=auth.uid())) with check (exists(select 1 from public.caregiver_profiles cp where cp.id=caregiver_id and cp.user_id=auth.uid()));
create policy "Family reads own requests" on public.care_requests for select to authenticated using (family_user_id=auth.uid());
create policy "Caregiver reads assigned requests" on public.care_requests for select to authenticated using (exists(select 1 from public.caregiver_profiles cp where cp.id=caregiver_id and cp.user_id=auth.uid()));
create policy "Booking parties can read bookings" on public.bookings for select to authenticated using (family_user_id=auth.uid() or exists(select 1 from public.caregiver_profiles cp where cp.id=caregiver_id and cp.user_id=auth.uid()));
create policy "Facility manager owns listing" on public.care_facilities for all to authenticated using (manager_user_id=auth.uid()) with check (manager_user_id=auth.uid());
create policy "Family reads own facility enquiries" on public.facility_enquiries for select to authenticated using (family_user_id=auth.uid());
create policy "Facility manager reads enquiries" on public.facility_enquiries for select to authenticated using (exists(select 1 from public.care_facilities f where f.id=facility_id and f.manager_user_id=auth.uid()));
create policy "Conversation participants read conversations" on public.conversations for select to authenticated using (exists(select 1 from public.conversation_participants p where p.conversation_id=id and p.user_id=auth.uid()));
create policy "Participants read participant list" on public.conversation_participants for select to authenticated using (exists(select 1 from public.conversation_participants p where p.conversation_id=conversation_id and p.user_id=auth.uid()));
create policy "Participants read messages" on public.messages for select to authenticated using (exists(select 1 from public.conversation_participants p where p.conversation_id=conversation_id and p.user_id=auth.uid()));
create policy "Participants send messages as self" on public.messages for insert to authenticated with check (sender_user_id=auth.uid() and exists(select 1 from public.conversation_participants p where p.conversation_id=conversation_id and p.user_id=auth.uid()));
create policy "Users read own notifications" on public.notifications for select to authenticated using (user_id=auth.uid());
create policy "Users update own notification read state" on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "Users read own consent records" on public.consent_records for select to authenticated using (user_id=auth.uid());
create policy "Users create own consent records" on public.consent_records for insert to authenticated with check (user_id=auth.uid());
create policy "Users read own support cases" on public.support_cases for select to authenticated using (opened_by=auth.uid());
create policy "Users read own incident reports" on public.safety_incidents for select to authenticated using (reported_by=auth.uid());
-- No client policies for evidence, payment adjustments, private visit notes, reviews, staff queues or audit logs.
-- Add audited, role-checked server functions before exposing these operations.
