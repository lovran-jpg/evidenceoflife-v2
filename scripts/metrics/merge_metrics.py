#!/usr/bin/env python3
"""
Merge Evidence of Life usage metrics from the OLD and NEW Supabase projects.

Read-only, offline. This does NOT touch any database. You paste in the aggregate
result rows produced by `new_project_metrics.sql` and `old_project_metrics.sql`,
plus (optionally) the salted email-hash lists for user de-duplication.

Rules (see docs/metrics/metric-definitions.md):
  - USER metrics (registered / active / returning) are a UNION across projects.
    If the same person exists in both, they count ONCE. De-dup needs the salted
    email_hash lists (same salt on both projects). Without them, user totals are
    reported as a RANGE: max(project) .. sum(projects), because the true overlap
    is unknown.
  - EVENT metrics (tasks, moments, focus_minutes, ...) are additive SUMs, because
    each event row is distinct across projects.

Nothing here fabricates a number. If an input is missing, the output says
UNKNOWN rather than guessing.

Usage:
  python merge_metrics.py --old old.json --new new.json \
      [--old-hashes old_hashes.txt] [--new-hashes new_hashes.txt]

Where old.json / new.json are the single result rows from the SQL, e.g.:
  { "registered_users": 12, "active_users_30d": 5, "returning_users": 7,
    "tasks_created": 900, "moments_captured": 400 }
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


USER_METRICS = {"registered_users", "active_users_30d", "returning_users", "signed_in_30d"}


def load_json(path: str | None) -> dict:
    if not path:
        return {}
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_hashes(path: str | None) -> set[str] | None:
    if not path:
        return None
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    return {ln.strip() for ln in lines if ln.strip()}


def merge_users(old: dict, new: dict, key: str,
                old_h: set[str] | None, new_h: set[str] | None) -> object:
    o = old.get(key)
    n = new.get(key)
    if o is None and n is None:
        return "UNKNOWN"
    o = o or 0
    n = n or 0
    # Only registered_users can be exactly de-duped via the identity hashes.
    if key == "registered_users" and old_h is not None and new_h is not None:
        return len(old_h | new_h)
    # Otherwise report a defensible range: at least the larger project, at most
    # the sum (true value depends on unknown overlap).
    lo, hi = max(o, n), o + n
    return f"{lo}..{hi} (overlap unknown)" if lo != hi else lo


def merge(old: dict, new: dict,
          old_h: set[str] | None, new_h: set[str] | None) -> dict:
    keys = sorted(set(old) | set(new))
    out: dict[str, object] = {}
    for k in keys:
        if k in ("computed_at",):
            continue
        if k in USER_METRICS:
            out[k] = merge_users(old, new, k, old_h, new_h)
        else:
            o, n = old.get(k), new.get(k)
            out[k] = (o or 0) + (n or 0) if (o is not None or n is not None) else "UNKNOWN"
    out["_dedup_method"] = (
        "email_hash union" if (old_h is not None and new_h is not None)
        else "NONE — user totals are ranges (provide --old-hashes/--new-hashes to dedupe)"
    )
    return out


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--old", help="old_project_metrics.sql result as JSON")
    ap.add_argument("--new", required=True, help="new_project_metrics.sql result as JSON")
    ap.add_argument("--old-hashes", help="salted email_hash list from OLD project")
    ap.add_argument("--new-hashes", help="salted email_hash list from NEW project")
    args = ap.parse_args(argv)

    old = load_json(args.old)
    new = load_json(args.new)
    old_h = load_hashes(args.old_hashes)
    new_h = load_hashes(args.new_hashes)

    result = merge(old, new, old_h, new_h)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
