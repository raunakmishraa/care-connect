# Implementation notes

## Backend transaction requirements

Before enabling real booking traffic, create server-side functions that validate JWT, role, ownership, request status, caregiver approval, service eligibility, service area and schedule. For acceptance, lock/claim the request and in one transaction: update request status, create exactly one booking, insert status history, write audit log and enqueue notification. Require a per-action idempotency key and return the existing outcome on retry. Use the database exclusion constraint to reject overlaps; translate SQLSTATE `23P01` into a friendly conflict.

Booking confirmation must be a distinct action after terms are agreed. Requests, bookings and payment status must remain separate. All timestamps are `timestamptz` and displayed in `Asia/Kathmandu`; all money uses `numeric(12,2)` and NPR.

## Data protection

Care recipient notes, addresses/access instructions, identity evidence, reviewer notes, safety incident narratives, private operations notes and payment adjustments are restricted. Evidence object keys belong in private storage. The client never chooses its own privileged role. Public directories expose only approved/published entries.

## Prototype behavior

This project contains sample data and local demo actions. Toasts explicitly identify actions that are not sent to a server. The role switcher is for reviewing different product areas only. Do not use the prototype to collect real recipient health information or real safeguarding reports.
