# Security Verification Status

Tracks which P1 security acceptance criteria are verified, and by what method.
**Code inspection alone does not satisfy behavioral/database criteria** — those
are marked "Pending environment" until run against a disposable Supabase project
(see `DISPOSABLE_ENV_RUNBOOK.md`).

Branch: `security/pre-public-hardening-v2`

## Automated tests that pass now (no external environment)

Run:

```
deno test --allow-env --allow-net supabase/functions/_shared/auth.test.ts
npm test -- --run
```

| Test | Covers | Status |
|------|--------|--------|
| OAuth state valid round-trip | P1-T2 | PASS |
| OAuth state tampered body rejected | P1-T2 | PASS |
| OAuth state tampered signature rejected | P1-T2 | PASS |
| OAuth state expired rejected | P1-T2 | PASS |
| OAuth state malformed/missing rejected | P1-T2 | PASS |
| userId not trusted until signature verifies | P1-T2 | PASS |
| Redirect allowlist accept configured origins | P1-T3 | PASS |
| Redirect allowlist reject unknown origin | P1-T3 | PASS |
| Redirect allowlist reject protocol-relative/malformed | P1-T3 | PASS |
| `requireUser` rejects missing/non-Bearer auth (401) | P1-T1/T5 | PASS |
| `moment-photos` unit tests (`src/test/moment-photos.test.ts`) | P1-T4 (frontend helper) | PASS |

## Criteria pending disposable-environment verification

These require a real Postgres + Storage instance and **must not** be marked done
from code inspection:

| Criterion | Task | Method |
|-----------|------|--------|
| User A can read own photos; cannot read User B's | P1-T4 | Two-user storage RLS test on disposable project |
| Anonymous cannot list/read private photos | P1-T4 | Anonymous storage denial test |
| Frontend renders via short-lived signed URL end-to-end | P1-T4 | Manual/e2e against disposable project |
| Fresh-database migration applies cleanly | P1-T9 | `supabase db reset` on fresh project |
| Existing-schema migration applies cleanly | P1-T9 | Apply on a clone representing current schema |
| Cross-user RLS on calendar tokens | P1-T7 | Two-user query test |
| Unauthenticated edge-function denial (live) | P1-T5/T6 | Call deployed functions without/with bad auth |

## Static classification (code review)

| Item | Task | Status |
|------|------|--------|
| Edge-function access model documented | P1-T5 | Done (see `docs/SECURITY_MODEL.md`) |
| No token/provider payload returned or logged in callback | P1-T8 | Done (callback hardened) |
| Costly endpoints require auth (life-replay, link-preview, smart-input) | P1-T6 | Done (all require user JWT) |

## Residual notes

- `geo`, `smart-input`, `google-calendar-sync` enforce auth via inline
  `auth.getUser` rather than the shared `requireUser` helper. Functionally
  equivalent; optional future refactor for consistency.
- `image-proxy` intentionally uses apikey + origin allowlist (image tags cannot
  send Bearer headers).
