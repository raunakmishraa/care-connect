-- Create a normal family account automatically when a new Supabase Auth user signs up.
-- This does not grant caregiver, facility_manager, admin, operations, or support roles.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submitted_name text;
begin
  submitted_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  if submitted_name is null then
    submitted_name := split_part(coalesce(new.email, 'New user'), '@', 1);
  end if;

  insert into public.users (id, full_name, email)
  values (new.id, left(submitted_name, 160), new.email)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'family'::public.app_role)
  on conflict (user_id, role) do nothing;

  insert into public.family_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_aashrayacare on auth.users;
create trigger on_auth_user_created_aashrayacare
after insert on auth.users
for each row execute function public.handle_new_auth_user();
