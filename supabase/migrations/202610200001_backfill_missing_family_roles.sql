-- Repair access for accounts created before the signup-role trigger was installed.
-- Preserve any existing caregiver, facility, operations, support, or admin assignments.
-- Users with no application role are treated as ordinary family accounts.
begin;

insert into public.users (id, full_name, email)
select
  au.id,
  left(coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(au.email, ''), '@', 1), ''),
    'New user'
  ), 160),
  au.email
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select pu.id, 'family'::public.app_role
from public.users pu
left join public.user_roles ur on ur.user_id = pu.id
where ur.user_id is null
on conflict (user_id, role) do nothing;

insert into public.family_profiles (user_id)
select ur.user_id
from public.user_roles ur
where ur.role = 'family'::public.app_role
on conflict (user_id) do nothing;

commit;
