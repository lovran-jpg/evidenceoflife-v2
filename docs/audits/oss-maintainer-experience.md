# OSS Maintainer Experience — Phase 1 Report

- **Date:** 2026-07-28
- **Agent role:** oss_maintainer_experience
- **Mode:** LOCAL_DRAFT (additive files only; no commit/push)

## Deliverables added

| File | Purpose |
| --- | --- |
| `LICENSE` | MIT license (owner-confirmed) |
| `CONTRIBUTING.md` | Setup, PR gates (tsc/test/lint), scope expectations |
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1 |
| `SECURITY.md` | Private vulnerability reporting via GitHub advisories |
| `PRIVACY.md` | Data-handling transparency for users & self-hosters |
| `CHANGELOG.md` | Keep a Changelog scaffold with `[Unreleased]` |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Structured bug form |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Problem-first feature form |
| `.github/ISSUE_TEMPLATE/config.yml` | Disable blank issues; route security privately |
| `.github/PULL_REQUEST_TEMPLATE.md` | One-change PR checklist |
| `docs/oss/roadmap.md` | Direction (no dates/promises) |
| `docs/oss/release-checklist.md` | Approval-gated release steps |
| `docs/audits/oss-license-recommendation.md` | License + dependency-compat + secret-scan record |

## Acceptance criteria (from spec `oss_foundation`)

- [x] License not selected blindly — dependency compatibility scanned (all permissive; no copyleft).
- [x] Templates describe actual workflows (real `tsc`/`test`/`lint` gates, real views).
- [x] No unsustainable support-time promise — docs state best-effort, spare-time.
- [x] No unverified adoption metrics presented as facts.
- [x] No medical/therapeutic claims (positioning framed as design goals).

## Notes & open items

- `SECURITY.md` and issue `config.yml` link to
  `github.com/Cyriellewu/evidenceoflife-v2/security/advisories/new`. Enable
  **Private Vulnerability Reporting** in repo Settings → Security for that link
  to work.
- `LICENSE` copyright uses the `Cyriellewu` handle + 2026; swap to legal name if preferred.
- Before flipping the repo to public: address the `supabase/.temp/` tracking
  note in `oss-license-recommendation.md` and complete the Phase 2 RLS audit.

## Not done (out of scope / blocked)

- README already exists and is accurate; left as-is (no churn).
- Metrics, RLS deep audit → Phase 2 (needs Supabase read-only access).
- Release/tag/public toggle → require human approval.
