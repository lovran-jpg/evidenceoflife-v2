# OSS License Recommendation & Compatibility Check

- **Date:** 2026-07-28
- **Decision (owner):** **MIT** — confirmed by owner.
- **Public repository:** Yes (owner-approved). Secret scan must pass first (done — see below).

## Dependency license compatibility

Summary of `node_modules` `license` fields (production + dev):

| License | Count | Type |
| --- | --- | --- |
| MIT | 246 | permissive |
| ISC | 24 | permissive |
| BSD-2-Clause | 11 | permissive |
| Apache-2.0 | 9 | permissive |
| BSD-3-Clause | 7 | permissive |
| 0BSD | 1 | permissive |
| CC-BY-4.0 | 1 | asset/content (attribution) |
| MIT AND ISC | 1 | permissive |
| Python-2.0 | 1 | permissive |

**No copyleft licenses (GPL / AGPL / LGPL / MPL) were found.** MIT is fully
compatible with all of the above for distribution. The single `CC-BY-4.0`
entry is typically a data/asset package requiring attribution, not a code-license
conflict; verify attribution if that asset is redistributed.

## Pre-public secret scan (read-only)

- `.env` / `.env.local` / `.env.production` **never appear in git history**.
- No hardcoded JWTs (`eyJ...`), `sk-` keys, or PRIVATE KEY blocks in tracked
  non-doc files.
- The only `SERVICE_ROLE_KEY` history hit is the **environment-variable name**
  in edge-function code (`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`), not a
  secret value.

### Minor cleanup flagged for the owner (not blocking)

- `supabase/.temp/*` (project-ref, linked-project.json, etc.) is **tracked** and
  shows as modified. These contain the Supabase project reference (same public
  identifier as the browser `VITE_SUPABASE_URL`, not a secret), but local CLI
  state generally should not be committed. Consider gitignoring `supabase/.temp/`
  before going public. Full treatment is a Phase 2 item.

## Conclusion

MIT is a sound, compatible choice. The `LICENSE` file has been added with the
2026 copyright line for Cyriellewu — replace with your preferred legal name if
desired before the repo goes public.
