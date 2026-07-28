# next-action.md — canonical_repo_discovery

Date: 2026-07-28
Workstream status: **COMPLETE**
Phase 0 exit gate: **MET**

## Immediate decisions required from the owner (Cyriellewu)

1. **License choice** — pick one so Phase 1 `oss_foundation` can finalize a
   `LICENSE`. Recommendation to be drafted; likely candidates:
   - **MIT** (maximally permissive, easiest for contributors), or
   - **AGPL-3.0** (keeps hosted forks open — fits a self-hostable personal-data app).
2. **Public-repo intent** — confirm whether/when `Cyriellewu/evidenceoflife-v2`
   should become public. This gates Phase 5 (application evidence) and requires
   a git-history secret scan first.
3. **Supabase read-only access** — provide a read-only path (or agree to run
   supplied SQL yourself in the SQL Editor) to unblock Phase 2 metrics +
   security/RLS audit. No service-role secrets in agent output.
4. **Production target** — confirm Vercel (inferred from `vercel.json`).

## What can proceed without new inputs (next autonomous step, on approval)

- Phase 1 `oss_foundation` **local drafts**: CONTRIBUTING.md, CODE_OF_CONDUCT.md,
  SECURITY.md, PRIVACY.md, issue/PR templates, roadmap, release checklist, and a
  LICENSE **recommendation** doc (final LICENSE awaits decision #1).
- Phase 3 `testing_and_ci` **local drafts**: a `.github/workflows/ci.yml` draft
  (lint + typecheck + test + build) — not committed, for review.

## What stays blocked

- Phase 2 (metrics, security/RLS deep audit) — needs Supabase access.
- Phase 4/5 (release, public application) — need approvals + verified evidence.
