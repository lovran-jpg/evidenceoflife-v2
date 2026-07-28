# Metric Definitions & Confidence

- **Date:** 2026-07-28
- **Status:** DEFINITIONS READY — **no numbers computed yet** (Phase 2 blocked on Supabase read-only access).
- **Rule:** No number is published until it is produced by the read-only SQL in
  `scripts/metrics/` and reviewed. Estimates are never presented as facts.

## Why there is no "user count" here yet

The execution spec marks `estimated_registered_users` as
`UNVERIFIED_UNTIL_REPRODUCIBLE_QUERY`. Any figure (e.g. "30–40", "54") is an
estimate until `new_project_metrics.sql` (and `old_project_metrics.sql`) are run
and merged. This document defines *how* each number is computed so the result is
reproducible and defensible.

## Sources

| Concept | Source | Notes |
| --- | --- | --- |
| Registered users | `auth.users` | Canonical. 1 row per account. |
| Profile | `public.profiles` | 1 per user; not used for the headline count. |
| Activity | `public.todos` + `public.moments` | `user_id`, `created_at`, `date`. |
| Local day | `date` column | The app's own local calendar day (avoids timezone drift). |
| Focus | `todos.timer_seconds` | Sum for minutes; count > 0 for sessions. |

## Definitions

- **registered_users** — `count(*)` of `auth.users`, minus excluded accounts
  (maintainer, admin, test, duplicates). Exclusion list lives in the SQL.
- **active_users_30d** — distinct `user_id` with a `todos` or `moments` row whose
  `created_at` is within the last 30 days.
- **returning_users** — users with activity on **≥ 2 distinct local dates**
  (`count(distinct date) >= 2`).
- **signed_in_30d** — `auth.users.last_sign_in_at` within 30 days (auth-side
  cross-check for active_users_30d).
- **tasks_created / tasks_completed / moments_captured / focus_sessions /
  focus_minutes / note_items / calendar_events_synced** — straightforward
  aggregate counts over the excluded-adjusted user set.

## Old + New project merge (avoid double counting)

Two Supabase projects were used (an older one was outgrown). To merge:

1. Run the SQL on **each** project separately.
2. **Registered users are NOT additive** if the same person exists in both.
   Use the optional salted-`email_hash` list (same salt on both projects) to
   count the **union** of distinct identities, not the sum.
3. Define the **account-switch boundary date** (`supabase_account_switch_date`,
   currently UNKNOWN). Activity before the boundary counts to the old project;
   after, to the new. Event-count metrics (tasks, moments, focus) can be summed
   across the boundary since events are distinct; **user** metrics must be deduped.
4. Report confidence and any missing-data gaps (e.g. old project partially
   pruned, retention limits).

## Confidence labeling (required on every published number)

Each figure must ship with:
- The exact query + project(s) it came from.
- Whether it is a **union** (users) or **sum** (events).
- Known gaps (deleted data, unknown boundary, excluded-account assumptions).

## What NOT to output

Names, emails, task/note text, photos, coordinates, calendar contents — never.
Only the aggregate columns returned by the scripts.
