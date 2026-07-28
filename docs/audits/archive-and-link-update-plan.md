# Archive & Link-Update Plan (PROPOSAL — not executed)

- **Date:** 2026-07-28
- **Status:** DRAFT — requires explicit human approval before any action.
- **Scope:** Plan only. Phase 0 performed **no** archive, rename, redirect, or
  link edit. Making a repo public/archived is in `require_human_approval_before`.

## 1. Preconditions before ANY archive/redirect action

- [ ] Owner confirms the canonical repo (done in `canonical-repository-decision.md`).
- [ ] Owner provides the URL of any legacy/duplicate Evidence of Life repo
      (none is referenced by the current clone's remotes).
- [ ] Git-history secret scan passes on the canonical repo (Phase 2) before it
      is considered for public visibility.
- [ ] A rollback note exists (archiving is reversible on GitHub; renaming leaves
      a redirect but can break hardcoded links).

## 2. Legacy repository handling (only if a legacy repo is provided)

For each legacy repo the owner names:
1. Add a prominent README banner: "Moved to `evidenceoflife-v2`" with a link.
2. Optionally archive (read-only) **after** confirming no unique unmerged work.
3. Do **not** delete — preserve history and inbound links.

## 3. External links that should eventually point to v2

Populate once the owner shares where the project is currently referenced. Candidate surfaces:

| Surface | Action | Owner-provided? |
| --- | --- | --- |
| Deployed app footer / about | Point "source" link to canonical repo | pending |
| Personal site / portfolio | Update repo link | pending |
| Any prior README badges | Update to v2 | pending |
| Package/deploy configs | Verify repo URL fields | pending |

## 4. Rollback

- Archiving: un-archive in GitHub settings (fully reversible).
- Renaming: avoid; if done, keep the GitHub-provided redirect and update all
  hardcoded links in the same change.

## 5. Approval checkpoint

No item in sections 2–3 executes until the owner explicitly approves, per the
global policy (`require_human_approval_before`).
