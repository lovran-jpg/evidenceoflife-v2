# Test & CI Status — Phase 3 (draft)

- **Date:** 2026-07-28
- **Agent role:** testing_and_ci
- **Mode:** LOCAL_DRAFT (CI file added, not pushed; no workflow has run on GitHub)

## Local verification of the CI chain

| Step | Command | Result |
| --- | --- | --- |
| Type check | `npx tsc --noEmit -p tsconfig.app.json` | **PASS** (exit 0) |
| Test | `npm test` | **PASS** — 20 files, 176 tests |
| Build | `npm run build` | **PASS** — built in ~10s |
| Lint | `npm run lint` | **FAIL (baseline)** — improving: 273 → **205 errors** |

## Lint baseline (pre-existing — NOT introduced by this work)

Dominant rules (remaining):
- `@typescript-eslint/no-explicit-any` — ~204, the large majority (needs real types; done incrementally, safest files first).
- `react-hooks/exhaustive-deps` — warnings.
- Remaining `no-constant-binary-expression` / `no-unused-expressions` sit in
  dirty WIP files (`PlanView`, `PlanTimelineView`, `MapView`, `buildPlanBlocks`)
  and are deferred so they can land with that in-progress work, not a lint PR.

### Finding: stale generated Supabase types

`src/integrations/supabase/types.ts` is **out of date** — it lacks the
`moments.links` column (added by migration `20260403183000_add_links_to_moments`).
Any `select('...links...')` therefore resolves to a Supabase `SelectQueryError`
at compile time, which is why `src/hooks/moments/data.ts` needed casts. Runtime
is correct. Proper fix: regenerate types (`supabase gen types typescript`) — a
Phase 2/3 task needing Supabase access; `types.ts` is also a WIP-modified file.

### Burndown progress (this session)

- `tailwind.config.ts`: `require()` → ESM import.
- `src/lib/analytics.ts`: removed redundant `any` cast.
- Ignored vendored/scratch dirs (`.agents`, `Scratchpad`) in `eslint.config.js`.
- `command.tsx` / `textarea.tsx`: empty interface → type alias.
- `TodayView.tsx`: ternary statement → `if/else` (no-unused-expressions).
- `todayHelpers.ts`: removed useless escape; rewrote a misleading emoji class.
- `usePlaces.ts`: replaced all 13 `any` — query results typed via
  `City`/`Place`/`Visit`; insert/update payloads typecheck without `as any`.
- `hooks/moments/data.ts`: replaced all 12 `any` — added a `MomentRow` type,
  errors typed `unknown`; stale-types selects narrowed via `unknown` casts (not
  `any`). `tsc` verified clean.
- `useDueReminders.ts`: dropped all 9 `any` — `due_reminders` is already in the
  generated types, so the historical `'due_reminders' as any` and payload casts
  were stale and removed; `tsc` verified clean.
- `useMoments.ts`: replaced all 6 `any` — insert result narrowed via a typed
  `row`; `dbUpdates` typed `Record<string, unknown>` and cast to the moments
  `Update` type at the two `.update()` calls (stale `links` column). `tsc` clean.
- `LocationPopover.tsx`: replaced all 6 `any` — `GeoBody` type for the geo
  request body, `LocationCategory` union for `onSelect` category casts. `tsc` clean.
- `useImportedEvents.ts`: dropped all 5 `any` — `ImportedEvent` already declares
  `is_completed` so those casts were unnecessary; ICS accumulator typed
  `Record<string, string>`; `.update()` payloads typecheck without casts. `tsc` clean.

Net: **273 → 205 errors**, with `tsc`, `npm test` (176), and `npm run build` green.

Because this is a pre-existing baseline, the CI draft (`.github/workflows/ci.yml`)
marks the **lint step `continue-on-error: true`** so CI reflects real
type/test/build health instead of being red from day one. Type check, test, and
build are **blocking** and currently green.

## Recommended follow-up (separate PRs, not done here)

1. Burn down `no-explicit-any` in high-traffic files (`src/pages/Index.tsx`,
   `src/lib/analytics.ts`) incrementally.
2. Convert the `require()` in `tailwind.config.ts` to an ESM import.
3. Once `npm run lint` is clean, flip `continue-on-error` to `false`.

## Notes

- Baseline captured on the dirty `design-taste-fixes` tree (in-progress work),
  not a clean `main` checkout.
- No new failing tests were introduced; any future red is owned by the change
  that causes it.
