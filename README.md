# Care Connect — responsive web MVP prototype

A responsive React + TypeScript + Vite frontend for the Care Connect launch plan: caregiver discovery, care-home enquiries, family workspace, caregiver workspace, facility workspace and staff/admin demo views. Visual tokens and core flow follow the supplied UI/UX blueprint, app-flow specification, PRD and technical requirements.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Vite. The app runs in **demo mode** without Supabase credentials. Demo actions are local-only and explicitly tell you when no real request/message/report has been sent.

## Optional Supabase connection

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Only the public anon/publishable key belongs in a browser build. Never use a service-role key in `VITE_*` or ship it to the client.

Apply migrations using Supabase CLI after reviewing them:

```bash
supabase db push
```

The migration in `supabase/migrations/` is an **implementation baseline** aligned to the domains and security principles described in `Care_Connect_Backend_Schema_README.md`. The provided upload did not include the referenced canonical `care_connect_schema.sql` DDL, so this migration must be reconciled against that source before production. Some production workflows intentionally remain server-side TODOs.

## Routes in this prototype

- `/` home
- `/caregivers`, `/caregivers/:id` discovery/profile
- `/care-homes`, `/care-homes/:slug` directory/detail
- `/how-it-works`, `/safety`, `/help`
- `/app`, `/app/recipients`, `/app/requests`, `/app/requests/new`, `/app/enquiries`, `/app/messages`
- `/caregiver`, `/caregiver/requests`, `/caregiver/schedule`, `/caregiver/profile`
- `/facility`, `/facility/listing`, `/facility/enquiries`
- `/admin`, `/admin/verifications`, `/admin/incidents`, `/admin/support`

The role selector is a demo convenience, **not authorization**. Do not deploy with it as a security boundary.

## Production blockers

- Implement Supabase Auth flows and phone verification operations process.
- Implement Edge Functions / transactional database functions for request creation, caregiver response + atomic booking creation, confirmation, cancellation, visit completion, payment adjustments, facility enquiries and restricted incident reporting.
- Add comprehensive RLS policy tests. Review the baseline migration: staff authorization helpers and some write policies are intentionally not present; no production traffic should use it without a security review.
- Add idempotency handling to all duplicate-sensitive mutations and map PostgreSQL exclusion violation `23P01` to a friendly scheduling conflict.
- Store verification evidence in private buckets and serve short-lived signed URLs only after authorization.
- Add transactional notification delivery, status history for all transitions, audit events, monitored incident escalation, backups/restore drills and rate limiting.
- Have fluent Nepali reviewers approve consent, cancellation, safety and payment copy. Verify all service boundaries and Nepal-specific legal requirements.
- Replace sample profiles/facilities with approved real listings. Demo listings are not real providers and must not be presented as verified in production.
- Run automated unit, accessibility, RLS, concurrent booking, responsive, reduced-motion and end-to-end tests before launch.

## Design notes

- Palette based on blueprint: `#F7F9F8` background, `#FFFFFF` surface, `#172321` text, `#586864` secondary text, `#DCE5E1` border and `#167D72` primary teal. Dark theme uses blueprint dark tokens.
- Language toggle (English/Nepali), Light/Dark/System theme, responsive layouts and reduced-motion support are included.
- Sample rates and statuses are illustrative UI data only. No online payments are implemented; all amounts are NPR and displayed as estimates/payment records only.
