import { useMemo, useState } from 'react';
import { CheckCircle2, Timer, Camera, MapPin, Link2, Sparkles } from 'lucide-react';
import type { Moment } from '@/types';
import { useLanguage } from '@/hooks/useLanguage';
interface EvidenceReviewCardProps {
  moments: Moment[];
  todosDone?: number;
  todosTotal?: number;
  // Existing reflection moment for the day, if the user already answered.
  reflection?: Moment | null;
  onSaveReflection: (text: string) => void;
}

// "End-of-day Evidence Review" — the payoff surface of the daily loop. It
// answers "what did this day become?" by aggregating the evidence already
// captured, then invites one reflective line: "what made today worth keeping?".
export function EvidenceReviewCard({ moments, todosDone, todosTotal, reflection, onSaveReflection }: EvidenceReviewCardProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState('');
  const [celebrating, setCelebrating] = useState(false);

  const stats = useMemo(() => {
    let focusSeconds = 0;
    let photos = 0;
    let links = 0;
    const places = new Set<string>();
    for (const m of moments) {
      if (m.timer_seconds && m.timer_seconds > 0) focusSeconds += m.timer_seconds;
      if (m.photos?.length) photos += m.photos.length;
      if (m.links?.length) links += m.links.length;
      if (m.location?.name) places.add(m.location.name);
    }
    return {
      focusMinutes: Math.round(focusSeconds / 60),
      moments: moments.length,
      photos,
      links,
      places: places.size,
    };
  }, [moments]);

  const tiles = useMemo(() => {
    const list: { icon: typeof Timer; value: number; labelKey: string }[] = [];
    if (todosTotal != null && todosTotal > 0) {
      list.push({ icon: CheckCircle2, value: todosDone ?? 0, labelKey: 'review.tasksDone' });
    }
    if (stats.focusMinutes > 0) list.push({ icon: Timer, value: stats.focusMinutes, labelKey: 'review.focusMin' });
    if (stats.moments > 0) list.push({ icon: Sparkles, value: stats.moments, labelKey: 'review.moments' });
    if (stats.photos > 0) list.push({ icon: Camera, value: stats.photos, labelKey: 'review.photos' });
    if (stats.places > 0) list.push({ icon: MapPin, value: stats.places, labelKey: 'review.places' });
    if (stats.links > 0) list.push({ icon: Link2, value: stats.links, labelKey: 'review.links' });
    return list;
  }, [stats, todosDone, todosTotal]);

  // Nothing happened yet — don't show an empty trophy.
  const hasEvidence = tiles.length > 0;

  const handleSave = () => {
    const text = draft.trim();
    if (!text) return;
    onSaveReflection(text);
    setDraft('');
    // Gentle celebration — wiring the habit with a calm moment of payoff.
    setCelebrating(true);
    window.setTimeout(() => setCelebrating(false), 1400);
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[#e7d9cc]/70 bg-gradient-to-b from-[#fdf8f2] to-[#f9f1e8] p-4 shadow-[0_8px_24px_rgba(110,92,76,0.06)] dark:border-foreground/[0.12] dark:from-foreground/[0.05] dark:to-foreground/[0.02] ${celebrating ? 'animate-keep-glow' : ''}`}>
      {celebrating && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center gap-3" aria-hidden>
          {['💛', '✨', '💛'].map((c, i) => (
            <span
              key={i}
              className="animate-keep-rise text-lg"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              {c}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-lg">{hasEvidence ? '🌙' : '✨'}</span>
        <h3 className="text-sm font-semibold text-[#6b5544] dark:text-foreground/85">{t('review.title')}</h3>
      </div>

      {hasEvidence ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {tiles.map(({ icon: Icon, value, labelKey }) => (
            <div
              key={labelKey}
              className="flex flex-col items-center justify-center rounded-xl border border-[#ece0d4]/70 bg-white/60 py-2.5 dark:border-foreground/[0.1] dark:bg-foreground/[0.04]"
            >
              <Icon size={15} className="text-[#b08968] dark:text-foreground/55" />
              <span className="mt-1 text-base font-semibold tabular-nums text-[#5d493d] dark:text-foreground/90">{value}</span>
              <span className="text-[10px] leading-tight text-[#9a8473] dark:text-foreground/50">{t(labelKey)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[13px] leading-6 text-[#9a8473] dark:text-foreground/55">{t('review.empty')}</p>
      )}

      <p className="mt-4 text-[13px] font-medium text-[#6b5544] dark:text-foreground/80">{t('review.question')}</p>
      {reflection?.text ? (
        <div className="mt-2 rounded-xl border border-[#ecdfd2]/70 bg-white/70 px-3 py-2.5 text-[13px] leading-6 text-[#5d493d] dark:border-foreground/[0.1] dark:bg-foreground/[0.04] dark:text-foreground/85">
          <span className="mr-1">💛</span>
          {reflection.text}
        </div>
      ) : (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('review.placeholder')}
            rows={2}
            className="w-full resize-none rounded-xl border border-[#e7d9cc]/80 bg-white/70 px-3 py-2.5 text-[13px] leading-6 text-[#5d493d] outline-none transition-colors placeholder:text-[#bcaa9a] focus:border-[#c9ad9a] dark:border-foreground/[0.12] dark:bg-foreground/[0.04] dark:text-foreground/90"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={!draft.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#c98b63] px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:bg-[#bd7e57] disabled:opacity-40"
            >
              <span>💛</span>
              {t('review.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EvidenceReviewCard;
