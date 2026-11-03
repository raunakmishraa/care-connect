-- Allow the audited SECURITY DEFINER provider-application review RPC to make
-- verification-status changes when invoked by authorized admin/operations staff.
-- Direct client writes remain blocked for ordinary authenticated users.
create or replace function public.guard_verification_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and current_user <> 'service_role' then
    if not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin'::public.app_role, 'operations'::public.app_role)
    ) then
      if tg_table_name = 'caregiver_profiles' then
        if (tg_op = 'INSERT' and (new.verification_status <> 'incomplete' or new.is_published))
          or (tg_op = 'UPDATE' and (
            new.verification_status is distinct from old.verification_status
            or new.is_published is distinct from old.is_published
          )) then
          raise exception 'Verification and publication decisions require authorized operations staff';
        end if;
      elsif tg_table_name = 'care_facilities' then
        if (tg_op = 'INSERT' and (new.verification_status <> 'incomplete' or new.is_published))
          or (tg_op = 'UPDATE' and (
            new.verification_status is distinct from old.verification_status
            or new.is_published is distinct from old.is_published
          )) then
          raise exception 'Verification and publication decisions require authorized operations staff';
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;
