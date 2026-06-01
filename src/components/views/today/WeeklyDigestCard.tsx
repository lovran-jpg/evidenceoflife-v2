import { useMemo } from 'react';
import { CalendarRange, Flame, Sparkles, Camera, MapPin } from 'lucide-react';
import type { Moment } from '@/types';
import { useLanguage } from '@/hooks/useLanguage';

interface WeeklyDigestCardProps {
  // Full moment history across all dates.
  moments: Moment[];
  // Any day within the week to summarize.
  selectedDate: Date;
}

export interface WeeklyDigest {
  weekStartKey: string;
  weekEndKey: string;
  activeDays: number;
  focusMinutes: number;
  moments: number;
  photos: number;
  places: number;
  // Kept reflections this week — the "small wins" narrative (Progress Principle).
  kept: { dateStr: string; text: string }[];
}

function ymdKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Monday-based week start for the given date.
function startOfIsoWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

// Aggregate the week containing selectedDate into a single digest. Pure so it
// can be unit-tested independently of rendering.
export function buildWeeklyDigest(moments: Moment[], selectedDate: Date): WeeklyDigest {
  const start = startOfIsoWeek(selectedDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const weekStartKey = ymdKey(start);
  const weekEndKey = ymdKey(end);

  const activeDaySet = new Set<string>();
  let focusSeconds = 0;
  let momentCount = 0;
  let photos = 0;
  const places = new Set<string>();
  const kept: { dateStr: string; text: string }[] = [];

  for (const m of moments) {
    if (m.date < weekStartKey || m.date > weekEndKey) continue;
    activeDaySet.add(m.date);
    momentCount += 1;
    if (m.timer_seconds && m.timer_seconds > 0) focusSeconds += m.timer_seconds;
    if (m.photos?.length) photos += m.photos.length;
    if (m.location?.name) places.add(m.location.name);
    if (m.tags?.includes('daily-reflection') && m.text?.trim()) {
      kept.push({ dateStr: m.date, text: m.text.trim() });
    }
  }

  kept.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  return {
    weekStartKey,
    weekEndKey,
    activeDays: activeDaySet.size,
    focusMinutes: Math.round(focusSeconds / 60),
    moments: momentCount,
    photos,
    places: places.size,
    kept,
  };
}

function formatRange(startKey: string, endKey: string, lang: string): string {
  const fmt = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
  };
  return `${fmt(startKey)} – ${fmt(endKey)}`;
}

// "Weekly Evidence Digest" — zooms the daily loop out to a week, surfacing the
// accumulation of small wins (Progress Principle) without any pressure to streak.
export function WeeklyDigestCard({ moments, selectedDate }: WeeklyDigestCardProps) {
  const { t, lang } = useLanguage();

  const digest = useMemo(() => buildWeeklyDigest(moments, selectedDate), [moments, selectedDate]);

  // Nothing happened this week yet — stay quiet (private, low-noise).
  if (digest.moments === 0) return null;

  const tiles = [
    { icon: CalendarRange, value: digest.activeDays, labelKey: 'weekly.activeDays' },
    digest.focusMinutes > 0 && { icon: Flame, value: digest.focusMinutes, labelKey: 'weekly.focusMin' },
    { icon: Sparkles, value: digest.moments, labelKey: 'weekly.moments' },
    digest.photos > 0 && { icon: Camera, value: digest.photos, labelKey: 'weekly.photos' },
    digest.places > 0 && { icon: MapPin, value: digest.places, labelKey: 'weekly.places' },
  ].filter(Boolean) as { icon: typeof Flame; value: number; labelKey: string }[];

  return (
    <div className="rounded-2xl border border-[#d9e4dd]/70 bg-gradient-to-b from-[#f3f8f4] to-[#eaf2ec] p-4 shadow-[0_8px_24px_rgba(74,102,86,0.06)] dark:border-foreground/[0.12] dark:from-foreground/[0.05] dark:to-foreground/[0.02]">
      <div className="flex items-center gap-2">
        <span className="text-lg">📒</span>
        <h3 className="text-sm font-semibold text-[#3f5a4b] dark:text-foreground/85">{t('weekly.title')}</h3>
        <span className="ml-auto text-[11px] font-medium text-[#7d9387] dark:text-foreground/45">
          {formatRange(digest.weekStartKey, digest.weekEndKey, lang)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {tiles.map(({ icon: Icon, value, labelKey }) => (
          <div
            key={labelKey}
            className="flex flex-col items-center justify-center rounded-xl border border-[#dce8e0]/70 bg-white/60 py-2.5 dark:border-foreground/[0.1] dark:bg-foreground/[0.04]"
          >
            <Icon size={15} className="text-[#6e9580] dark:text-foreground/55" />
            <span className="mt-1 text-base font-semibold tabular-nums text-[#3f5a4b] dark:text-foreground/90">{value}</span>
            <span className="text-[10px] leading-tight text-[#7d9387] dark:text-foreground/50">{t(labelKey)}</span>
          </div>
        ))}
      </div>

      {digest.kept.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#7d9387] dark:text-foreground/45">
            {t('weekly.kept')}
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {digest.kept.slice(-3).map(({ dateStr, text }) => (
              <li
                key={dateStr}
                className="flex gap-2 text-[13px] leading-6 text-[#3f5a4b] dark:text-foreground/85"
              >
                <span className="flex-shrink-0">💛</span>
                <span className="line-clamp-2">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
