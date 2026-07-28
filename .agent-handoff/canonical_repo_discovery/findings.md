# canonical_repo_discovery — Findings

Date: 2026-07-28
Mode: READ_ONLY

## Canonical repository (evidence-based)

- **Remote:** `git@github.com:Cyriellewu/evidenceoflife-v2.git` (fetch + push)
- **Owner:** Cyriellewu — matches the spec `project.owner`.
- **Product name match:** repo `evidenceoflife-v2` matches product "Evidence of Life v2".
- **origin/HEAD:** points to `origin/main` → default/production branch is `main`.
- **HEAD:** `07a6a672bfaf9e74a3622a731f2db3180846f919`, level with `origin/main`.

Conclusion: this local workspace is a working clone of the canonical v2 repository. No other candidate repository is referenced by the remotes.

## Branch inventory

| Branch | Role |
| --- | --- |
| `main` | default + production (origin/HEAD) |
| `design-taste-fixes` | current checkout; design/UX in-progress work |
| `report-restructure` | WIP report/landing edits |
| `ui-rework` | WIP UI typography/calendar work |

## Repository inventory

- **Frontend:** Vite 5 + React 18.3 + TS 5.8 + Tailwind 3.4 + shadcn/ui (Radix). Confirmed in `package.json`.
- **Backend:** Supabase — 29 SQL migrations in `supabase/migrations/`, 8 edge functions in `supabase/functions/` (geo, google-calendar-auth, google-calendar-callback, google-calendar-sync, image-proxy, life-replay, link-preview, smart-input).
- **Tests:** 21 Vitest files in `src/test/`; baseline **176 passing / 0 failing**.
- **Deployment:** `vercel.json` (SPA rewrite to `index.html`) → static host, Vercel inferred.
- **README:** present and accurate; documents features, stack, setup, env vars, deployment.

## Gaps (Phase 0 scope)

- No root `LICENSE` → repository is **not yet open-source licensed**.
- No `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `PRIVACY.md`, `CHANGELOG.md`.
- No `.github/` issue/PR templates or CI workflows at repo root. (Workflow files found under `.agents/skills/**` belong to vendored skills, **not** this project.)
- Repository is private; no approved public-visibility plan exists.

## Working-tree caveat (important for later phases)

The tree is **dirty**: ~34 modified tracked files and many untracked new files (new libs, tests, hooks, and vendored skill folders). Phase 0 therefore made **no** branch switch, stash, commit, or push. Any later automated commit must first coordinate with the owner to avoid disturbing in-progress work.
