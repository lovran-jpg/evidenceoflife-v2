# test-results.md — canonical_repo_discovery

Date: 2026-07-28
Command: `npm test` (vitest run)

## Baseline (current dirty working tree)

- Test Files: **20 passed (20)**
- Tests: **176 passed (176)**
- Failures: **0**

Note: one setup file (`src/test/setup.ts`) is not counted as a test file. The
21 `*.test.ts` files map to the 20 executed suites (`example.test.ts` included).

## Interpretation

- No baseline failures exist, so any future workstream that introduces a
  failing test owns that regression (no pre-existing red to hide behind).
- Baseline was captured on the dirty `design-taste-fixes` tree, not a clean
  `main` checkout, because Phase 0 must not disturb in-progress work.
