# Release Checklist

> No release or tag is created without explicit maintainer approval. This is a
> checklist to run at that time, not an instruction to release automatically.

## Pre-release

- [ ] Working tree is intentional (no accidental WIP); changes committed on `main`.
- [ ] `npx tsc --noEmit -p tsconfig.app.json` passes.
- [ ] `npm test` passes; note the count.
- [ ] `npm run lint` passes.
- [ ] `npm run build` succeeds.
- [ ] Secret scan clean (no keys/tokens in tree or history).
- [ ] Phase 2 security audit findings are resolved, accepted, or disclosed.

## Versioning

- Follow SemVer: MAJOR (breaking), MINOR (features), PATCH (fixes).
- Pre-1.0 is acceptable while the schema/API is still moving.

## Database / migrations

- [ ] List any new `supabase/migrations/*` required by this release.
- [ ] Document apply order and whether the migration is backward compatible.
- [ ] Provide a rollback note for each migration.

## Release notes

- [ ] Summarize actual merged changes (no fabricated features or metrics).
- [ ] Call out breaking changes and required migrations explicitly.
- [ ] Link notable PRs/issues.

## Tag & publish (requires approval)

- [ ] Create the tag only after approval.
- [ ] Update `CHANGELOG.md` `[Unreleased]` → the new version.
- [ ] Deploy frontend and deploy edge functions (`supabase functions deploy`)
      only after separate deployment approval.

## Post-release

- [ ] Verify the deployed app loads and core flows work.
- [ ] Monitor for regressions; keep a rollback path ready.
