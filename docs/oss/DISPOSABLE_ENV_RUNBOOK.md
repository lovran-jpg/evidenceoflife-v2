# Disposable-Environment Test Runbook

Purpose: verify the P1 security changes (storage RLS, signed URLs, calendar
token policies, migration) against a **throwaway** Supabase environment, with
**no production access**.

> Do not run any of this against the production project. Never paste production
> credentials into this repository or into logs.

## Option A — Fully local (recommended, no hosted project)

Requirements:

- Docker Desktop running
- Supabase CLI (`supabase --version`)
- Deno (for edge-function tests)

Steps:

1. Start a local stack (ephemeral Postgres + Storage + Auth):
   ```
   supabase start
   ```
2. Apply all migrations to a fresh database (P1-T9 fresh case):
   ```
   supabase db reset
   ```
   Expected: all migrations, including
   `20260730020000_harden_storage_and_calendar_tokens.sql`, apply with no error.
3. Confirm the bucket is private:
   ```sql
   select id, public from storage.buckets where id = 'moment-photos';
   -- expect public = false
   ```
4. Cross-user storage RLS (P1-T4). Create two test users (User A, User B) via
   the local Auth API. As User A, upload an object under `A.id/...`. Then:
   - As User A: `SELECT` the object → allowed.
   - As User B: `SELECT` the same object → **denied**.
   - Anonymous: list/read → **denied**.
5. Signed URL (P1-T4): call `createSignedUrl('moment-photos', '<A.id>/file', 60)`
   as User A → returns a URL that loads; expires after TTL.
6. Calendar token ownership (P1-T7):
   - As User B, attempt `INSERT/UPDATE/DELETE` on `google_calendar_tokens` for
     User A's row → **denied** (user policies dropped).
   - Service-role upsert (as the callback does) → allowed.
7. Edge-function denial (P1-T5/T6): serve functions locally
   (`supabase functions serve`) and call `life-replay`, `link-preview`,
   `smart-input` without a Bearer token → **401**; with a valid token → allowed.
   Call `image-proxy` without a matching apikey or from a disallowed origin →
   **401/403**.
8. Migration on existing-schema clone (P1-T9 upgrade case): load a dump that
   represents the current production schema **structure only** (no real rows),
   then apply the new migration → no error; old public policy removed; new
   owner-only policy present.

Record pass/fail for each step in `SECURITY_VERIFICATION.md`.

## Option B — Hosted throwaway project

Only if local Docker is unavailable. Create a brand-new free Supabase project
used solely for testing (never the production project). This requires:

- A new project ref and its keys (test-only)
- `supabase link --project-ref <test-ref>`
- The same steps 2–8 above

This path needs credentials/setup that are outside this repository. Stop and
request approval before creating or linking any hosted project.

## Teardown

- Local: `supabase stop` (optionally `--no-backup` to discard volumes).
- Hosted test project: delete the project after verification.
