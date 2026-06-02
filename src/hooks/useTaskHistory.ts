import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TaskHistoryEntry {
  /** The most recently used spelling of this task title. */
  title: string;
  /** How many times a task with this (normalized) title was created. */
  count: number;
  /** ISO timestamp of the most recent use. */
  lastUsed: string;
}

function normalize(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Loads the user's recent task titles (across all days), de-duplicated and
 * ranked. Powers input autocomplete now, and is the raw material for grouping
 * recurring tasks into a single "thread" later.
 */
export function useTaskHistory() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TaskHistoryEntry[]>([]);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      return;
    }
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('todos')
        .select('title, created_at')
        .order('created_at', { ascending: false })
        .limit(400);

      if (cancelled || error || !data) return;

      const byKey = new Map<string, TaskHistoryEntry>();
      for (const row of data as { title: string; created_at: string }[]) {
        const title = (row.title || '').trim();
        if (!title) continue;
        const key = normalize(title);
        const existing = byKey.get(key);
        if (existing) {
          existing.count += 1;
          // rows arrive newest-first, so keep the first-seen title/lastUsed
        } else {
          byKey.set(key, { title, count: 1, lastUsed: row.created_at });
        }
      }

      setEntries(Array.from(byKey.values()));
    })();

    return () => { cancelled = true; };
  }, [user]);

  return entries;
}

/**
 * Returns up to `limit` past task titles that match the current draft, ranked by
 * relevance (prefix > word-prefix > substring) then by how often they recur.
 * An exact match is excluded so we never suggest what the user already typed.
 */
export function useTaskSuggestions(
  history: TaskHistoryEntry[],
  draft: string,
  limit = 4,
): TaskHistoryEntry[] {
  return useMemo(() => {
    const q = normalize(draft);
    if (q.length < 2) return [];

    const scored: { entry: TaskHistoryEntry; score: number }[] = [];
    for (const entry of history) {
      const key = normalize(entry.title);
      if (key === q) continue; // already typed exactly
      let score = 0;
      if (key.startsWith(q)) score = 3;
      else if (key.split(' ').some(word => word.startsWith(q))) score = 2;
      else if (key.includes(q)) score = 1;
      if (score === 0) continue;
      // tie-break with recurrence frequency (capped so it never beats a better match)
      score += Math.min(entry.count, 5) / 10;
      scored.push({ entry, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.entry);
  }, [history, draft, limit]);
}
