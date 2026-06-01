import { useState, useMemo, useRef, useEffect } from 'react';
import { parseISO } from 'date-fns';
import { Pencil, Check, X, MapPin, ArrowLeft, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Todo } from '@/hooks/useTodos';
import { Moment } from '@/types';
import { ImportedEvent } from '@/hooks/useImportedEvents';
import { autoClassifyTag, TAG_CATEGORY_ICONS } from '@/lib/autoTag';

interface TimelineEntry {
  id: string;
  title: string;
  detail?: string;
  type: 'todo' | 'moment' | 'imported';
  startMin: number;
  endMin: number;
  emoji?: string;
  photos?: string[];
  location?: { name: string };
  tags?: string[];
}

interface TimelineViewProps {
  todos: Todo[];
  moments: Moment[];
  importedEvents?: ImportedEvent[];
  onUpdateTodoTime: (id: string, startedAt: string) => void;
  onUpdateMomentTime?: (id: string, createdAt: string) => void;
  onBack?: () => void;
}

/* ── Category colors for dots ── */
const DOT_COLORS: Record<string, string> = {
  study:   '#4F7DF3',
  health:  '#34C759',
  life:    '#F59E0B',
  event:   '#AF52DE',
};
const MOMENT_DOT = '#F59E0B';
const IMPORTED_DOT = '#AF52DE';
const DEFAULT_DOT = '#8E8E93';

function getDotColor(entry: TimelineEntry): string {
  if (entry.type === 'moment') return MOMENT_DOT;
  if (entry.type === 'imported') return IMPORTED_DOT;
  const tag = entry.tags?.[0] || autoClassifyTag(entry.title);
  if (tag && DOT_COLORS[tag]) return DOT_COLORS[tag];
  return DEFAULT_DOT;
}

function getCategoryLabel(entry: TimelineEntry): string {
  if (entry.type === 'imported') return 'Calendar';
  if (entry.type === 'moment') return 'Life';
  const tag = entry.tags?.[0] || autoClassifyTag(entry.title);
  return tag ? tag.charAt(0).toUpperCase() + tag.slice(1) : 'Task';
}

function getEntryIcon(entry: TimelineEntry): string {
  if (entry.emoji) return entry.emoji;
  if (entry.type === 'imported') return '🎓';
  if (entry.type === 'moment') {
    if (entry.photos && entry.photos.length > 0) return '📷';
    if (entry.location) return '📍';
    return '📝';
  }
  const tag = entry.tags?.[0] || autoClassifyTag(entry.title);
  if (tag && TAG_CATEGORY_ICONS[tag]) return TAG_CATEGORY_ICONS[tag];
  return '⏱';
}

function fmtTime(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type Section = 'morning' | 'afternoon' | 'evening';
function getSection(min: number): Section {
  if (min < 12 * 60) return 'morning';
  if (min < 18 * 60) return 'afternoon';
  return 'evening';
}
const SECTION_LABELS: Record<Section, { en: string; icon: string }> = {
  morning: { en: 'Morning', icon: '☀' },
  afternoon: { en: 'Afternoon', icon: '🌤' },
  evening: { en: 'Evening', icon: '🌙' },
};

/* ── Photo Lightbox ── */
function PhotoLightbox({ photos, initialIndex, onClose }: { photos: string[]; initialIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground z-10"><X size={24} /></button>
      <div className="relative max-w-[90vw] max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <img src={photos[index]} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
        {photos.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-3">
            {photos.map((_, i) => (
              <button key={i} onClick={() => setIndex(i)} className={cn("w-2 h-2 rounded-full transition-colors", i === index ? "bg-primary" : "bg-muted-foreground/30")} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Time Editor ── */
function TimeEntryEditor({ hour, minute, onSave, onCancel }: {
  hour: number; minute: number;
  onSave: (h: number, m: number) => void; onCancel: () => void;
}) {
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);
  return (
    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
      <select value={h} onChange={e => setH(Number(e.target.value))} className="bg-secondary rounded px-1.5 py-0.5 text-sm">
        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
      </select>
      <span className="text-muted-foreground">:</span>
      <select value={m} onChange={e => setM(Number(e.target.value))} className="bg-secondary rounded px-1.5 py-0.5 text-sm">
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(v => <option key={v} value={v}>{String(v).padStart(2, '0')}</option>)}
      </select>
      <button onClick={() => onSave(h, m)} className="p-1 text-primary hover:text-primary/80"><Check size={14} /></button>
      <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground"><X size={14} /></button>
    </div>
  );
}

/* ── Photo Grid (right-aligned, adaptive) ── */
function PhotoGrid({ photos, onOpenPhotos }: {
  photos: string[];
  onOpenPhotos: (photos: string[], index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxVisible, setMaxVisible] = useState(4);
  const photoSize = 72;
  const gap = 6;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        const cols = Math.max(1, Math.floor((w + gap) / (photoSize + gap)));
        const rows = Math.max(1, Math.floor((Math.max(h, photoSize) + gap) / (photoSize + gap)));
        setMaxVisible(cols * rows);
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const visible = photos.slice(0, maxVisible);
  const remaining = photos.length - maxVisible;

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap gap-1.5 justify-end flex-shrink-0"
      style={{ maxWidth: '45%', minWidth: photoSize }}
      onClick={e => e.stopPropagation()}
    >
      {visible.map((photo, i) => {
        const isLast = i === visible.length - 1 && remaining > 0;
        return (
          <div key={i} className="relative">
            <img
              src={photo}
              alt=""
              className="object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
              style={{ width: photoSize, height: photoSize }}
              onClick={() => onOpenPhotos(photos, i)}
            />
            {isLast && (
              <button
                className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm text-sm font-semibold text-foreground cursor-pointer"
                onClick={() => onOpenPhotos(photos, i)}
              >
                +{remaining}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Single Timeline Entry Row ── */
function TimelineEntryRow({ entry, onEdit, onOpenPhotos, onEditTime }: {
  entry: TimelineEntry;
  onEdit: (id: string) => void;
  onOpenPhotos: (photos: string[], index: number) => void;
  onEditTime: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const dotColor = getDotColor(entry);
  const icon = getEntryIcon(entry);
  const durationMin = entry.endMin - entry.startMin;
  const hasDetail = entry.detail && entry.detail.length > 0;
  const hasPhotos = entry.photos && entry.photos.length > 0;

  return (
    <div
      className="group flex items-stretch gap-0 cursor-pointer"
      onClick={() => hasDetail && setExpanded(!expanded)}
    >
      {/* Time column */}
      <div className="w-14 flex-shrink-0 pt-[3px] text-right pr-3">
        <button
          className="font-mono tabular-nums text-muted-foreground hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-none p-0"
          style={{ fontSize: '12px' }}
          onClick={(e) => { e.stopPropagation(); onEditTime(entry.id); }}
          title="Click to edit time"
        >
          {fmtTime(entry.startMin)}
        </button>
      </div>

      {/* Dot + line column */}
      <div className="w-5 flex-shrink-0 flex flex-col items-center relative">
        <div
          className="w-[10px] h-[10px] rounded-full flex-shrink-0 mt-[6px] z-10 ring-2 ring-background"
          style={{ backgroundColor: dotColor }}
        />
        <div className="flex-1 w-[1.5px] bg-border" />
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 pb-6 pl-2 pr-1">
        <div className="rounded-xl transition-colors hover:bg-muted/50 px-3 py-2.5 -ml-1 group relative">
          <div className={cn("flex gap-3", hasPhotos ? "items-start" : "")}>
            {/* Left: text content */}
            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base flex-shrink-0">{icon}</span>
                <span className="font-medium text-foreground line-clamp-2 break-words" style={{ fontSize: '16px' }}>
                  {entry.title}
                </span>
                {hasDetail && (
                  <ChevronDown
                    size={14}
                    className={cn(
                      "flex-shrink-0 text-muted-foreground/50 transition-transform",
                      expanded && "rotate-180"
                    )}
                  />
                )}
              </div>

              {/* Meta row: duration + location */}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {durationMin > 5 && (
                  <span className="font-mono tabular-nums text-muted-foreground" style={{ fontSize: '13px' }}>
                    ⏱ {fmtDuration(durationMin)}
                  </span>
                )}
                {entry.location && (
                  <span className="flex items-center gap-1 text-muted-foreground truncate" style={{ fontSize: '13px' }} title={entry.location.name}>
                    <MapPin size={11} className="flex-shrink-0" />
                    <span className="truncate max-w-[180px]">{entry.location.name}</span>
                  </span>
                )}
              </div>

              {/* Expanded detail */}
              {expanded && hasDetail && (
                <p className="mt-2 text-muted-foreground leading-relaxed" style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  {entry.detail}
                </p>
              )}
            </div>

            {/* Right: photos side-by-side */}
            {hasPhotos && (
              <PhotoGrid
                photos={entry.photos!}
                onOpenPhotos={onOpenPhotos}
              />
            )}
          </div>

          {/* Edit button on hover */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(entry.id); }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-foreground transition-opacity bg-muted/60"
          >
            <Pencil size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Timeline ── */
export function TimelineView({ todos, moments, importedEvents, onUpdateTodoTime, onUpdateMomentTime, onBack }: TimelineViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<{ photos: string[]; index: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => {
    const result: TimelineEntry[] = [];
    todos.forEach(todo => {
      if (todo.timer_started_at) {
        const d = parseISO(todo.timer_started_at);
        const startMin = d.getHours() * 60 + d.getMinutes();
        let endMin = startMin;
        if (todo.timer_ended_at) {
          const e = parseISO(todo.timer_ended_at);
          endMin = e.getHours() * 60 + e.getMinutes();
        } else if (todo.timer_seconds && todo.timer_seconds > 0) {
          endMin = startMin + Math.ceil(todo.timer_seconds / 60);
        }
        result.push({ id: `todo-${todo.id}`, title: todo.title, type: 'todo', startMin, endMin: Math.max(endMin, startMin + 5), tags: todo.tags });
      } else if (todo.is_completed) {
        const d = parseISO(todo.created_at);
        const startMin = d.getHours() * 60 + d.getMinutes();
        result.push({ id: `todo-${todo.id}`, title: todo.title, type: 'todo', startMin, endMin: startMin + 5, tags: todo.tags });
      }
    });
    moments.forEach(m => {
      const startDate = m.timer_started_at ? parseISO(m.timer_started_at) : parseISO(m.createdAt);
      const startMin = startDate.getHours() * 60 + startDate.getMinutes();
      let endMin = startMin;
      if (m.timer_ended_at) { const e = parseISO(m.timer_ended_at); endMin = e.getHours() * 60 + e.getMinutes(); }
      else if (m.timer_seconds && m.timer_seconds > 0) { endMin = startMin + Math.ceil(m.timer_seconds / 60); }

      // Use text as title, any additional detail
      const title = m.text || m.emoji || 'Moment';
      result.push({
        id: `moment-${m.id}`, title, type: 'moment', startMin,
        endMin: Math.max(endMin, startMin + 5), emoji: m.emoji,
        photos: m.photos && m.photos.length > 0 ? m.photos : undefined,
        location: m.location ? { name: m.location.name } : undefined,
      });
    });
    if (importedEvents) {
      importedEvents.forEach(ev => {
        const d = new Date(ev.start_time);
        const startMin = d.getHours() * 60 + d.getMinutes();
        let endMin = startMin + 30;
        if (ev.end_time) { const e = new Date(ev.end_time); endMin = e.getHours() * 60 + e.getMinutes(); if (endMin <= startMin) endMin = startMin + 30; }
        result.push({ id: `imported-${ev.id}`, title: ev.title, type: 'imported', startMin, endMin });
      });
    }
    // Deduplicate + sort by time
    const seen = new Set<string>();
    return result
      .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
      .sort((a, b) => a.startMin - b.startMin);
  }, [todos, moments, importedEvents]);

  // Group by section
  const grouped = useMemo(() => {
    const sections: { section: Section; entries: TimelineEntry[] }[] = [];
    let current: Section | null = null;
    entries.forEach(e => {
      const s = getSection(e.startMin);
      if (s !== current) {
        current = s;
        sections.push({ section: s, entries: [e] });
      } else {
        sections[sections.length - 1].entries.push(e);
      }
    });
    return sections;
  }, [entries]);

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'instant' as any });
      });
    }
  }, []);

  const handleSaveTime = (entryId: string, h: number, m: number) => {
    const [type, ...rest] = entryId.split('-');
    const realId = rest.join('-');
    const today = new Date();
    today.setHours(h, m, 0, 0);
    const iso = today.toISOString();
    if (type === 'todo') onUpdateTodoTime(realId, iso);
    else if (type === 'moment' && onUpdateMomentTime) onUpdateMomentTime(realId, iso);
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground/60 hover:text-foreground transition-colors group">
            <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-medium">Back</span>
          </button>
        )}
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground/40 font-mono tabular-nums">{entries.length} moments</span>
      </div>

      {/* Lightbox */}
      {lightboxPhotos && <PhotoLightbox photos={lightboxPhotos.photos} initialIndex={lightboxPhotos.index} onClose={() => setLightboxPhotos(null)} />}

      {/* Scrollable life river */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-28">
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50">
            <span className="text-3xl mb-3">🌊</span>
            <p className="text-sm">Your life river is empty today</p>
            <p className="text-xs mt-1">Record a moment to start flowing</p>
          </div>
        )}

        {grouped.map(({ section, entries: sectionEntries }, si) => (
          <div key={section + si}>
            {/* Section header — subtle */}
            <div className="flex items-center gap-2 px-5 pt-4 pb-2">
              <span className="text-xs" style={{ opacity: 0.5 }}>{SECTION_LABELS[section].icon}</span>
              <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground/50">
                {SECTION_LABELS[section].en}
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Entries */}
            <div className="px-2">
              {sectionEntries.map((entry) => (
                editingId === entry.id ? (
                  <div key={entry.id} className="flex items-stretch gap-0">
                    <div className="w-14 flex-shrink-0" />
                    <div className="w-5 flex-shrink-0 flex flex-col items-center">
                      <div className="w-[10px] h-[10px] rounded-full mt-[6px] z-10 ring-2 ring-background" style={{ backgroundColor: getDotColor(entry) }} />
                      <div className="flex-1 w-[1.5px] bg-border" />
                    </div>
                    <div className="flex-1 pl-2 pb-6">
                      <div className="px-3 py-2.5">
                        <TimeEntryEditor
                          hour={Math.floor(entry.startMin / 60)}
                          minute={entry.startMin % 60}
                          onSave={(h, m) => handleSaveTime(entry.id, h, m)}
                          onCancel={() => setEditingId(null)}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <TimelineEntryRow
                    key={entry.id}
                    entry={entry}
                    onEdit={setEditingId}
                    onEditTime={setEditingId}
                    onOpenPhotos={(photos, index) => setLightboxPhotos({ photos, index })}
                  />
                )
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
