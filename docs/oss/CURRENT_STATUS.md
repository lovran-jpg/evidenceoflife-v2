# Current Status — OSS Readiness

**Status date:** 2026-07-30
**Phase:** P0 — Freeze, inventory and exposure assessment
**Branch:** `oss/p0-planning-baseline`

## Freeze declaration (P0-T1)

A **feature and UI-polish freeze** is in effect until phases **P1 (security hardening)**
and **P2 (public repository hygiene)** are complete.

During the freeze:

- No new product features.
- No UI polish unless it fixes a validated user-blocking problem.
- No pushes to `main`; all work happens on dedicated branches.
- No production Supabase, OAuth, storage, migration or credential changes without
  explicit maintainer approval.
- No advertising or distributing the hosted application while unverified P0
  security findings remain (see P0-T6).

Exit condition: freeze lifts when P1 and P2 acceptance criteria are met and the
security PR is approved for deployment.

## Open P0 items

| Task | Description | State |
|------|-------------|-------|
| P0-T1 | Declare freeze | Done (this file) |
| P0-T2 | Record exact baseline | Done (`BASELINE.json`) |
| P0-T3 | Full-history secret scan (gitleaks or equivalent) | Done — clean (175 commits, 0 leaks) |
| P0-T4 | Credential / private-data history check | Done — no history exposure |
| P0-T5 | Rotation decision request if exposure found | Not required — maintainer decided no rotation (local-only `.env`) |
| P0-T6 | Distribution restriction while findings open | Active |

## Notes

- This is internal planning documentation. It contains no secret values.
- Detailed evidence and status live in this `docs/oss/` folder, not in the
  user-facing product.
