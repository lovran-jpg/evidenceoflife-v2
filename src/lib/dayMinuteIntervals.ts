/**
 * Wall-clock minute intervals within a calendar day (0–1440+).
 * Used so overlapping todos / timers are not double-counted in charts and summaries.
 */

export type MinuteInterval = { startMin: number; endMin: number };

export type TaggedMinuteSlot = MinuteInterval & { tag: string };

function clampOverlap(start: number, end: number, winStart: number, winEnd: number): number {
  const a = Math.max(start, winStart);
  const b = Math.min(end, winEnd);
  return Math.max(0, b - a);
}

/** Merge closed intervals after clipping into [winStart, winEnd) and return total length in minutes */
export function unionMinutesInWindow(
  intervals: ReadonlyArray<MinuteInterval>,
  winStart: number,
  winEnd: number,
): number {
  type Piece = [number, number];
  const pieces: Piece[] = [];
  for (const s of intervals) {
    if (clampOverlap(s.startMin, s.endMin, winStart, winEnd) <= 0) continue;
    const a = Math.max(s.startMin, winStart);
    const b = Math.min(s.endMin, winEnd);
    pieces.push([a, b]);
  }
  if (pieces.length === 0) return 0;
  pieces.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let sum = 0;
  let cs = pieces[0][0];
  let ce = pieces[0][1];
  for (let i = 1; i < pieces.length; i++) {
    const [a, b] = pieces[i];
    if (a <= ce) ce = Math.max(ce, b);
    else {
      sum += ce - cs;
      cs = a;
      ce = b;
    }
  }
  sum += ce - cs;
  return sum;
}

type ClippedTagged = MinuteInterval & { tag: string; ord: number };

/**
 * Partition the union of tagged slots inside [winStart, winEnd): each minute belongs to
 * exactly one tag. When several tags overlap, the clip with the earliest startMin wins;
 * ties broken by shorter span, then stable insertion order.
 */
export function partitionUnionMinutesByTag(
  slots: ReadonlyArray<TaggedMinuteSlot>,
  winStart: number,
  winEnd: number,
): { tag: string; minutes: number }[] {
  const clips: ClippedTagged[] = [];
  let ord = 0;
  for (const s of slots) {
    if (clampOverlap(s.startMin, s.endMin, winStart, winEnd) <= 0) continue;
    const startMin = Math.max(s.startMin, winStart);
    const endMin = Math.min(s.endMin, winEnd);
    const tag = ((s.tag || '—').trim() || '—').toLowerCase();
    clips.push({ startMin, endMin, tag, ord: ord++ });
  }
  if (clips.length === 0) return [];

  const points = new Set<number>();
  for (const c of clips) {
    points.add(c.startMin);
    points.add(c.endMin);
  }
  const sortedPts = [...points].filter(p => p >= winStart && p <= winEnd).sort((a, b) => a - b);

  const byTag = new Map<string, number>();
  for (let k = 0; k < sortedPts.length - 1; k++) {
    const t0 = sortedPts[k];
    const t1 = sortedPts[k + 1];
    if (t1 <= t0) continue;
    const active = clips.filter(c => c.startMin < t1 && c.endMin > t0);
    if (!active.length) continue;
    active.sort(
      (x, y) =>
        x.startMin - y.startMin ||
        x.endMin - y.endMin ||
        x.ord - y.ord,
    );
    const w = active[0];
    const len = t1 - t0;
    byTag.set(w.tag, (byTag.get(w.tag) || 0) + len);
  }

  return [...byTag.entries()]
    .map(([tag, minutes]) => ({ tag, minutes }))
    .filter(x => x.minutes > 1e-6)
    .sort((a, b) => b.minutes - a.minutes);
}
