# Original project baseline — Dnevnik restorana

Verified on 2026-09-19 from upstream `Cyriellewu/evidenceoflife-v2` at `9dc54bdd4f7f4d244a397e272d537b0180ca8b41`.

This fork remains Evidence of Life v2. Place, Visit, the data model, and the original features have not been renamed or removed. The MIT license and upstream copyright are retained.

## Setup

- Fork: `lovran-jpg/evidenceoflife-v2`; production: <https://evidenceoflife-v2.vercel.app>.
- Dedicated Supabase project with all 30 upstream migrations, 15 public tables with RLS, the private `moment-photos` bucket, and all eight Edge functions deployed.
- Vercel Vite build uses the three public `VITE_SUPABASE_*` variables from `.env.example`. No service-role key is stored in this repository or passed to Vite.
- Supabase Auth Site URL and allowed callback include the production domain. Local callback URLs remain allowed. Edge `APP_URL` and `ALLOWED_REDIRECT_ORIGINS` include production and local origins.

## Necessary baseline fixes

- Removed upstream-owned, hardcoded GA and Amplitude session-replay scripts. The existing environment-controlled analytics option remains available.
- Replaced CARTO's unkeyed map tiles, which displayed `API KEY REQUIRED`, with the standard OpenStreetMap tile endpoint. Existing visible attribution remains.

## Verification

- A real account registered, confirmed its email, and signed in locally and on production. Production session showed the same data.
- One test moment with a location and photo created one Place, one Visit, and one private storage object. Places and Calendar displayed the record after reload and in production; the Place thumbnail and map tiles loaded.
- A rolled-back two-user database check confirmed personal city, place, moment, and visit reads are isolated; foreign Visit update and Place delete were blocked; forged ownership was rejected. A separate storage RLS check confirmed a foreign user cannot list the photo object.
- Typecheck, production build, 24 Vitest files / 186 tests, two existing demo Playwright tests, and 12 existing Deno auth tests passed. Lint had zero errors and 53 existing warnings.

## Known limits kept for later work

- Some UI labels currently appear in Chinese. Localization was not changed in this baseline.
- A Place summary counts the one test photo twice because the same photo appears on both the Moment and Visit paths. The database holds one photo object; the Visit shows one photo. No data was duplicated.
- Google sign-in / Calendar OAuth and optional AI functions require operator-supplied credentials and were not exercised. The built-in Calendar view was verified. No claim is made for those optional integrations or for full API-level Storage deletion isolation.

Keep `.env.local` and server secrets out of Git. See `.env.example` and `docs/oss/self-hosting.md` for configuration details.
