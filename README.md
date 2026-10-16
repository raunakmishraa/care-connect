# AashrayaCare — responsive web MVP prototype

A responsive React + TypeScript + Vite frontend for the AashrayaCare launch plan: caregiver discovery, care-home enquiries, family workspace, caregiver workspace, facility workspace and staff/admin demo views. Visual tokens and core flow follow the supplied UI/UX blueprint, app-flow specification, PRD and technical requirements.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Vite. The public marketing pages run without Supabase credentials. **Private routes stay locked unless Supabase authentication is configured and the signed-in account has an assigned database role.** The former client-side demo role selector has been removed because it was not an authorization boundary.

## Authentication and route authorization

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`, create users through your trusted Supabase signup/invitation workflow, and assign roles in `public.user_roles` using a trusted administrative process. Do not allow users to write their own roles. The frontend checks the authenticated Supabase session and database-assigned roles before rendering private routes.

- `/admin` and `/admin/*`: requires the exact `admin` role.
- `/caregiver` and `/caregiver/*`: requires the `caregiver` role. Data access must remain scoped to the authenticated caregiver through RLS.
- `/facility` and `/facility/*`: requires the `facility_manager` role. Data access must remain scoped to facilities owned by the authenticated manager through RLS.
- `/app` and `/app/*`: requires the `family` role.
- `/caregivers` and `/care-homes`: public directory pages.
- `/caregivers/:id` and `/care-homes/:slug`: require an authenticated session.

**Security limitation:** frontend route guards improve navigation and prevent accidental UI exposure; they are not a substitute for server-side authorization. Before production, verify every table and storage bucket has appropriate Supabase RLS/storage policies and that all privileged mutations run in trusted server-side functions. Do not ship secrets or trust role values supplied by browser state.

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
- `/caregiver`, `/caregiver/requests`, `/caregiver/schedule`, `/caregiver/profile`, `/caregiver/messages`
- `/facility`, `/facility/listing`, `/facility/enquiries`
- `/admin`, `/admin/verifications`, `/admin/incidents`, `/admin/support`

The previous role selector has been removed. Roles are read from `public.user_roles` for the authenticated Supabase user; users must not be able to grant themselves roles.

## Production blockers

- Add account registration/invitation and phone verification operations processes; sign-in and session/role checks are now wired to Supabase Auth when configured.
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

## Authentication signup flow

New users can create a standard account from **Get started → Create an account**. Standard accounts are assigned the `family` role automatically; signing up does not grant caregiver, facility-manager, or admin access. Caregiver and care-home verification should be handled through separate application and review workflows.

The migration `supabase/migrations/202610160001_auth_signup_profiles.sql` installs a Supabase Auth trigger that creates the `public.users`, `public.user_roles` (`family` only), and `public.family_profiles` rows for new signups. Apply the baseline schema migration first, then this migration, to the same Supabase project used by `VITE_SUPABASE_URL`. If the baseline schema has not been deployed, signup may create an Auth user but the application profile/role setup will fail. Review migrations before applying them to production.

Email confirmation behavior follows the Supabase project's **Authentication → Providers → Email** settings. When confirmation is enabled, users must confirm their email before signing in; this is separate from caregiver or facility verification.
