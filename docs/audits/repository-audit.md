# Repository Audit — Evidence of Life v2

- **Date:** 2026-07-28
- **Mode:** READ_ONLY (Phase 0)
- **Auditor role:** repository_auditor
- **Canonical remote:** `git@github.com:Cyriellewu/evidenceoflife-v2.git`
- **Base/production branch:** `main` (`origin/HEAD -> origin/main`)
- **HEAD:** `07a6a672bfaf9e74a3622a731f2db3180846f919` (level with `origin/main`)

## 1. Identity & provenance

The single configured remote is the private repo
`Cyriellewu/evidenceoflife-v2`. Owner and product name both match the execution
spec. No competing "v1"/legacy remote is configured locally, so canonical
selection is unambiguous from git evidence (see
`canonical-repository-decision.md`).

## 2. Architecture inventory

### Frontend
- Vite 5 (`@vitejs/plugin-react-swc`), React 18.3, TypeScript 5.8.
- Tailwind CSS 3.4, shadcn/ui on Radix primitives, Recharts, Leaflet (+ heat).
- TanStack Query 5, React Router 6, react-hook-form + zod, date-fns 3.6.
- Source layout: `src/components/{ui,views,...}`, `src/hooks`, `src/lib`,
  `src/pages`, `src/integrations/supabase`, `src/types`, `src/styles`.

### Backend (Supabase)
- **Migrations:** 29 SQL files (`supabase/migrations/`), dated 2026-02 → 2026-07.
- **Edge functions (8):** `geo`, `google-calendar-auth`,
  `google-calendar-callback`, `google-calendar-sync`, `image-proxy`,
  `life-replay`, `link-preview`, `smart-input`.
- Browser client (`src/integrations/supabase/client.ts`) uses only
  `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable/anon key —
  correct). Service-role keys appear **only** in edge functions via
  `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` (server-side, expected).

### Tests
- 20 executed Vitest suites (21 `*.test.ts` files incl. shared setup).
- Baseline: **176 passed / 0 failed** (recorded 2026-07-28).
- Coverage skews to pure logic: scheduling, carry-over, recurring, stale timers,
  timezone/date rollover, step/timeline segments, classification, export.

### Deployment
- `vercel.json` rewrites all routes to `/index.html` (SPA). Static host; Vercel
  inferred but not verified against a live deployment in Phase 0.

## 3. Documentation state

- `README.md`: **present and accurate** — features, tech stack, getting started,
  scripts, project structure, env vars (notes publishable key is browser-safe),
  deployment. Good Phase 1 starting point.
- Design/product docs at root: `CLAUDE.md`, `tasks.md`,
  `openclaw-*.md`, `literature-review.md`, `market-hit-products-analysis.md`.

## 4. OSS governance gaps

| Item | Status |
| --- | --- |
| LICENSE | **Missing** (repo is "all rights reserved" by default) |
| CONTRIBUTING.md | Missing |
| CODE_OF_CONDUCT.md | Missing |
| SECURITY.md | Missing |
| PRIVACY.md | Missing |
| CHANGELOG.md | Missing |
| Issue/PR templates | Missing |
| CI workflows (root `.github/workflows`) | Missing |

> Note: `LICENSE` and `.github/workflows/*` matches during discovery were all
> inside `.agents/skills/**` (vendored third-party skills) and are **not** part
> of this project's governance.

## 5. Security spot-check (full audit deferred to Phase 2)

- Only `.env.example` is tracked; `.env` / `.env.*` are gitignored.
- No `service_role` references in `src/` (browser) code.
- Positive posture, but **RLS ownership**, storage-bucket visibility, and
  OAuth/token handling still require the Phase 2 read-only audit.

## 6. Dead code / obsolete prototypes

- Not fully assessed in Phase 0. Untracked new libs/tests (e.g. `autoSchedule`,
  `recurringTodos`, `staleTimers`, `stepTimelineSegments`) appear to be active
  in-progress features, not dead code. Vendored `.agents/skills/**` should be
  excluded from project scope (and likely gitignored).

## 7. Risks

See `.agent-handoff/canonical_repo_discovery/risks.md`. Highest: dirty working
tree (process risk), missing LICENSE (blocks OSS), private→public exposure.
