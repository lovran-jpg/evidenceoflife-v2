# Canonical Repository Decision

- **Date:** 2026-07-28
- **Phase:** 0 (Discovery)
- **Decision:** `github.com/Cyriellewu/evidenceoflife-v2` is the **canonical** Evidence of Life v2 repository.
- **Confidence:** HIGH (from direct git evidence).
- **Reversible:** Yes — this is a documentation decision only; no repository was renamed, archived, deleted, or made public.

## Evidence

1. **Only configured remote** in the live working clone:
   `git@github.com:Cyriellewu/evidenceoflife-v2.git` (fetch + push).
2. **Owner match:** `Cyriellewu` equals the spec's `project.owner`.
3. **Name match:** `evidenceoflife-v2` equals the product "Evidence of Life v2".
4. **Active development:** recent commits on `main`/feature branches through the
   current HEAD `07a6a67`; HEAD is level with `origin/main`.
5. **Current product code** (Vite/React/Supabase app described in the audit) lives
   in this repository, matching the deployed product's feature set.

## Branches

- **Base / production:** `main` (`origin/HEAD -> origin/main`).
- Feature branches: `design-taste-fixes` (current), `report-restructure`, `ui-rework`.

## Open items requiring the owner

- **No local reference to any legacy "v1" repository.** If an older Evidence of
  Life repository exists on GitHub, provide its URL so the
  `archive-and-link-update-plan.md` can enumerate redirects. Until then, the plan
  documents the *process* without touching any external repo.
- **Production hosting** is inferred as Vercel from `vercel.json`; confirm.

## What was explicitly NOT done (safety)

- No archive, rename, delete, or visibility change of any repository.
- No branch switch, commit, push, or force-push.
- No external write of any kind.
