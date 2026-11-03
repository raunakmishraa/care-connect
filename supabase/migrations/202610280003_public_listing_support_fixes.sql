-- Restore anonymous access to explicitly public directory schema objects.
-- USAGE only allows API roles to resolve objects in public; it does not bypass table grants or RLS.
grant usage on schema public to anon, authenticated;

-- Explicit read privileges required by the invoker-secured public directory and chatbot view.
-- RLS policies continue to limit rows to approved, published records.
grant select on table public.caregiver_profiles to anon, authenticated;
grant select on table public.caregiver_services to anon, authenticated;
grant select on table public.service_categories to anon, authenticated;
grant select on table public.care_facilities to anon, authenticated;
grant select on table public.support_chatbot_public_listings to anon, authenticated;

-- Keep the support view strictly public: no applications, private contact details, roles or messages.
-- Enrich caregiver rows with their active public service category labels so the chatbot can
-- answer service questions using the same published listing records shown in the directory.
create or replace view public.support_chatbot_public_listings with (security_invoker = true) as
select
  'caregiver'::text as listing_type,
  cp.id::text as listing_id,
  cp.public_name as name,
  cp.headline as description,
  cp.service_areas as areas,
  cp.years_experience as experience_years,
  cp.rate_amount as rate_amount,
  cp.rate_unit as rate_unit,
  null::text as facility_type,
  coalesce((
    select array_agg(sc.name_en order by sc.sort_order, sc.name_en)
    from public.caregiver_services cs
    join public.service_categories sc on sc.id = cs.category_id
    where cs.caregiver_id = cp.id
      and cs.is_active = true
      and sc.is_active = true
  ), array[]::text[]) as services
from public.caregiver_profiles cp
where cp.is_published = true
  and cp.verification_status = 'approved'::public.verification_status

union all

select
  'care_home'::text as listing_type,
  cf.id::text as listing_id,
  cf.name as name,
  cf.description as description,
  array[cf.area] as areas,
  null::integer as experience_years,
  cf.indicative_monthly_fee as rate_amount,
  'month'::text as rate_unit,
  cf.facility_type as facility_type,
  cf.services as services
from public.care_facilities cf
where cf.is_published = true
  and cf.verification_status = 'approved'::public.verification_status;

grant select on public.support_chatbot_public_listings to anon, authenticated;
