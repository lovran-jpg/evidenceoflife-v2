# Security Model

This document describes the trust boundaries and authorization model for the
Evidence of Life backend (Supabase Postgres + Storage + Edge Functions). It
reflects the changes on branch `security/pre-public-hardening-v2`.

## Trust boundaries

- **Browser client** holds only the Supabase **anon** key plus a per-user JWT
  after login. It is untrusted for authorization; all access is enforced by
  Row Level Security (RLS) and edge-function checks.
- **Edge functions** run in Deno with access to server-only secrets
  (`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`, `OAUTH_STATE_SECRET`).
  These secrets are never shipped to the browser.
- **Service role** bypasses RLS and is used only inside edge functions for
  operations users must not perform directly (e.g. writing calendar OAuth
  tokens).

## Photo storage privacy

- Bucket `moment-photos` is **private** (`public = false`).
- Storage RLS grants `SELECT` only when the object's first path segment equals
  `auth.uid()` (owner-only). Anonymous users cannot list or read.
- The frontend never renders durable public URLs. It stores the object **path**
  and renders images through `StorageImage`, which calls
  `resolveMomentPhotoUrl` to mint a **short-lived signed URL** (TTL 1 hour).
- Legacy public URLs are transparently converted to the object path and signed.

Files: `supabase/migrations/20260730020000_harden_storage_and_calendar_tokens.sql`,
`src/lib/momentPhotos.ts`, `src/components/StorageImage.tsx`.

## OAuth (Google Calendar) state integrity

- `google-calendar-auth` requires a valid user JWT (`requireUser`), then issues
  an OAuth `state` that is **HMAC-SHA256 signed** (`signOAuthState`) and carries
  `{ userId, redirectTo, exp, nonce }` with a 10-minute expiry.
- `google-calendar-callback` verifies the signature and expiry
  (`verifyOAuthState`) before trusting `userId`. Tampered, expired, malformed,
  or missing state is rejected. The user identity is never read from the
  request until the signature verifies.
- The signing key is `OAUTH_STATE_SECRET` (falls back to `GOOGLE_CLIENT_SECRET`).

## Redirect allowlist

- `sanitizeRedirectTo` accepts only origins in `APP_URL` plus optional
  comma-separated `ALLOWED_REDIRECT_ORIGINS`. Unknown origins,
  protocol-relative URLs (`//host`), `javascript:` URIs and malformed input all
  fall back to the configured app origin. Only `origin + pathname` is returned
  (query and fragment are dropped).

## Calendar token handling

- `google_calendar_tokens` rows are written **only** by the callback using the
  service role. User-facing `INSERT/UPDATE/DELETE` policies are dropped, so a
  user cannot write another user's token row.
- The callback does not return or log access tokens, refresh tokens,
  authorization codes, or the raw provider payload. On failure it returns a
  generic message and logs only the HTTP status.

## Edge-function access classification (`verify_jwt = false`)

`verify_jwt = false` means the Supabase gateway does not pre-validate a JWT;
each function enforces its own model:

| Function | Model |
|----------|-------|
| `google-calendar-auth` | Requires user JWT (`requireUser`) |
| `google-calendar-callback` | Public OAuth callback with signed-state validation + service-role token write |
| `google-calendar-sync` | Requires user JWT (`auth.getUser`) |
| `life-replay` | Requires user JWT (`requireUser`) |
| `link-preview` | Requires user JWT (`requireUser`) |
| `smart-input` | Requires user JWT (`auth.getUser`) |
| `geo` | Requires user JWT (`auth.getUser`) |
| `image-proxy` | Called from `<img src>`; requires matching anon apikey **and** an Origin/Referer on the allowlist |

`image-proxy` cannot use a Bearer header because it is loaded by the browser as
an image; it is protected by apikey + origin allowlist instead.

## Secrets

- Never exposed to the browser: `SUPABASE_SERVICE_ROLE_KEY`,
  `GOOGLE_CLIENT_SECRET`, `OAUTH_STATE_SECRET`.
- Local development secrets live only in the gitignored `.env` (verified never
  committed; see `docs/oss/SECRET_SCAN_SUMMARY.md`).
