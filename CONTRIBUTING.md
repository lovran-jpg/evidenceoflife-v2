# Contributing to Evidence of Life

Thanks for your interest. Evidence of Life is an open-source, ADHD-friendly
personal execution app. It is maintained by a single person, so please keep
contributions focused and self-contained.

## Ground rules

- Be respectful — see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- One logical change per pull request.
- Never commit secrets. Only `.env.example` is tracked; real `.env*` files are
  gitignored. Never paste Supabase service-role keys or OAuth tokens anywhere.
- No fabricated data, fake accounts, or activity padding.

## Local setup

Requires Node.js 18+ and npm.

```sh
npm install
cp .env.example .env   # fill in your own Supabase project values
npm run dev            # http://localhost:8080
```

The app needs a Supabase project (Postgres + Auth + Storage). Apply the SQL in
`supabase/migrations/` to a fresh project, and set the `VITE_SUPABASE_*` values
in `.env`. Only the **publishable** (anon) key belongs in the browser.

## Before you open a PR

Run all three and make sure they pass:

```sh
npx tsc --noEmit -p tsconfig.app.json   # types (SWC does not type-check)
npm test                                # vitest — currently 176 tests
npm run lint                            # eslint
```

- Add or update tests for logic changes (pure helpers live in `src/lib`, tests
  in `src/test`).
- Keep diffs free of unrelated formatting churn.
- Do not upgrade dependencies without a stated reason.
- Do not change database migrations, RLS, auth, or storage policies in a feature
  PR — those are reviewed separately.

## Design conventions

- Styling is driven by HSL CSS variables in `src/index.css` +
  `src/styles/tokens.css`. Do not hardcode hex when a token exists.
- Dark mode is the primary surface and gets the most scrutiny.
- Respect `prefers-reduced-motion`; keyboard focus and contrast (WCAG AA) matter.

## Scope & expectations

This is a personal project maintained in spare time. Reviews and releases happen
on a best-effort basis — there is no guaranteed response time. Large or
architectural changes should start as an issue for discussion before coding.
