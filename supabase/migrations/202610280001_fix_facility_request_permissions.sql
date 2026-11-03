-- The care_requests insert policy checks care_facilities when a family targets a
-- facility. The public directory policy already limits visible rows to approved,
-- published facilities (plus each manager's own facility policy). Without the
-- underlying table SELECT grant, PostgreSQL raises "permission denied for table
-- care_facilities" while evaluating that request policy.
--
-- Grant query access but keep row access protected by the table's existing RLS
-- policies; this does not grant INSERT, UPDATE or DELETE to public visitors.
grant select on table public.care_facilities to anon, authenticated;

-- Ensure row-level security remains enabled so the table grant does not expose
-- unapproved or unpublished facilities.
alter table public.care_facilities enable row level security;
