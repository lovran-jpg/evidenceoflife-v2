# Release Notes — v0.1.0 (DRAFT — not released)

> **Status: DRAFT.** This is prepared ahead of the release gate. It must not be
> published or tagged until the gate below is satisfied and the maintainer
> (Willow) explicitly approves (see `planning.json` P4-T7 and
> `docs/oss/release-checklist.md`). Nothing here is a claim that a release has
> happened.

## Release gate (must all be true before tagging v0.1.0)

- [ ] Security hardening (`security/pre-public-hardening-v2`) reviewed, merged,
      and deployed; behavioral DB/RLS verification passed on a disposable
      environment (P1-T4, P1-T7, P1-T9).
- [ ] Repository hygiene (`oss/public-repository-hygiene`) merged.
- [ ] Quality gates (`oss/quality-gates-p3`) merged; all required CI checks
      blocking and green on `main`.
- [ ] Self-hosting guide independently verified from a clean machine (P2-T9).
- [ ] No open P0 issue; no real user data in any release asset.

## What Evidence of Life is

A privacy-conscious personal record that turns plans, focus sessions, completed
work, moments, places, and calendar activity into an evidence-based view of how
your days were actually lived. Local-first, single-user friendly, self-hostable.

## Features in this release

- **Today / Plan timeline** — plan the day, run focus sessions, mark work done,
  reopen or continue timing, and review a daily recap.
- **Recap & evidence** — time breakdown (today/week/month), planned-vs-actual
  execution, and priority alignment.
- **Dues** — deadlines, multi-step obligations, reminders, photos, and links.
- **Habits**, **Map** (places/visits), **Calendar**, **Year**, **Notes**
  (lists, images, reminders), and **Links**.
- **Google Calendar sync** (optional).
- **Synthetic public demo** at `/demo-app` — no backend or credentials needed.

## Privacy & security model

- Moment photos are stored in a **private** bucket; the client renders them via
  **short-lived signed URLs** (1-hour TTL). Owner-only storage RLS.
- Google Calendar OAuth `state` is **HMAC-signed** with expiry; redirect targets
  are restricted by an **origin allowlist**.
- Calendar OAuth tokens are written **only** by service-role edge functions;
  users cannot read or write another user's token row.
- Edge functions each enforce an explicit access model (user JWT, signed
  callback, or apikey + origin). See `docs/SECURITY_MODEL.md`.
- No secrets are shipped to the browser; local dev secrets live only in a
  gitignored `.env` (verified never committed).

## Self-hosting

See [`docs/oss/self-hosting.md`](./self-hosting.md). Requires Node 20, npm, a
Supabase project, and the Supabase CLI. AI features (smart-input, life-replay)
are optional.

## Migration requirements

- Apply `supabase/migrations/20260730020000_harden_storage_and_calendar_tokens.sql`.
- This makes the `moment-photos` bucket private and replaces the public read
  policy with owner-only access; the app now resolves stored paths / legacy
  public URLs to signed URLs automatically.
- User-facing insert/update/delete policies on `google_calendar_tokens` are
  removed (writes become service-role-only).

## Upgrade & rollback

- Upgrade: pull, `npm install`, apply migrations (`supabase db push`), redeploy
  edge functions.
- Rollback: see [`docs/oss/ROLLBACK_CHECKLIST.md`](./ROLLBACK_CHECKLIST.md) for
  storage, calendar-token, OAuth, and edge-function reversals.

## Known limitations

- Behavioral database/RLS verification (cross-user photo access, migration on a
  fresh + existing schema) is pending a disposable-environment run.
- No external adoption metrics are published yet (see P5).
- Lint has 0 errors but ~53 non-blocking warnings tracked for cleanup.
- Screenshots/GIF for the release must be synthetic only (no real user data).
