# Roadmap

> Direction, not promises. This is a spare-time, single-maintainer project;
> priorities shift with real usage. No dates are committed.

## Now (stability & openness)

- Complete the OSS foundation (license, governance docs, templates) — largely done.
- Apply pre-public hardening migration (private photos, calendar token policies)
  and redeploy edge functions with auth helpers.
- Enable GitHub Private Vulnerability Reporting in repo Settings → Security.
- Phase 2 security/privacy audit: verify ownership-based RLS on all personal
  tables against the **live** database (migrations alone are not enough).
- CI: lint remains advisory until the remaining eslint debt is cleared.

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

## Product direction (exploratory)

Ideas that extend the core list → timeline → actual → map → recap model. These are
directions, not commitments, and each is a personal reflection aid rather than a
validated health measurement.

- **Plan-versus-actual overlay** — a side-by-side or layered timeline that makes the
  gap between intention and reality immediately visible.
- **Contextual day replay** — reconstruct a day from calendar, focus sessions,
  moments, photos, and places, with clear source indicators.
- **Place patterns** — surface focus, routines, and repeated memories by location so
  the map is analytically useful rather than decorative.
- **Short-window planning** — filters and suggestions for 5-, 15-, and 30-minute
  openings to support fragmented time and task initiation.
- **Time-estimation reflection** — planned versus actual duration over time, framed
  as a personal pattern, not a score.

