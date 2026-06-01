import { useMemo, useState } from 'react';
import { CalendarRange, Flame, Sparkles, Camera, MapPin, Star } from 'lucide-react';
import type { Moment } from '@/types';
import { useLanguage } from '@/hooks/useLanguage';
import { buildHorizonDigest, type MemoryHorizon } from '@/lib/memoryHorizons';

interface MemoryHorizonsCardProps {
  // Full moment history across all dates.
  moments: Moment[];
  // Any day within the period to summarize.
  selectedDate: Date;
}

const HORIZONS: { id: MemoryHorizon; labelKey: string }[] = [
  { id: 'week', labelKey: 'horizon.week' },
  { id: 'month', labelKey: 'horizon.month' },
  { id: 'year', labelKey: 'horizon.year' },
];

function formatRange(startKey: string, endKey: string, horizon: MemoryHorizon, lang: string): string {
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
  const parse = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  if (horizon === 'year') {
    return String(parse(startKey).getFullYear());
  }
  if (horizon === 'month') {
    return parse(startKey).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }
  const fmt = (key: string) => parse(key).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  return `${fmt(startKey)} – ${fmt(endKey)}`;
}

// "Revisit" — the zoom-out half of the daily loop. The same lived evidence,
// viewed at three layers of memory (week / month / year) behind one segmented
// control, so the deeper horizons stay progressively disclosed instead of
// crowding the day. No streaks, no scores — just accumulation made visible.
export function MemoryHorizonsCard({ moments, selectedDate }: MemoryHorizonsCardProps) {
  const { t, lang } = useLanguage();
  const [horizon, setHorizon] = useState<MemoryHorizon>('week');

  const digest = useMemo(
    () => buildHorizonDigest(moments, selectedDate, horizon),
    [moments, selectedDate, horizon],
  );

  const tiles = [
    { icon: CalendarRange, value: digest.activeDays, labelKey: 'horizon.activeDays' },
    digest.focusMinutes > 0 && { icon: Flame, value: digest.focusMinutes, labelKey: 'horizon.focusMin' },
    { icon: Sparkles, value: digest.moments, labelKey: 'horizon.moments' },
    digest.photos > 0 && { icon: Camera, value: digest.photos, labelKey: 'horizon.photos' },
    digest.places > 0 && { icon: MapPin, value: digest.places, labelKey: 'horizon.places' },
    digest.special > 0 && { icon: Star, value: digest.special, labelKey: 'horizon.special' },
  ].filter(Boolean) as { icon: typeof Flame; value: number; labelKey: string }[];

  return (
    <div className="rounded-2xl border border-[#d9e4dd]/70 bg-gradient-to-b from-[#f3f8f4] to-[#eaf2ec] p-4 shadow-[0_8px_24px_rgba(74,102,86,0.06)] dark:border-foreground/[0.12] dark:from-foreground/[0.05] dark:to-foreground/[0.02]">
      <div className="flex items-center gap-2">
        <span className="text-lg">📒</span>
        <h3 className="text-sm font-semibold text-[#3f5a4b] dark:text-foreground/85">{t('horizon.title')}</h3>
        <span className="ml-auto text-[11px] font-medium text-[#7d9387] dark:text-foreground/45">
          {formatRange(digest.startKey, digest.endKey, horizon, lang)}
        </span>
      </div>

      {/* Segmented control — progressive disclosure across the three layers. */}
      <div className="mt-3 flex rounded-full border border-[#dce8e0]/80 bg-white/55 p-0.5 dark:border-foreground/[0.1] dark:bg-foreground/[0.04]">
        {HORIZONS.map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
            onClick={() => setHorizon(id)}
            className={`flex-1 rounded-full py-1.5 text-[12px] font-semibold transition-colors ${
              horizon === id
                ? 'bg-[#6e9580] text-white shadow-sm dark:bg-foreground/80 dark:text-background'
                : 'text-[#7d9387] hover:text-[#3f5a4b] dark:text-foreground/55 dark:hover:text-foreground/85'
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {digest.moments === 0 ? (
        <p className="mt-4 text-center text-[12px] text-[#7d9387] dark:text-foreground/45">{t('horizon.empty')}</p>
      ) : (
        <>
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
                {t('horizon.keptLabel')}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {digest.kept.slice(-3).map(({ dateStr, text }) => (
                  <li
                    key={dateStr + text.slice(0, 8)}
                    className="flex gap-2 text-[13px] leading-6 text-[#3f5a4b] dark:text-foreground/85"
                  >
                    <span className="flex-shrink-0">💛</span>
                    <span className="line-clamp-2">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
