-- Private provider evidence uploads and safe public-listing support chatbot.
alter table public.provider_applications
  add column if not exists caregiver_license_file_path text,
  add column if not exists facility_registration_file_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('provider-verification-documents','provider-verification-documents',false,10485760,
  array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp'];

drop policy if exists "Applicants upload own verification documents" on storage.objects;
create policy "Applicants upload own verification documents" on storage.objects
for insert to authenticated with check (
  bucket_id = 'provider-verification-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Applicants view own verification documents" on storage.objects;
create policy "Applicants view own verification documents" on storage.objects
for select to authenticated using (
  bucket_id = 'provider-verification-documents'
  and ((storage.foldername(name))[1] = auth.uid()::text or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'::public.app_role
  ))
);

drop policy if exists "Applicants replace own verification documents" on storage.objects;
create policy "Applicants replace own verification documents" on storage.objects
for update to authenticated using (
  bucket_id = 'provider-verification-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'provider-verification-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Read-only chatbot view exposes only public listing fields and published records.
create or replace view public.support_chatbot_public_listings with (security_invoker = true) as
select 'caregiver'::text as listing_type, cp.id::text as listing_id, cp.public_name as name,
  cp.headline as description, cp.service_areas as areas, cp.years_experience as experience_years,
  cp.rate_amount as rate_amount, cp.rate_unit as rate_unit, null::text as facility_type,
  null::text[] as services
from public.caregiver_profiles cp where cp.is_published = true
union all
select 'care_home'::text as listing_type, cf.id::text as listing_id, cf.name as name,
  cf.description as description, array[cf.area] as areas, null::integer as experience_years,
  cf.indicative_monthly_fee as rate_amount, 'month'::text as rate_unit,
  cf.facility_type as facility_type, cf.services as services
from public.care_facilities cf where cf.is_published = true;

grant select on public.support_chatbot_public_listings to anon, authenticated;
