# risks.md — canonical_repo_discovery

Date: 2026-07-28

| # | Risk | Severity | Evidence | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | Dirty working tree with large uncommitted/untracked changes | HIGH (process) | `git status --short` shows ~34 modified + many untracked files | Do not auto-commit/stash/switch branches. Owner should review & commit or stash intentionally before any branch-based workstream. |
| R2 | Repository is private; going public may expose history | HIGH | remote is private per CLAUDE.md; no history scrub done | Before any public toggle, run git-history secret scan (Phase 2). Requires explicit human approval (never_do: making private repo public without approval). |
| R3 | Vendored skill folders under `.agents/skills/**` contain their own LICENSE/CI/workflows | MEDIUM | file_search matched LICENSE + `.github/workflows/*` only inside skills | Do NOT treat these as project governance files. Exclude from OSS-foundation and CI scope. Consider `.gitignore` for `.agents/skills/` (already partially ignored per CLAUDE.md notes). |
| R4 | No LICENSE — code is "all rights reserved" by default | HIGH (blocks OSS) | no root LICENSE | Owner must pick a license (Phase 1). Until then it is not legally open source. |
| R5 | Usage metrics unknown/unverified | MEDIUM | no Supabase access | Phase 2 read-only queries; never present estimates as facts. |
| R6 | Two Supabase projects → double-counting risk for metrics | MEDIUM | project.current_usage.database_history | Define non-overlapping account-switch boundary before merging metrics (Phase 2). |

## Stop/escalate conditions currently active

- Phase 2 blocked: requires Supabase read-only access (a `required_input` marked sensitive/unknown).
- License selection and public-repo decision require human approval.
