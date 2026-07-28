# Public Usage Summary (DRAFT — DO NOT PUBLISH)

- **Date:** 2026-07-28
- **Status:** ⛔ **PENDING QUERY** — no numbers filled in. This template stays
  unpublished until the read-only SQL is run and the results are reviewed.
- **Hard rule:** Every `<PENDING>` below is replaced ONLY by a value returned
  from `scripts/metrics/*.sql`. No estimates. No "54", "30–40", or any guessed
  figure goes here.

> Reminder from `metric-definitions.md`: user metrics are a **union** across the
> old + new Supabase projects (dedupe by salted email hash), event metrics are a
> **sum**. Registered / active / returning are reported separately, never merged
> into one "users" number.

## Headline (fill after query)

| Metric | Value | Source | Type |
| --- | --- | --- | --- |
| Registered users | `<PENDING>` | union(old,new) auth.users | union |
| Active users (30d) | `<PENDING>` | activity in last 30d | union |
| Returning users (≥2 days) | `<PENDING>` | count(distinct date) ≥ 2 | union |
| Tasks created | `<PENDING>` | todos | sum |
| Tasks completed | `<PENDING>` | todos.is_completed | sum |
| Moments captured | `<PENDING>` | moments | sum |
| Focus sessions | `<PENDING>` | todos.timer_seconds > 0 | sum |
| Focus minutes | `<PENDING>` | sum(timer_seconds)/60 | sum |
| Calendar events synced | `<PENDING>` | imported_events | sum |

## Confidence & caveats (fill after query)

- Account-switch boundary date: `<PENDING / UNKNOWN>`
- Excluded accounts (maintainer/test): `<COUNT>` (emails not shown)
- Dedup method for users: `<email_hash union | ranges (overlap unknown)>`
- Known data gaps: `<e.g. old project partially pruned>`

## How this was produced (reproducibility)

1. `scripts/metrics/new_project_metrics.sql` on the current project → `new.json`
2. `scripts/metrics/old_project_metrics.sql` on the old project → `old.json`
3. `python scripts/metrics/merge_metrics.py --old old.json --new new.json \
   --old-hashes old_hashes.txt --new-hashes new_hashes.txt`
4. Paste merged output above; keep the raw result rows in
   `docs/metrics/private-validation-report.md` (not public).
