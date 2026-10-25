-- Request-linked bookings, facility requests, participant-scoped conversations and encrypted message payloads.
-- Message bodies are encrypted in the browser using Web Crypto (ECDH P-256 + AES-GCM).
-- Private keys are never sent to Supabase; they are kept in the user's browser IndexedDB.

alter table public.care_requests
  add column if not exists provider_type text not null default 'caregiver',
  add column if not exists facility_id uuid references public.care_facilities(id) on delete restrict,
  add column if not exists confirmed_at timestamptz;

alter table public.care_requests alter column caregiver_profile_id drop not null;

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.care_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.care_requests drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.care_requests
  add constraint care_requests_provider_type_check check (provider_type in ('caregiver','facility')),
  add constraint care_requests_provider_target_check check (
    (provider_type='caregiver' and caregiver_profile_id is not null and facility_id is null)
    or (provider_type='facility' and facility_id is not null and caregiver_profile_id is null)
  ),
  add constraint care_requests_status_lifecycle_check check (status in (
    'draft','submitted','viewed','needs_clarification','accepted','declined','expired','cancelled','converted',
    'pending_response','clarification_requested','accepted_pending_terms','confirmed','completed'
  ));

-- A conversation can belong to an accepted request before a confirmed booking exists.
alter table public.conversations add column if not exists request_id uuid references public.care_requests(id) on delete cascade;
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.conversations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%booking_id%'
      and pg_get_constraintdef(oid) ilike '%enquiry_id%'
  loop
    execute format('alter table public.conversations drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.conversations
  add constraint conversations_has_parent_check check (booking_id is not null or enquiry_id is not null or request_id is not null);
create unique index if not exists conversations_request_uidx on public.conversations(request_id) where request_id is not null;
create index if not exists care_requests_facility_created_idx on public.care_requests(facility_id,created_at desc) where facility_id is not null;

-- Confirmed requests also create a durable booking record. A facility placement has a
-- facility target (rather than a caregiver profile) and may not map to the legacy recipient table.
alter table public.bookings
  add column if not exists facility_id uuid references public.care_facilities(id) on delete restrict;
alter table public.bookings alter column caregiver_id drop not null;
alter table public.bookings alter column recipient_id drop not null;
alter table public.bookings
  add constraint bookings_provider_target_check check (
    (caregiver_id is not null and facility_id is null)
    or (caregiver_id is null and facility_id is not null)
  );
drop policy if exists "Booking parties can read bookings" on public.bookings;
create policy "Booking parties can read bookings" on public.bookings for select to authenticated using (
  family_user_id=auth.uid()
  or exists(select 1 from public.caregiver_profiles cp where cp.id=caregiver_id and cp.user_id=auth.uid())
  or exists(select 1 from public.care_facilities f where f.id=facility_id and f.manager_user_id=auth.uid())
);


-- Keep existing historic plaintext messages readable by schema, but all new messages
-- written by this client use ciphertext + IV and leave body NULL.
alter table public.messages alter column body drop not null;
alter table public.messages add column if not exists ciphertext text;
alter table public.messages add column if not exists iv text;
alter table public.messages add constraint messages_encrypted_payload_check check (
  (ciphertext is null and iv is null) or
  (ciphertext is not null and iv is not null and body is null)
);

alter table public.care_request_messages alter column message drop not null;
alter table public.care_request_messages add column if not exists ciphertext text;
alter table public.care_request_messages add column if not exists iv text;
alter table public.care_request_messages add constraint care_request_messages_encrypted_payload_check check (
  (ciphertext is null and iv is null) or
  (ciphertext is not null and iv is not null and message is null)
);

-- Use a SECURITY DEFINER membership predicate to avoid recursive or overly broad
-- row-level-security checks on conversation participants.
create or replace function public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $
  select exists(
    select 1 from public.conversation_participants cp
    where cp.conversation_id=p_conversation_id
      and cp.user_id=p_user_id
      and p_user_id=auth.uid()
  );
$;
revoke all on function public.is_conversation_participant(uuid,uuid) from public;
grant execute on function public.is_conversation_participant(uuid,uuid) to authenticated;

-- Public keys only. Private ECDH keys stay in each participant's browser.
create table if not exists public.user_message_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_key_jwk jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_message_keys enable row level security;
drop policy if exists "Authenticated users can read message public keys" on public.user_message_keys;
create policy "Authenticated users can read message public keys"
  on public.user_message_keys for select to authenticated using (auth.uid() is not null);
drop policy if exists "Users manage their own message public key" on public.user_message_keys;
create policy "Users manage their own message public key"
  on public.user_message_keys for all to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select,insert,update on public.user_message_keys to authenticated;

-- Replace request policies with policies that cover both individual caregivers and facilities.
drop policy if exists "family and assigned caregiver read care requests" on public.care_requests;
drop policy if exists "family creates own care requests for accepting caregivers" on public.care_requests;
drop policy if exists "assigned caregiver responds to care requests" on public.care_requests;
drop policy if exists "care requests participants read" on public.care_requests;
create policy "care requests participants read" on public.care_requests for select to authenticated using (
  family_user_id=auth.uid()
  or exists(select 1 from public.caregiver_profiles cp where cp.id=caregiver_profile_id and cp.user_id=auth.uid())
  or exists(select 1 from public.care_facilities f where f.id=facility_id and f.manager_user_id=auth.uid())
);
create policy "families create requests for approved providers" on public.care_requests for insert to authenticated with check (
  family_user_id=auth.uid()
  and exists(select 1 from public.user_roles ur where ur.user_id=auth.uid() and ur.role::text='family')
  and (
    (provider_type='caregiver' and exists(select 1 from public.caregiver_profiles cp where cp.id=caregiver_profile_id and cp.verification_status::text='approved' and cp.is_published and cp.accepting_requests))
    or
    (provider_type='facility' and exists(select 1 from public.care_facilities f where f.id=facility_id and f.verification_status::text='approved' and f.is_published))
  )
);
drop policy if exists "providers can respond to care requests" on public.care_requests;
create policy "providers can ask clarification" on public.care_requests for update to authenticated
  using (
    status='pending_response'
    and (exists(select 1 from public.caregiver_profiles cp where cp.id=caregiver_profile_id and cp.user_id=auth.uid())
      or exists(select 1 from public.care_facilities f where f.id=facility_id and f.manager_user_id=auth.uid()))
  )
  with check (
    status='clarification_requested'
    and (exists(select 1 from public.caregiver_profiles cp where cp.id=caregiver_profile_id and cp.user_id=auth.uid())
      or exists(select 1 from public.care_facilities f where f.id=facility_id and f.manager_user_id=auth.uid()))
  );

-- Encrypted clarification messages are readable/writable only by the request parties.
drop policy if exists "participants read request messages" on public.care_request_messages;
drop policy if exists "participants send request messages" on public.care_request_messages;
create policy "request participants read clarification messages" on public.care_request_messages for select to authenticated using (
  exists(select 1 from public.care_requests cr where cr.id=request_id and (
    cr.family_user_id=auth.uid()
    or exists(select 1 from public.caregiver_profiles cp where cp.id=cr.caregiver_profile_id and cp.user_id=auth.uid())
    or exists(select 1 from public.care_facilities f where f.id=cr.facility_id and f.manager_user_id=auth.uid())
  ))
);
create policy "request participants send clarification messages" on public.care_request_messages for insert to authenticated with check (
  sender_user_id=auth.uid() and exists(select 1 from public.care_requests cr where cr.id=request_id and (
    cr.family_user_id=auth.uid()
    or exists(select 1 from public.caregiver_profiles cp where cp.id=cr.caregiver_profile_id and cp.user_id=auth.uid())
    or exists(select 1 from public.care_facilities f where f.id=cr.facility_id and f.manager_user_id=auth.uid())
  ))
);

-- Accept atomically moves the request to accepted_pending_terms, opens one request conversation
-- and creates participant membership. The family is notified, but the booking is not yet confirmed.
create or replace function public.care_request_accept(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.care_requests%rowtype;
  v_conversation_id uuid;
  v_provider_user_id uuid;
begin
  select * into v_request from public.care_requests where id=p_request_id for update;
  if not found then raise exception 'Care request not found'; end if;
  if v_request.status not in ('pending_response','clarification_requested') then
    raise exception 'Only requests awaiting a provider response can be accepted';
  end if;
  if v_request.provider_type='caregiver' then
    select user_id into v_provider_user_id from public.caregiver_profiles where id=v_request.caregiver_profile_id;
  else
    select manager_user_id into v_provider_user_id from public.care_facilities where id=v_request.facility_id;
  end if;
  if v_provider_user_id is null or v_provider_user_id<>auth.uid() then
    raise exception 'Only the assigned provider can accept this request';
  end if;

  update public.care_requests set status='accepted_pending_terms', responded_at=now(), updated_at=now()
    where id=p_request_id;
  insert into public.conversations(request_id) values (p_request_id)
    on conflict (request_id) where request_id is not null do nothing
    returning id into v_conversation_id;
  if v_conversation_id is null then
    select id into v_conversation_id from public.conversations where request_id=p_request_id;
  end if;
  insert into public.conversation_participants(conversation_id,user_id)
    values(v_conversation_id,v_request.family_user_id),(v_conversation_id,auth.uid())
    on conflict do nothing;
  insert into public.notifications(user_id,event_type,title,body,target_path)
    values(v_request.family_user_id,'care_request_accepted','Your care request was accepted',
      'The provider accepted your request. Open Messages to discuss any remaining details, then confirm the booking when you agree.',
      '/app/messages');
  return v_conversation_id;
end;
$$;
revoke all on function public.care_request_accept(uuid) from public;
grant execute on function public.care_request_accept(uuid) to authenticated;

-- Only the family owner can confirm an accepted request. Acceptance and confirmation stay separate.
create or replace function public.care_request_confirm(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.care_requests%rowtype;
  v_provider_user_id uuid;
begin
  select * into v_request from public.care_requests where id=p_request_id for update;
  if not found then raise exception 'Care request not found'; end if;
  if v_request.family_user_id<>auth.uid() then raise exception 'Only the requesting family can confirm this booking'; end if;
  if v_request.status<>'accepted_pending_terms' then raise exception 'This request is not ready for confirmation'; end if;
  update public.care_requests set status='confirmed', confirmed_at=now(), updated_at=now() where id=p_request_id;
  insert into public.bookings(
    public_reference, request_id, family_user_id, caregiver_id, facility_id, recipient_id,
    starts_at, ends_at, agreed_rate, rate_unit, agreed_total, currency, status
  ) values (
    coalesce(v_request.reference_code, 'AC-' || left(replace(p_request_id::text,'-',''),12)),
    p_request_id, v_request.family_user_id, v_request.caregiver_profile_id, v_request.facility_id,
    (select r.id from public.care_recipients r where r.family_user_id=v_request.family_user_id and r.preferred_name=v_request.recipient_name order by r.created_at limit 1),
    (v_request.service_date + v_request.start_time) at time zone 'Asia/Kathmandu',
    (v_request.service_date + v_request.end_time) at time zone 'Asia/Kathmandu',
    coalesce(v_request.budget_amount,0),
    case when v_request.provider_type='facility' then 'month' else 'hour' end,
    coalesce(v_request.budget_amount,0), 'NPR', 'confirmed'
  ) on conflict (request_id) do update set status='confirmed', updated_at=now();
  if v_request.provider_type='caregiver' then
    select user_id into v_provider_user_id from public.caregiver_profiles where id=v_request.caregiver_profile_id;
  else
    select manager_user_id into v_provider_user_id from public.care_facilities where id=v_request.facility_id;
  end if;
  if v_provider_user_id is not null then
    insert into public.notifications(user_id,event_type,title,body,target_path)
      values(v_provider_user_id,'care_request_confirmed','Family confirmed the booking',
        'The family confirmed the requested details. Review the request and coordinate through Messages.',
        case when v_request.provider_type='facility' then '/facility/requests' else '/caregiver/requests' end);
  end if;
  return true;
end;
$$;
revoke all on function public.care_request_confirm(uuid) from public;
grant execute on function public.care_request_confirm(uuid) to authenticated;

-- Server-side response guard for chat conversations.
create or replace function public.care_request_create_conversation(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  select status into v_status from public.care_requests
    where id=p_request_id and family_user_id=auth.uid();
  if not found then raise exception 'Only the requesting family can open this request conversation'; end if;
  if v_status not in ('accepted_pending_terms','confirmed','completed','cancelled') then
    raise exception 'Messaging opens after the provider accepts the request';
  end if;
  return (select id from public.conversations where request_id=p_request_id);
end;
$$;
revoke all on function public.care_request_create_conversation(uuid) from public;
grant execute on function public.care_request_create_conversation(uuid) to authenticated;

grant select,insert,update on public.conversations to authenticated;
grant select,insert on public.conversation_participants to authenticated;
grant select,insert on public.messages to authenticated;
grant select,insert on public.care_request_messages to authenticated;

-- Explicitly scope message history and participant rows to this conversation's two members.
drop policy if exists "Conversation participants read conversations" on public.conversations;
create policy "Conversation participants read conversations" on public.conversations
  for select to authenticated using (public.is_conversation_participant(id,auth.uid()));
drop policy if exists "Participants read participant list" on public.conversation_participants;
create policy "Participants read participant list" on public.conversation_participants
  for select to authenticated using (public.is_conversation_participant(conversation_id,auth.uid()));
drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages" on public.messages
  for select to authenticated using (public.is_conversation_participant(conversation_id,auth.uid()));
drop policy if exists "Participants send messages as self" on public.messages;
create policy "Participants send messages as self" on public.messages
  for insert to authenticated with check (sender_user_id=auth.uid() and public.is_conversation_participant(conversation_id,auth.uid()));


-- Realtime is optional: the UI also polls, so delivery works even if the table is
-- not currently enabled in the Supabase Realtime publication.
