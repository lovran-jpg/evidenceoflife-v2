# Roadmap

> Direction, not promises. This is a spare-time, single-maintainer project;
> priorities shift with real usage. No dates are committed.

## Now (stability & openness)

- Complete the OSS foundation (license, governance docs, templates) — in progress.
- Phase 2 security/privacy audit: verify ownership-based RLS on all personal
  tables, storage-bucket visibility, and Google Calendar token handling.
- CI: lint + typecheck + test + build on every PR.

## Next (correctness & trust)

- Reproducible, privacy-safe aggregate usage metrics across the old and new
  Supabase projects (no double counting).
- Regression coverage for core flows: task lifecycle, focus sessions,
  interrupted/unfinished work, timezone/date rollover, calendar sync boundaries.
- Account data export + deletion completeness.

## Later (contributor experience)

- A small set of genuine "good first issue" items from validated backlog.
- Self-hosting guide verified end-to-end by someone other than the maintainer.
- First tagged release with accurate release notes.

## Explicit non-goals

- No medical/therapeutic claims. Positioning is design goals for ADHD-friendly
  execution, not treatment.
- No growth-hacking, fake activity, or vanity metrics.
