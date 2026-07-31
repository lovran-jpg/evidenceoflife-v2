# Codex instructions — Evidence of Life

Follow `AGENTS.md` as the source of truth. This file is the Codex-oriented entrypoint.

## Mission

Help maintain Evidence of Life (`evidenceoflife-v2`): a private life-planning + memory SPA on Vite/React/Supabase. Prefer correctness and honesty over speed.

## Before editing

1. Skim `llms.txt` (or `llms-full.txt` for deep work).
2. Confirm whether the task touches **security-sensitive** paths (migrations, RLS, auth, edge auth, OAuth). If yes, keep the PR focused and add/adjust tests.
3. State a short plan: files, approach, verification commands.

## Hard rules

- Never invent features, endpoints, or passing test results.
- Never commit secrets or `.env` values.
- After TypeScript changes: `npm run typecheck` (SWC does not type-check).
- After logic changes: `npm test`.
- UI claims: check `/demo-app` on port **8080**.
- Conventional Commits; one logical change per PR.
- Do not change database migrations or auth/storage policy in a feature PR unless that is the explicit task.

## Preferred commands

```sh
npm run typecheck && npm test
npm run dev                 # http://localhost:8080
npm run test:e2e            # when changing demo or Playwright config
npm run test:security       # when changing supabase/functions/_shared
```

## Important modules

- Auth / demo: `src/hooks/useAuth.tsx`, `src/pages/PublicDemo.tsx`
- Plan/timers: `src/hooks/useTodos.ts`, `src/components/views/PlanView.tsx`, `PlanTimelineView.tsx`
- Moments/photos: `src/hooks/useMoments.ts`, `src/lib/momentPhotos.ts`
- Edge security: `supabase/functions/_shared/auth.ts`
- Docs: `README.md`, `docs/SECURITY_MODEL.md`, `docs/oss/self-hosting.md`
