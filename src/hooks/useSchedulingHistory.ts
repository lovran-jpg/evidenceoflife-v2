import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { DurationHistoryRow } from '@/lib/autoSchedule';
import {
  buildSchedulingProfile,
  type HistoryEvent,
  type SchedulingProfile,
} from '@/lib/schedulingProfile';

export interface SchedulingHistory {
  /** Past durations for median estimation (title + tag + real tracked seconds). */
  durations: DurationHistoryRow[];
  /** Learned time-of-day preference per work type. */
  profile: SchedulingProfile;
}

const EMPTY: SchedulingHistory = {
  durations: [],
  profile: { preferredSegmentByWorkType: {}, sampleCount: 0 },
};

/**
 * Loads the raw material the auto-scheduler learns from: recent todos with their
 * tags, real tracked duration, and the local hour they were actually worked on.
 * Derives a scheduling profile once per load. Read-only; no schema, no writes.
 */
export function useSchedulingHistory(): SchedulingHistory {
  const { user } = useAuth();
  const [history, setHistory] = useState<SchedulingHistory>(EMPTY);

  useEffect(() => {
    if (!user) {
      setHistory(EMPTY);
      return;
    }
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('todos')
        .select('title, tags, timer_seconds, timer_started_at')
        .order('created_at', { ascending: false })
        .limit(400);

      if (cancelled || error || !data) return;

      const rows = data as {
        title: string | null;
        tags: string[] | null;
        timer_seconds: number | null;
        timer_started_at: string | null;
      }[];

      const durations: DurationHistoryRow[] = [];
      const events: HistoryEvent[] = [];

      for (const row of rows) {
        const title = (row.title || '').trim();
        if (!title) continue;
        durations.push({ title, tags: row.tags, timer_seconds: row.timer_seconds });

        let startedHour: number | null = null;
        if (row.timer_started_at) {
          const d = new Date(row.timer_started_at);
          if (!Number.isNaN(d.getTime())) startedHour = d.getHours(); // local hour
        }
        events.push({ title, tags: row.tags, startedHour });
      }

      if (!cancelled) {
        setHistory({ durations, profile: buildSchedulingProfile(events) });
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  return history;
}
