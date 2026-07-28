# Privacy Notes

> This document describes how the Evidence of Life codebase handles personal
> data, for transparency and self-hosting. It is not a legal privacy policy for
> any specific hosted deployment. Operators of a hosted instance are responsible
> for their own privacy disclosures.

## What data the app stores

Evidence of Life is a personal life-logging app. A user's own account may store:

- **Moments** — text, timestamps, optional photos, optional location
  coordinates, tags, and mood.
- **Tasks / plans / dues / habits** — titles, notes, schedule and timer data,
  completion and streak state.
- **Sticky notes & links** — short lists and saved URLs with preview metadata.
- **Places** — visited locations derived from moment coordinates.
- **Google Calendar data** — imported events, when the user connects Calendar.
- **Profile & settings** — display preferences and appearance options.

## Where data lives

- Stored in the operator's **Supabase** project (Postgres + Storage).
- Photos are stored in Supabase Storage buckets.
- The browser client uses only the Supabase **publishable (anon)** key.

## Access model

- Personal tables are intended to be protected by ownership-based **Row Level
  Security (RLS)** so a user can only read/write their own rows.
  (A full RLS verification is tracked as a Phase 2 security audit item.)
- Service-role access is confined to server-side Supabase **edge functions**.

## Third-party processing

- **Google Calendar**: OAuth is used to import events. Tokens are handled by the
  `google-calendar-*` edge functions server-side.
- **Smart input / geo / link preview**: edge functions may call external
  services to classify text, resolve locations, or fetch link previews. Avoid
  sending sensitive content you do not want processed by those services.

## Export & deletion

- The app includes evidence export functionality (`src/lib/exportEvidence.ts`).
- Account deletion / full data export completeness is tracked as a Phase 2 audit
  item to confirm all tables and storage objects are covered.

## Data minimization guidance for operators

- Do not create public screenshots or demos from real user data; use the
  synthetic demo data.
- Aggregate analytics must not expose individual names, emails, task/note text,
  photos, coordinates, or calendar contents.
