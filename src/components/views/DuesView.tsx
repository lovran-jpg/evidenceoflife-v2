import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { format, differenceInMinutes, differenceInDays, parseISO, subDays, startOfDay, isSameDay } from 'date-fns';
import { Plus, Calendar, Trash2, CalendarPlus, Check, Clock, Repeat, Pencil, X, Link, ExternalLink, Target, Camera, ArrowUp, Bell, BellOff, Mail, ChevronDown, ChevronUp, Mic, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, isImeComposing } from '@/lib/utils';
import {
  normalizeUrl,
  isUrlLike as isStandaloneUrl,
  extractFirstUrl,
  getDomain as getSiteFallback,
  buildProxyImageUrl,
  getFaviconUrl,
} from '@/lib/linkUtils';
import { useDues, DueWithStats, DueLink, DueStep } from '@/hooks/useDues';
import { useDueReminders, DueReminder } from '@/hooks/useDueReminders';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { parseDateFromText as parseDateFromTextShared } from '@/lib/parseDateFromText';
import { useDateLocale } from '@/hooks/useDateLocale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LinkPreviewCard } from '@/components/LinkPreviewCard';
import { toast } from 'sonner';

function hasRichPreview(link: Partial<DueLink> | undefined): boolean {
  if (!link?.url) return false;
  const siteFallback = getSiteFallback(link.url).toLowerCase();
  const title = (link.title || '').trim().toLowerCase();
  const description = (link.description || '').trim();
  return Boolean(
    description ||
    (title && title !== siteFallback && title !== link.url.toLowerCase())
  );
}

function getLinkDisplayName(link: Partial<DueLink>): string {
  return link.label?.trim() || link.title?.trim() || link.siteName?.trim() || getSiteFallback(link.url || '');
}

function CompactHabitLinkThumb({ link }: { link: Partial<DueLink> }) {
  const [mode, setMode] = useState<'image' | 'favicon' | 'icon'>(() => {
    return link.image ? 'image' : link.url ? 'favicon' : 'icon';
  });

  useEffect(() => {
    setMode(link.image ? 'image' : link.url ? 'favicon' : 'icon');
  }, [link.image, link.url]);

  if (mode === 'icon') {
    return (
      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-border/70 bg-[hsl(var(--surface-soft))] text-muted-foreground/70">
        <Link size={12} />
      </div>
    );
  }

  const src = mode === 'image' && link.image
    ? buildProxyImageUrl(link.image)
    : link.url
      ? getFaviconUrl(link.url)
      : '';

  return (
    <img
      src={src}
      alt=""
      className={cn(
        "h-5 w-5 flex-shrink-0 rounded-md border border-border/60 bg-white/85",
        mode === 'image' ? "object-cover" : "object-contain p-0.5"
      )}
      onError={() => {
        setMode((current) => {
          if (current === 'image' && link.url) return 'favicon';
          return 'icon';
        });
      }}
    />
  );
}

function LightweightLinkItem({
  link,
  onRemove,
  onRename,
  compact = false,
}: {
  link: Partial<DueLink>;
  onRemove?: () => void;
  onRename?: (nextLabel: string) => void;
  compact?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(getLinkDisplayName(link));
  const siteName = link.siteName || (link.url ? getSiteFallback(link.url) : '');

  useEffect(() => {
    setDraftLabel(getLinkDisplayName(link));
  }, [link.label, link.title, link.siteName, link.url]);

  const save = () => {
    const next = draftLabel.trim();
    if (next && next !== getLinkDisplayName(link)) onRename?.(next);
    setIsEditing(false);
  };

  return (
    <div className={cn(
      "group flex items-center gap-2.5 rounded-xl border border-border/60 bg-[hsl(var(--surface-soft))] px-3",
      compact ? "min-h-[48px] py-2" : "min-h-[64px] py-2.5"
    )}>
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') {
                setDraftLabel(getLinkDisplayName(link));
                setIsEditing(false);
              }
            }}
            className="w-full bg-transparent text-[13px] font-medium text-foreground focus:outline-none"
            autoFocus
          />
        ) : (
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-[13px] font-medium text-foreground hover:underline"
          >
            {getLinkDisplayName(link)}
          </a>
        )}
        <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.08em] text-muted-foreground/65">
          {siteName}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onRename && !isEditing && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setDraftLabel(getLinkDisplayName(link));
              setIsEditing(true);
            }}
            className="rounded-full p-1 text-muted-foreground/55 transition-colors hover:text-foreground"
          >
            <Pencil size={11} />
          </button>
        )}
        {link.url && (
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full p-1 text-muted-foreground/55 transition-colors hover:text-foreground"
          >
            <ExternalLink size={11} />
          </a>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onRemove();
            }}
            className="rounded-full p-1 text-muted-foreground/55 transition-colors hover:text-destructive"
          >
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

function getTimeLeft(due: string, t: (key: string) => string, isCompleted?: boolean) {
  const dueDate = parseISO(due);
  if (isCompleted) return { text: t('dues.completedLabel'), urgent: false, overdue: false };
  const now = new Date();
  const totalMins = differenceInMinutes(dueDate, now);
  if (totalMins < 0) {
    const absMins = Math.abs(totalMins);
    const days = Math.floor(absMins / (60 * 24));
    const hrs = Math.floor((absMins % (60 * 24)) / 60);
    const mins = absMins % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0 && days === 0) parts.push(`${mins}m`);
    return { text: `${parts.join(' ')} ${t('dues.overdue')}`, urgent: true, overdue: true };
  }
  const days = Math.floor(totalMins / (60 * 24));
  const hrs = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;
  if (days === 0 && hrs === 0) return { text: `${mins}m ${t('dues.left')}`, urgent: true, overdue: false };
  if (days === 0) return { text: `${hrs}h ${mins}m ${t('dues.left')}`, urgent: true, overdue: false };
  if (days <= 3) {
    const parts = [`${days}d`];
    if (hrs > 0) parts.push(`${hrs}h`);
    return { text: `${parts.join(' ')} ${t('dues.left')}`, urgent: true, overdue: false };
  }
  return { text: `${days}d ${hrs}h ${t('dues.left')}`, urgent: false, overdue: false };
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

/* ── Habit Punch Card ── */
function HabitPunchCard({ dueId, totalCount }: { dueId: string; totalCount: number }) {
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  useEffect(() => {
    supabase.from('todos').select('date').eq('parent_due_id', dueId).eq('is_completed', true)
      .then(({ data }) => { if (data) setCompletedDates(data.map(d => d.date)); });
  }, [dueId, totalCount]);

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 28 }, (_, i) => {
      const d = subDays(today, 27 - i);
      return { date: d, done: completedDates.includes(format(d, 'yyyy-MM-dd')) };
    });
  }, [completedDates]);

  const streak = useMemo(() => {
    let count = 0;
    const today = startOfDay(new Date());
    for (let i = 0; i < 365; i++) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      if (completedDates.includes(d)) count++;
      else if (i > 0) break;
      else break;
    }
    return count;
  }, [completedDates]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap" style={{ height: 36 }}>
        {days.map((day, i) => (
          <div key={i} title={format(day.date, 'MM/dd')} className={cn(
            "rounded-[2px] transition-colors",
            day.done ? "bg-primary/80" : isSameDay(day.date, new Date()) ? "bg-primary/20 border border-primary/30" : "bg-secondary/60"
          )} style={{ width: 8, height: 8, gap: 6 }} />
        ))}
      </div>
      {streak > 0 && <span className="text-[12px] font-medium text-primary">🔥 {streak} day{streak > 1 ? 's' : ''}</span>}
    </div>
  );
}

function CompactHabitCard({
  due,
  onIncrement,
  onManage,
  onToggleExpand,
  onUpdateLinks,
  expanded,
}: {
  due: DueWithStats;
  onIncrement: () => void;
  onManage: () => void;
  onToggleExpand: () => void;
  onUpdateLinks: (links: DueLink[]) => void;
  expanded: boolean;
}) {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todayCount = due.dailyCounts?.[todayKey] || 0;
  const targetCount = Math.max(1, due.targetCount || 1);
  const accentColor = '#2dd4bf';
  const links = due.links || [];

  const incrementLinkCount = (index: number) => {
    onUpdateLinks(links.map((l, i) => i === index ? { ...l, count: (l.count || 0) + 1 } : l));
  };

  return (
    <div
      id={`habit-compact-${due.id}`}
      role="button"
      tabIndex={0}
      onClick={onToggleExpand}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleExpand();
        }
      }}
      className={cn(
        "rounded-[16px] border border-border/70 bg-card px-3 py-2.5 shadow-[0_4px_10px_hsl(var(--foreground)/0.03)] transition-colors",
        expanded ? "border-[#2dd4bf]/45 bg-[rgba(45,212,191,0.05)]" : "hover:bg-[hsl(var(--surface-soft-hover))]"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-1 h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold leading-tight text-foreground">{due.title}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground/75">
                <span>{todayCount}/{targetCount} Today</span>
                {due.currentStreak > 0 && <span>🔥 {due.currentStreak} day streak</span>}
              </div>
            </div>
            <ChevronDown
              size={14}
              className={cn("flex-shrink-0 mt-0.5 text-muted-foreground/40 transition-transform duration-200", expanded && "rotate-180")}
            />
          </div>

          {/* Links as primary content — shown directly on compact card */}
          {links.length > 0 ? (
            <div className="mt-2 space-y-1.5" onClick={e => e.stopPropagation()}>
              {links.map((link, i) => (
                <div key={`${link.url}-${i}`} className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 px-2.5 py-1.5">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex-1 min-w-0 flex items-center gap-1.5"
                  >
                    <CompactHabitLinkThumb link={link} />
                    <span className="truncate text-[12px] font-medium text-foreground">{link.label || link.title || link.url}</span>
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); incrementLinkCount(i); }}
                    className="flex-shrink-0 h-6 px-2 rounded-lg border border-[rgba(45,212,191,0.28)] bg-[rgba(45,212,191,0.08)] text-[11px] font-semibold text-[#149d8d] hover:bg-[rgba(45,212,191,0.16)] transition-colors whitespace-nowrap"
                  >
                    +1 · {link.count || 0}×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onIncrement(); }}
                className="inline-flex items-center rounded-full border border-[rgba(45,212,191,0.28)] bg-[rgba(45,212,191,0.08)] px-2.5 py-1.25 text-[11px] font-semibold leading-none text-[#149d8d] transition-colors hover:bg-[rgba(45,212,191,0.14)]"
              >
                + Check in
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onManage(); }}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1.25 text-[11px] font-medium leading-none text-[hsl(var(--text-soft))] transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Pencil size={10} />Edit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Due Card (Redesigned) ── */
function DueCard({ due, onUpdate, onDelete, onAddToToday, justAdded, dueReminders, onUpsertReminder, onRemoveReminder, onAddStep, onToggleStep, onDeleteStep, onIncrementHabitCount, onSetHabitCount }: {
  due: DueWithStats;
  onUpdate: (id: string, updates: { title?: string; due_date?: string | null; links?: DueLink[]; is_completed?: boolean; photos?: string[]; habit_category?: string | null; show_in_recap_daily?: boolean }) => void;
  onDelete: (id: string) => void;
  onAddToToday: (id: string, stepTitle?: string) => void;
  justAdded: boolean;
  dueReminders: DueReminder[];
  onUpsertReminder: (dueId: string, type: 'browser' | 'email', beforeMinutes: number, isRecurring?: boolean, intervalDays?: number) => void;
  onRemoveReminder: (reminderId: string) => void;
  onAddStep: (masterId: string, title: string) => void;
  onToggleStep: (stepId: string, completed: boolean) => void;
  onDeleteStep: (stepId: string) => void;
  onIncrementHabitCount: (masterId: string) => void;
  onSetHabitCount: (masterId: string, nextCount: number) => void;
}) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatDate } = useDateLocale();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(due.title);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDate, setEditDate] = useState(due.due_date || '');
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [showReminderPopover, setShowReminderPopover] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState('');
  const [showAddStep, setShowAddStep] = useState(false);
  const [isEditingCount, setIsEditingCount] = useState(false);
  const [countDraft, setCountDraft] = useState(String(due.totalCount || 0));
  const [editingLinkCountIndex, setEditingLinkCountIndex] = useState<number | null>(null);
  const [linkCountDraft, setLinkCountDraft] = useState('');
  const [optimisticHabitCount, setOptimisticHabitCount] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linksCollapsed, setLinksCollapsed] = useState(true);
  const editDateInputRef = useRef<HTMLInputElement>(null);
  const [addingLink, setAddingLink] = useState(false);
  const updateLinkLabel = (index: number, nextLabel: string) => {
    onUpdate(due.id, {
      links: (due.links || []).map((link, i) => i === index ? { ...link, label: nextLabel } : link),
    });
  };

  const REMINDER_PRESETS = [
    { label: '1h before', minutes: 60 },
    { label: '1 day before', minutes: 1440 },
    { label: '3 days before', minutes: 4320 },
    { label: '1 week before', minutes: 10080 },
  ];
  const HABIT_PRESETS = [
    { label: 'Daily', days: 1 },
    { label: 'Every 3 days', days: 3 },
    { label: 'Weekly', days: 7 },
    { label: 'Monthly', days: 30 },
  ];

  const hasDeadline = !!due.due_date;
  const timeLeft = hasDeadline ? getTimeLeft(due.due_date!, t, due.is_completed) : null;
  const timeStr = formatDuration(due.totalSeconds);
  const parsedDueDate = hasDeadline ? parseISO(due.due_date!) : null;

  // Color theming: Deadline = warm orange, Habit = cool teal
  const isHabit = due.habit_category !== null;
  const accentColor = !isHabit ? '#e8825a' : '#2dd4bf';
  const accentBg = !isHabit ? 'rgba(232,130,90,0.08)' : 'rgba(45,212,191,0.08)';
  const accentBorder = !isHabit ? 'rgba(232,130,90,0.25)' : 'rgba(45,212,191,0.25)';
  const trackedLinkCountTotal = (due.links || []).reduce((sum, link) => sum + (link.count || 0), 0);
  const hasPerLinkCounts = isHabit && (due.links || []).length > 0;
  const displayedHabitCount = optimisticHabitCount ?? (hasPerLinkCounts ? trackedLinkCountTotal : due.totalCount);
  const cardReminders = dueReminders.filter(r => r.due_id === due.id);
  const stepRemindersFor = (stepId: string) => dueReminders.filter(r => r.due_id === stepId);
  const hasActiveReminder = cardReminders.some(r => r.is_active);
  const formatReminderText = (reminder: DueReminder) => {
    if (reminder.is_recurring) return `Every ${reminder.recurring_interval_days}d`;
    if (reminder.remind_before_minutes >= 1440) return `${Math.round(reminder.remind_before_minutes / 1440)}d before`;
    if (reminder.remind_before_minutes >= 60) return `${Math.round(reminder.remind_before_minutes / 60)}h before`;
    return `${reminder.remind_before_minutes}min before`;
  };

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle.trim() !== due.title) onUpdate(due.id, { title: editTitle.trim() });
    else setEditTitle(due.title);
    setIsEditingTitle(false);
  };

  useEffect(() => {
    setCountDraft(String(due.totalCount || 0));
  }, [due.totalCount]);

  useEffect(() => {
    setOptimisticHabitCount(null);
  }, [due.totalCount, trackedLinkCountTotal]);

  const updateHabitLinkCount = (index: number, nextCount: number) => {
    onUpdate(due.id, {
      links: (due.links || []).map((link, i) => i === index ? { ...link, count: Math.max(0, Math.floor(nextCount)) } : link),
    });
  };

  const incrementHabitLinkCount = (index: number) => {
    updateHabitLinkCount(index, ((due.links || [])[index]?.count || 0) + 1);
  };

  const handleSaveDate = () => {
    if (editDate && editDate !== due.due_date) onUpdate(due.id, { due_date: editDate });
    setIsEditingDate(false);
  };

  const handleAddLink = async () => {
    const url = normalizeUrl(newLinkUrl);
    if (!url) {
      toast.error('Invalid link');
      return;
    }
    const existingLink = (due.links || []).find(link => link.url === url);
    if (existingLink && hasRichPreview(existingLink)) {
      setShowAddLink(false);
      setNewLinkUrl('');
      setNewLinkLabel('');
      return;
    }

    setAddingLink(true);
    try {
      const siteFallback = getSiteFallback(url);
      if (!existingLink) {
        onUpdate(due.id, {
          links: [
            ...(due.links || []),
            { url, label: newLinkLabel.trim() || siteFallback, title: siteFallback, siteName: siteFallback },
          ],
        });
      }
      setNewLinkUrl('');
      setNewLinkLabel('');
      setShowAddLink(false);

      const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } });
      if (error) {
        console.error('Due link preview failed:', error);
        toast.warning('Preview unavailable, link added anyway');
        return;
      }
      onUpdate(due.id, {
        links: (due.links || []).concat({
          url,
          label: newLinkLabel.trim() || data?.title || data?.siteName || siteFallback,
          title: typeof data?.title === 'string' ? data.title : undefined,
          description: typeof data?.description === 'string' ? data.description : undefined,
          image: typeof data?.image === 'string' ? data.image : undefined,
          siteName: typeof data?.siteName === 'string' ? data.siteName : undefined,
        }).reduce<DueLink[]>((acc, link) => {
          const existingIndex = acc.findIndex(item => item.url === link.url);
          if (existingIndex >= 0) acc[existingIndex] = { ...acc[existingIndex], ...link };
          else acc.push(link);
          return acc;
        }, []),
      });
    } catch (err) {
      console.error('Due link preview exception:', err);
      toast.warning('Preview unavailable, link added anyway');
    } finally {
      setAddingLink(false);
    }
  };

  const handleRemoveLink = (index: number) => onUpdate(due.id, { links: (due.links || []).filter((_, i) => i !== index) });

  const appendPhotoFiles = async (files: File[]) => {
    if (!files || !user) return;
    const newPhotos = [...(due.photos || [])];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) continue;
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('moment-photos').upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from('moment-photos').getPublicUrl(path);
        if (urlData?.publicUrl) newPhotos.push(urlData.publicUrl);
      }
    }
    onUpdate(due.id, { photos: newPhotos });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    await appendPhotoFiles(Array.from(files));
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleCardPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const imageFiles = Array.from(e.clipboardData.items)
      .filter(item => item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (imageFiles.length === 0) return;
    e.preventDefault();
    void appendPhotoFiles(imageFiles);
  };

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  return (
    <div id={`due-card-${due.id}`} tabIndex={0} onPaste={handleCardPaste} className={cn(
      "bg-card rounded-[18px] p-3 group relative transition-all",
      due.is_completed && "opacity-50"
    )} style={{ 
      boxShadow: '0 2px 8px rgba(0,0,0,0.025)',
      border: `1px solid ${timeLeft?.overdue ? 'hsl(var(--destructive) / 0.22)' : accentBorder}`,
    }}>
      <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
      

      {/* Type indicator dot + Title */}
      <div className="flex items-start gap-2.5">
        <div className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
          {isEditingTitle ? (
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} onBlur={handleSaveTitle}
              onKeyDown={e => {
                const ne = e.nativeEvent as KeyboardEvent;
                if (e.key === 'Enter') {
                  if (isImeComposing(ne)) return;
                  handleSaveTitle();
                }
                if (e.key === 'Escape') { setEditTitle(due.title); setIsEditingTitle(false); }
              }}
              className="text-[14px] font-semibold w-full bg-transparent border-b focus:outline-none" style={{ borderColor: accentColor }} autoFocus />
          ) : (
            <h3 className={cn("text-[14px] font-semibold text-foreground cursor-pointer line-clamp-2 leading-snug hover:opacity-70 transition-opacity", due.is_completed && "line-through")}
              onClick={() => { setEditTitle(due.title); setIsEditingTitle(true); }}>
              {due.title}
            </h3>
          )}
            </div>
            {!isHabit && due.steps.length > 0 && (
              <span className={cn(
                "inline-flex flex-shrink-0 flex-col items-center justify-center rounded-[14px] px-2.5 py-1.5 text-[11px] font-medium leading-none",
                due.steps.every(s => s.is_completed)
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary/75 text-muted-foreground"
              )}>
                <span>{due.steps.filter(s => s.is_completed).length}/{due.steps.length}</span>
                <span className="mt-1 text-[10px] opacity-80">steps</span>
              </span>
            )}
          </div>

          {/* Due time / Habit label */}
          {hasDeadline && !isEditingDate ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-border/45 bg-secondary/25 px-2.5 py-1 text-left transition-colors hover:text-foreground"
                onClick={() => { setEditDate(due.due_date || ''); setIsEditingDate(true); }}
              >
                <Calendar size={11} className="text-muted-foreground/45" />
                <span className="leading-none">{parsedDueDate ? formatDate(parsedDueDate, 'MMM d') : ''}</span>
                <span className="text-muted-foreground/35">·</span>
                <span className="font-mono leading-none">{parsedDueDate ? formatDate(parsedDueDate, 'HH:mm') : ''}</span>
              </button>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/45 bg-secondary/25 px-2.5 py-1 text-left">
                {timeLeft && (
                  <span className={cn(
                    "font-medium leading-none",
                    timeLeft.overdue ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {timeLeft.text}
                  </span>
                )}
                {timeStr && (
                  <span className="leading-none text-muted-foreground/65">
                    {timeStr} tracked
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
              {isHabit && (
                <span className="flex items-center gap-1 font-medium" style={{ color: accentColor }}>
                  <Repeat size={10} />
                  {due.habit_category || 'Habit'}
                </span>
              )}
              {isHabit && (
                <button
                  onClick={() => onUpdate(due.id, { show_in_recap_daily: !due.show_in_recap_daily })}
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                    due.show_in_recap_daily
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {due.show_in_recap_daily ? 'In recap' : 'Add to recap'}
                </button>
              )}
              {!isHabit && !hasDeadline && (
                <span className="cursor-pointer hover:text-foreground transition-colors text-muted-foreground/60"
                  onClick={() => { setEditDate(''); setIsEditingDate(true); }}>
                  + Add deadline
                </span>
              )}
              {timeStr && <span>· {timeStr}</span>}
              {!isHabit && due.steps.length > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md text-[11px] font-medium",
                  due.steps.every(s => s.is_completed)
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-muted-foreground"
                )}>
                  {due.steps.filter(s => s.is_completed).length}/{due.steps.length} steps
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inline date editor */}
      {isEditingDate && (
        <div className="flex items-center gap-1.5 mt-2">
          <button
            type="button"
            onClick={() => {
              const input = editDateInputRef.current;
              if (!input) return;
              if (typeof input.showPicker === 'function') input.showPicker();
              else input.focus();
            }}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Calendar size={14} />
          </button>
          <input ref={editDateInputRef} type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)}
            className="datetime-input-iconless bg-secondary rounded-lg px-2 py-1 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-primary flex-1" autoFocus />
          <button onClick={handleSaveDate} className="text-primary"><Check size={14} /></button>
          {hasDeadline && <button onClick={() => { onUpdate(due.id, { due_date: null }); setIsEditingDate(false); }} className="text-[12px] text-muted-foreground hover:text-destructive">{t('dues.remove')}</button>}
          <button onClick={() => setIsEditingDate(false)} className="text-muted-foreground"><X size={14} /></button>
        </div>
      )}

      {/* Steps — vertical node pipeline.
          Available for ANY non-habit due (with or without a deadline).
          Habits are intentionally excluded because they have a different
          completion model (per-day punch card + count), and stacking
          steps on top of that gets visually confusing. */}
      {!isHabit && (
        <div className="mt-2.5">
          {due.steps.map((step, i) => {
            const isCompleted = step.is_completed;
            const isLast = i === due.steps.length - 1;
            const stepReminders = stepRemindersFor(step.id);
            const hasStepReminder = stepReminders.some(r => r.is_active);
            return (
              <div key={step.id} className="flex gap-2.5 group/step">
                {/* Left rail: node + connector line */}
                <div className="flex flex-col items-center flex-shrink-0 w-5">
                  <button
                    onClick={() => onToggleStep(step.id, !step.is_completed)}
                    className="w-5 h-5 rounded-full flex items-center justify-center transition-all flex-shrink-0 mt-0.5"
                    style={{
                      backgroundColor: isCompleted ? accentColor : 'transparent',
                      border: `2px solid ${isCompleted ? accentColor : 'hsl(var(--border))'}`,
                    }}
                  >
                    {isCompleted && <Check size={9} strokeWidth={3} className="text-white" />}
                  </button>
                  {!isLast && (
                    <div className="w-[2px] flex-1 min-h-[14px] my-0.5 rounded-full"
                      style={{ backgroundColor: isCompleted ? `${accentColor}55` : 'hsl(var(--border))' }} />
                  )}
                </div>
                {/* Right: label */}
                <div className={cn("flex items-start gap-1.5 flex-1 min-w-0", !isLast && "pb-2")}>
                  <span className={cn(
                    "flex-1 text-[13px] leading-snug pt-0.5",
                    isCompleted ? "text-muted-foreground/35 line-through" : "text-foreground/72"
                  )}>
                    {step.title}
                  </span>
                  {/* Completion date — only when the step is done.
                      Useful for tasks without a deadline so you still
                      get a "when did this happen" anchor on the card. */}
                  {isCompleted && step.completed_at && (
                    <span
                      className="mt-1 flex-shrink-0 rounded-md bg-secondary/55 px-1.5 py-[1px] font-mono text-[10px] tabular-nums text-muted-foreground/65"
                      title={formatDate(parseISO(step.completed_at), 'PPpp')}
                    >
                      {formatDate(parseISO(step.completed_at), 'MMM d')}
                    </span>
                  )}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "mt-0.5 rounded-full p-1 transition-all flex-shrink-0",
                          hasStepReminder
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground/25 opacity-0 group-hover/step:opacity-100 hover:bg-secondary hover:text-primary"
                        )}
                        title="Step reminder"
                      >
                        {hasStepReminder ? <Bell size={11} /> : <BellOff size={11} />}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3 space-y-2" align="end">
                      <div>
                        <p className="text-[13px] font-medium text-foreground">Step reminder</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground/65">{step.title}</p>
                      </div>
                      {stepReminders.map(r => (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/45 px-2 py-1.5 text-[12px]">
                          <span className="flex min-w-0 items-center gap-1.5">
                            {r.reminder_type === 'email' ? <Mail size={11} /> : <Bell size={11} />}
                            <span className="truncate">{formatReminderText(r)}</span>
                          </span>
                          <button onClick={() => onRemoveReminder(r.id)} className="text-muted-foreground/55 hover:text-destructive">
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      {hasDeadline ? (
                        <>
                          <p className="text-[11px] font-medium text-muted-foreground/70">Browser</p>
                          <div className="flex flex-wrap gap-1.5">
                            {REMINDER_PRESETS.map(p => (
                              <button
                                key={p.minutes}
                                onClick={() => onUpsertReminder(step.id, 'browser', p.minutes)}
                                className="rounded-lg bg-secondary px-2 py-1 text-[12px] transition-colors hover:bg-secondary/80"
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] font-medium text-muted-foreground/70">Email</p>
                          <div className="flex flex-wrap gap-1.5">
                            {REMINDER_PRESETS.map(p => (
                              <button
                                key={p.minutes}
                                onClick={() => onUpsertReminder(step.id, 'email', p.minutes)}
                                className="rounded-lg bg-secondary px-2 py-1 text-[12px] transition-colors hover:bg-secondary/80"
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="rounded-lg bg-secondary/45 px-2 py-1.5 text-[12px] text-muted-foreground">
                          Add a deadline to this item first.
                        </p>
                      )}
                    </PopoverContent>
                  </Popover>
                  <button
                    onClick={() => onDeleteStep(step.id)}
                    className="opacity-0 group-hover/step:opacity-100 mt-1 text-muted-foreground/25 hover:text-destructive transition-opacity p-0.5 flex-shrink-0"
                  >
                    <X size={10} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add stage */}
          {showAddStep ? (
            <div className="flex gap-2.5 mt-0.5">
              <div className="w-5 h-5 rounded-full border-2 border-dashed flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ borderColor: `${accentColor}40` }} />
              <input
                value={newStepTitle}
                onChange={e => setNewStepTitle(e.target.value)}
                placeholder={due.steps.length === 0 ? "First stage..." : "Next stage..."}
                className="flex-1 text-[13px] bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground/35 pt-0.5"
                autoFocus
                onKeyDown={e => {
                  const ne = e.nativeEvent as KeyboardEvent;
                  if (e.key === 'Enter') {
                    if (isImeComposing(ne)) return;
                    if (newStepTitle.trim()) { onAddStep(due.id, newStepTitle.trim()); setNewStepTitle(''); }
                  }
                  if (e.key === 'Escape') { setShowAddStep(false); setNewStepTitle(''); }
                }}
                onBlur={() => {
                  if (newStepTitle.trim()) { onAddStep(due.id, newStepTitle.trim()); setNewStepTitle(''); }
                  setShowAddStep(false);
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowAddStep(true)}
              className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground/35 hover:text-muted-foreground transition-colors"
            >
              <div className="w-4 h-4 rounded-full border-[1.5px] border-dashed border-muted-foreground/20 flex items-center justify-center flex-shrink-0">
                <Plus size={8} />
              </div>
              {t('dues.addStep')}
            </button>
          )}
        </div>
      )}

      {/* Habit punch card — only for actual habits.
          Previously gated on `!hasDeadline`, which meant every plain
          deadline-less task (e.g. "Apply for RA positions") got a
          28-cell grid that looked like a habit tracker but tracked
          nothing useful. Restrict to `isHabit` so the grid only shows
          where it has meaning. */}
      {isHabit && (
        <div className="mt-2.5">
          <HabitPunchCard dueId={due.id} totalCount={due.totalCount} />
        </div>
      )}

      {/* Resources: links */}
      {(due.links || []).length > 0 && (
        <div className="mt-2.5">
          <button
            onClick={() => setLinksCollapsed(c => !c)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors mb-1.5"
          >
            <Link size={11} />
            <span>{due.links.length} link{due.links.length > 1 ? 's' : ''}</span>
            {linksCollapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
          </button>
        </div>
      )}
      {(due.links || []).length > 0 && !linksCollapsed && (
        <div className="space-y-2">
          {isHabit ? (
            (due.links || []).map((link, i) => (
              <div key={`${link.url}-${i}`} className="space-y-2">
                <LinkPreviewCard
                  preview={{
                    url: link.url,
                    title: link.title || link.label,
                    description: link.description,
                    image: link.image,
                    siteName: link.siteName,
                  }}
                  compact
                  onCardClick={() => incrementHabitLinkCount(i)}
                  onRemove={() => handleRemoveLink(i)}
                />
                <div className="flex items-center gap-2 pl-1">
                  {editingLinkCountIndex === i ? (
                    <input
                      value={linkCountDraft}
                      onChange={e => setLinkCountDraft(e.target.value.replace(/[^\d]/g, ''))}
                      onBlur={() => {
                        updateHabitLinkCount(i, Number(linkCountDraft || 0));
                        setEditingLinkCountIndex(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          updateHabitLinkCount(i, Number(linkCountDraft || 0));
                          setEditingLinkCountIndex(null);
                        }
                        if (e.key === 'Escape') {
                          setEditingLinkCountIndex(null);
                          setLinkCountDraft(String(link.count || 0));
                        }
                      }}
                      className="h-7 w-16 rounded-lg bg-secondary px-2 text-[12px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                  ) : (
                    <>
                      <button
                        onClick={() => incrementHabitLinkCount(i)}
                        className="h-7 px-2.5 rounded-lg text-[12px] font-medium bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
                      >
                        {link.count || 0} times
                      </button>
                      <button
                        onClick={() => {
                          setEditingLinkCountIndex(i);
                          setLinkCountDraft(String(link.count || 0));
                        }}
                        className="h-7 w-7 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            (due.links || []).map((link, i) => (
              <LightweightLinkItem
                key={`${link.url}-${i}`}
                link={link}
                compact
                onRemove={() => handleRemoveLink(i)}
                onRename={(nextLabel) => updateLinkLabel(i, nextLabel)}
              />
            ))
          )}
        </div>
      )}

      {/* Photos inline — clickable to open full size */}
      {(due.photos || []).length > 0 && (
        <div className="flex gap-2 flex-wrap mt-2.5">
          {due.photos.map((photo, i) => (
            <button
              key={i}
              type="button"
              className="relative group/photo w-16 h-16 rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/40"
              onClick={(e) => { e.stopPropagation(); setPreviewImage(photo); }}
            >
              <img src={photo} alt="" className="w-full h-full object-cover" onClick={(e) => { e.stopPropagation(); setPreviewImage(photo); }} />
              <span className="absolute left-1 bottom-1 text-[11px] px-1 py-0.5 rounded-full bg-black/45 text-white opacity-0 group-hover/photo:opacity-100 transition-opacity">
                View
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(due.id, { photos: due.photos.filter((_, idx) => idx !== i) });
                }}
                className="absolute top-0 right-0 bg-black/55 text-white p-0.5 rounded-bl opacity-0 group-hover/photo:opacity-100"
              >
                <X size={8} />
              </button>
            </button>
          ))}
        </div>
      )}

      {/* Photo preview lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white"
            onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
          >
            <X size={20} />
          </button>
          <img
            src={previewImage}
            alt=""
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-xl bg-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Add link inline */}
      {showAddLink && (
        <div className="mt-2.5 space-y-1.5">
          <input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="https://..."
            className="w-full bg-secondary rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary" autoFocus
            onKeyDown={e => { const ne = e.nativeEvent as KeyboardEvent; if (e.key === 'Enter' && !ne.isComposing) void handleAddLink(); if (e.key === 'Escape') setShowAddLink(false); }} />
          <input value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} placeholder="Label (optional)"
            className="w-full bg-secondary rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={e => { const ne = e.nativeEvent as KeyboardEvent; if (e.key === 'Enter' && !ne.isComposing) void handleAddLink(); if (e.key === 'Escape') setShowAddLink(false); }} />
          <div className="flex gap-1.5">
            <button onClick={() => void handleAddLink()} className="text-primary" disabled={addingLink}><Check size={14} /></button>
            <button onClick={() => setShowAddLink(false)} className="text-muted-foreground"><X size={14} /></button>
          </div>
        </div>
      )}

      {/* Action buttons row */}
      <div className="mt-2.5 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {(due.links || [])[0] && (
              <a href={(due.links || [])[0].url} target="_blank" rel="noopener noreferrer"
                className="h-7 px-2.5 rounded-full text-[12px] font-medium bg-secondary hover:bg-secondary/80 text-foreground flex items-center gap-1.5 transition-colors shrink-0">
                <ExternalLink size={12} />Open
              </a>
            )}
            {isHabit ? (
              <>
            {isEditingCount ? (
              <input
                value={countDraft}
                onChange={e => setCountDraft(e.target.value.replace(/[^\d]/g, ''))}
                onBlur={() => {
                  if (!hasPerLinkCounts) {
                    setOptimisticHabitCount(Number(countDraft || 0));
                    void onSetHabitCount(due.id, Number(countDraft || 0));
                  }
                  setIsEditingCount(false);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (!hasPerLinkCounts) {
                      setOptimisticHabitCount(Number(countDraft || 0));
                      void onSetHabitCount(due.id, Number(countDraft || 0));
                    }
                    setIsEditingCount(false);
                  }
                  if (e.key === 'Escape') {
                    setCountDraft(String(displayedHabitCount || 0));
                    setIsEditingCount(false);
                  }
                }}
                className="h-7 w-16 rounded-lg bg-secondary px-2 text-[12px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            ) : (
              /* Only show global count when there are no per-link counts (i.e. no links attached) */
              !hasPerLinkCounts && (
                <>
                  <button
                    onClick={() => {
                      setOptimisticHabitCount((optimisticHabitCount ?? due.totalCount) + 1);
                      void onIncrementHabitCount(due.id);
                    }}
                    className="h-7 px-2.5 rounded-lg text-[12px] font-medium bg-secondary hover:bg-secondary/80 text-foreground transition-colors shrink-0"
                  >
                    {displayedHabitCount} times
                  </button>
                  <button
                    onClick={() => { setCountDraft(String(displayedHabitCount || 0)); setIsEditingCount(true); }}
                    className="h-7 w-7 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shrink-0"
                  >
                    <Pencil size={12} />
                  </button>
                </>
              )
            )}
              </>
            ) : (
              <button onClick={() => onUpdate(due.id, { is_completed: !due.is_completed })}
                className={cn("h-7 px-2.5 rounded-full text-[12px] font-medium flex items-center gap-1.5 transition-colors shrink-0",
                  due.is_completed ? "bg-primary/15 text-primary" : "bg-secondary hover:bg-secondary/80 text-foreground"
                )}>
                <Check size={12} />{due.is_completed ? t('dues.completedLabel') : 'Done'}
              </button>
            )}
            {!due.is_completed && (
              justAdded ? (
                <span className="h-8 px-3 rounded-lg text-[13px] font-medium text-primary flex items-center gap-1.5 shrink-0">
                  <Check size={12} />{t('dues.addedToToday')}
                </span>
              ) : due.steps.length > 0 && due.steps.some(s => !s.is_completed) ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="h-7 px-2.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                      style={{ background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}40` }}>
                      <CalendarPlus size={12} />Today
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2 space-y-1" align="start">
                    <button onClick={() => onAddToToday(due.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] hover:bg-secondary transition-colors text-foreground font-medium">
                      <Target size={12} className="text-muted-foreground" />{due.title}
                    </button>
                    <div className="border-t border-border/50 my-1" />
                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider px-2 py-0.5">Steps</p>
                    {due.steps.filter(s => !s.is_completed).map(step => (
                      <button key={step.id} onClick={() => onAddToToday(due.id, step.title)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] hover:bg-secondary transition-colors text-muted-foreground">
                        <div className="w-2.5 h-2.5 rounded-full border-2 flex-shrink-0" style={{ borderColor: accentColor }} />
                        {step.title}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              ) : (
                <button onClick={() => onAddToToday(due.id)}
                  className="h-7 px-2.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  style={{ background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}40` }}>
                  <CalendarPlus size={12} />Today
                </button>
              )
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Delete — bottom right, away from expand area */}
            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-destructive/70">Delete?</span>
                <button onClick={() => onDelete(due.id)} className="text-[11px] font-semibold text-destructive hover:underline">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-[11px] text-muted-foreground hover:text-foreground">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-destructive transition-colors">
                <Trash2 size={13} />
              </button>
            )}
            {/* Reminder bell */}
            <Popover open={showReminderPopover} onOpenChange={setShowReminderPopover}>
          <PopoverTrigger asChild>
            <button className={cn("p-1.5 rounded-lg transition-colors", hasActiveReminder ? "text-primary" : "text-muted-foreground/40 hover:text-primary")}>
              {hasActiveReminder ? <Bell size={14} /> : <BellOff size={14} />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 space-y-2" align="end">
            <p className="text-[13px] font-medium text-foreground mb-1">Reminders</p>
            {cardReminders.map(r => (
              <div key={r.id} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5">
                  {r.reminder_type === 'email' ? <Mail size={12} /> : <Bell size={12} />}
                  {formatReminderText(r)}
                </span>
                <button onClick={() => onRemoveReminder(r.id)} className="text-muted-foreground hover:text-destructive"><X size={12} /></button>
              </div>
            ))}
            {hasDeadline ? (
              <>
                <p className="text-[12px] text-muted-foreground">Browser notification</p>
                <div className="flex flex-wrap gap-1.5">
                  {REMINDER_PRESETS.map(p => (
                    <button key={p.minutes} onClick={() => { onUpsertReminder(due.id, 'browser', p.minutes); }}
                      className="px-2.5 py-1 rounded-lg text-[12px] bg-secondary hover:bg-secondary/80 transition-colors">{p.label}</button>
                  ))}
                </div>
                <p className="text-[12px] text-muted-foreground">Email</p>
                <div className="flex flex-wrap gap-1.5">
                  {REMINDER_PRESETS.map(p => (
                    <button key={p.minutes} onClick={() => { onUpsertReminder(due.id, 'email', p.minutes); }}
                      className="px-2.5 py-1 rounded-lg text-[12px] bg-secondary hover:bg-secondary/80 transition-colors">{p.label}</button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-[12px] text-muted-foreground">Recurring reminder</p>
                <div className="flex flex-wrap gap-1.5">
                  {HABIT_PRESETS.map(p => (
                    <button key={p.days} onClick={() => { onUpsertReminder(due.id, 'browser', 0, true, p.days); }}
                      className="px-2.5 py-1 rounded-lg text-[12px] bg-secondary hover:bg-secondary/80 transition-colors">{p.label}</button>
                  ))}
                </div>
              </>
            )}
          </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-primary transition-colors"><Paperclip size={14} /></button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-2 space-y-1" align="end">
                <button onClick={() => setShowAddLink(true)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] hover:bg-secondary transition-colors text-foreground">
                  <Link size={13} className="text-muted-foreground" />{t('dues.link')}
                </button>
                <button onClick={() => photoInputRef.current?.click()} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] hover:bg-secondary transition-colors text-foreground">
                  <Camera size={13} className="text-muted-foreground" />{t('dues.photo')}
                </button>
                {!hasDeadline && !isEditingDate && (
                  <button onClick={() => { setEditDate(''); setIsEditingDate(true); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] hover:bg-secondary transition-colors text-foreground">
                    <Calendar size={13} className="text-muted-foreground" />{t('dues.addDeadline')}
                  </button>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
}

type DuesViewMode = 'deadline' | 'habit';

export function DuesView({
  onBack,
  onOpenVoiceSheet,
  voiceSheetOpen,
  initialMode = 'deadline',
  lockedMode = false,
}: {
  onBack?: () => void;
  onOpenVoiceSheet?: () => void;
  voiceSheetOpen?: boolean;
  initialMode?: DuesViewMode;
  lockedMode?: boolean;
}) {
  const { t } = useLanguage();
  const { dues, addDue, addToToday, deleteDue, updateDue, addStep, toggleStep, deleteStep, reorderDues, incrementHabitCount, setHabitCount, refetch } = useDues();
  const { getRemindersForDue, upsertReminder, removeReminder } = useDueReminders();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueDateDraft, setDueDateDraft] = useState('');
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<DuesViewMode>(initialMode);
  const [habitCategory, setHabitCategory] = useState('');
  const PRESET_CATEGORIES = ['Health', 'Learning', 'Life'];
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [pendingLinks, setPendingLinks] = useState<DueLink[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const dueDateInputRef = useRef<HTMLInputElement>(null);
  const dueTimeInputRef = useRef<HTMLInputElement>(null);
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [addingPendingLink, setAddingPendingLink] = useState(false);
  const { user } = useAuth();
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [upcomingCollapsed, setUpcomingCollapsed] = useState(false);
  const [noDateCollapsed, setNoDateCollapsed] = useState(false);
  const [focusedDueId, setFocusedDueId] = useState<string | null>(null);
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [habitDropTargetId, setHabitDropTargetId] = useState<string | null>(null);
  const [showHabitDetails, setShowHabitDetails] = useState(false);
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);

  const isDeadlineMode = inputMode === 'deadline';

  useEffect(() => {
    setInputMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const interval = setInterval(refetch, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Listen for navigate-to-dues with a specific dueId to auto-expand
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.dueId) {
        setFocusedDueId(detail.dueId);
        // Auto-scroll after a tick
        setTimeout(() => {
          const el = document.getElementById(`due-card-${detail.dueId}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
      }
    };
    window.addEventListener('navigate-to-dues', handler);
    return () => window.removeEventListener('navigate-to-dues', handler);
  }, []);





  const uploadPhotoFile = useCallback(async (file: File): Promise<string | null> => {
    if (!user || file.size > 5 * 1024 * 1024) return null;
    const ext = file.type.split('/')[1] || file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('moment-photos').upload(path, file);
    if (error) return null;
    const { data: urlData } = supabase.storage.from('moment-photos').getPublicUrl(path);
    return urlData?.publicUrl ?? null;
  }, [user]);

  const handlePhotoUploadForNew = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    for (const file of Array.from(files)) {
      const url = await uploadPhotoFile(file);
      if (url) setPendingPhotos(prev => [...prev, url]);
    }
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleAddPendingLink = useCallback(async (rawUrl?: string) => {
    const url = normalizeUrl(rawUrl ?? newLinkUrl);
    if (!url) {
      toast.error('Invalid link');
      return false;
    }
    const existingLink = pendingLinks.find(link => link.url === url);
    if (existingLink && hasRichPreview(existingLink)) {
      setNewLinkUrl('');
      setNewLinkLabel('');
      return true;
    }

    setAddingPendingLink(true);
    try {
      const siteFallback = getSiteFallback(url);
      if (!existingLink) {
        setPendingLinks(prev => [
          ...prev,
          { url, label: newLinkLabel.trim() || siteFallback, title: siteFallback, siteName: siteFallback },
        ]);
      }
      setNewLinkUrl('');
      setNewLinkLabel('');

      const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } });
      if (error) {
        console.error('Pending due link preview failed:', error);
        toast.warning('Preview unavailable, link added anyway');
        return true;
      }
      setPendingLinks(prev => prev.map(link => link.url === url ? {
        ...link,
        label: newLinkLabel.trim() || data?.title || data?.siteName || siteFallback,
        title: typeof data?.title === 'string' ? data.title : link.title,
        description: typeof data?.description === 'string' ? data.description : link.description,
        image: typeof data?.image === 'string' ? data.image : link.image,
        siteName: typeof data?.siteName === 'string' ? data.siteName : link.siteName,
      } : link));
      return true;
    } catch (err) {
      console.error('Pending due link preview exception:', err);
      toast.warning('Preview unavailable, link added anyway');
      return true;
    } finally {
      setAddingPendingLink(false);
    }
  }, [newLinkUrl, newLinkLabel, pendingLinks]);

  // Use shared date parser
  const parseDateFromTitle = (raw: string) => {
    const result = parseDateFromTextShared(raw);
    return { cleanTitle: result.cleanTitle, parsedDate: result.parsedDate };
  };

  const DUE_DATE_EDITABLE_POSITIONS = [0, 1, 3, 4, 6, 7, 8, 9, 12, 13, 15, 16] as const;
  const DUE_DATE_FIELDS = [
    [0, 1],
    [3, 4],
    [6, 7, 8, 9],
    [12, 13],
    [15, 16],
  ] as const;

  const getDefaultDueDateDraft = useCallback(() => {
    const now = new Date();
    return `${format(now, 'MM')}/__/` + `${format(now, 'yyyy')}, 23:59`;
  }, []);

  const parseManualDueDate = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})$/);
    if (!match) return null;

    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);

    const candidate = new Date(year, month - 1, day, hour, minute);
    if (
      Number.isNaN(candidate.getTime()) ||
      candidate.getFullYear() !== year ||
      candidate.getMonth() + 1 !== month ||
      candidate.getDate() !== day ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }

    return format(candidate, "yyyy-MM-dd'T'HH:mm");
  }, []);

  const formatManualDueDate = useCallback((value: string) => {
    try {
      return format(parseISO(value), 'MM/dd/yyyy, HH:mm');
    } catch {
      return value;
    }
  }, []);

  const replaceDraftChar = useCallback((draft: string, index: number, char: string) => {
    return `${draft.slice(0, index)}${char}${draft.slice(index + 1)}`;
  }, []);

  const findEditablePosition = useCallback((cursor: number, direction: 'forward' | 'backward') => {
    const positions = [...DUE_DATE_EDITABLE_POSITIONS];
    if (direction === 'forward') {
      return positions.find(pos => pos >= cursor) ?? positions[positions.length - 1];
    }
    for (let i = positions.length - 1; i >= 0; i -= 1) {
      if (positions[i] < cursor) return positions[i];
    }
    return positions[0];
  }, []);

  const getFieldForPosition = useCallback((cursor: number) => {
    return DUE_DATE_FIELDS.find(field => {
      const first = field[0];
      const last = field[field.length - 1];
      return cursor >= first && cursor <= last;
    }) ?? DUE_DATE_FIELDS[0];
  }, []);

  const findTargetInField = useCallback((draft: string, field: readonly number[], cursor: number) => {
    const blankInField = field.find(pos => draft[pos] === '_');
    if (blankInField !== undefined) return blankInField;
    return field.find(pos => pos >= cursor) ?? field[field.length - 1];
  }, []);

  const findNextCursorAfterField = useCallback((draft: string, field: readonly number[], currentPos: number) => {
    const nextInField = field.find(pos => pos > currentPos && draft[pos] === '_');
    if (nextInField !== undefined) return nextInField;

    const fieldIndex = DUE_DATE_FIELDS.findIndex(candidate => candidate === field);
    for (let i = fieldIndex + 1; i < DUE_DATE_FIELDS.length; i += 1) {
      const nextFieldBlank = DUE_DATE_FIELDS[i].find(pos => draft[pos] === '_');
      if (nextFieldBlank !== undefined) return nextFieldBlank;
    }

    return field[field.length - 1];
  }, []);

  const findFieldEndCursor = useCallback((field: readonly number[]) => {
    return field[field.length - 1] + 1;
  }, []);

  const findImmediateNextFieldStart = useCallback((field: readonly number[]) => {
    const fieldIndex = DUE_DATE_FIELDS.findIndex(candidate => candidate === field);
    const nextField = DUE_DATE_FIELDS[fieldIndex + 1];
    return nextField ? nextField[0] : findFieldEndCursor(field);
  }, [findFieldEndCursor]);

  const findCursorAfterFilledField = useCallback((field: readonly number[]) => {
    return field === DUE_DATE_FIELDS[0]
      ? findImmediateNextFieldStart(field)
      : findFieldEndCursor(field);
  }, [findFieldEndCursor, findImmediateNextFieldStart]);

  const setInputCursor = useCallback((position: number) => {
    requestAnimationFrame(() => {
      dueDateInputRef.current?.setSelectionRange(position, position);
    });
  }, []);

  const commitDueDateDraft = useCallback(() => {
    if (!dueDateDraft.trim()) {
      setDueDate('');
      setDueDateDraft(getDefaultDueDateDraft());
      return;
    }
    if (dueDateDraft.includes('_')) {
      setDueDate('');
      setDueDateDraft(dueDateDraft || getDefaultDueDateDraft());
      return;
    }
    const parsed = parseManualDueDate(dueDateDraft);
    if (parsed === null) {
      if (dueDateDraft.trim() === getDefaultDueDateDraft().trim()) {
        setDueDate('');
        setDueDateDraft(getDefaultDueDateDraft());
        return;
      }
      toast.error('Invalid deadline');
      setDueDateDraft(dueDate ? formatManualDueDate(dueDate) : getDefaultDueDateDraft());
      return;
    }
    setDueDate(parsed);
    setDueDateDraft(formatManualDueDate(parsed));
  }, [dueDate, dueDateDraft, formatManualDueDate, getDefaultDueDateDraft, parseManualDueDate]);

  const getNativeDueParts = useCallback(() => {
    if (!dueDate) return { date: '', time: '23:59' };
    try {
      const parsed = parseISO(dueDate);
      return {
        date: format(parsed, 'yyyy-MM-dd'),
        time: format(parsed, 'HH:mm'),
      };
    } catch {
      return { date: '', time: '23:59' };
    }
  }, [dueDate]);

  const applyNativeDueDate = useCallback((datePart: string, timePart = '23:59') => {
    if (!datePart) {
      setDueDate('');
      setDueDateDraft(getDefaultDueDateDraft());
      return;
    }

    const next = `${datePart}T${timePart || '23:59'}`;
    setDueDate(next);
    setDueDateDraft(formatManualDueDate(next));
  }, [formatManualDueDate, getDefaultDueDateDraft]);

  useEffect(() => {
    if (isDeadlineMode && !dueDate && !dueDateDraft) {
      setDueDateDraft(getDefaultDueDateDraft());
    }
  }, [dueDate, dueDateDraft, getDefaultDueDateDraft, isDeadlineMode]);

  const handleTitleInputChange = useCallback((value: string) => {
    const pastedUrl = extractFirstUrl(value);
    if (pastedUrl) {
      const withoutUrl = value.replace(pastedUrl, '').replace(/\s{2,}/g, ' ').trim();
      setTitle(withoutUrl);
      void handleAddPendingLink(pastedUrl);
      return;
    }
    setTitle(value);
  }, [handleAddPendingLink]);

  const updatePendingLinkLabel = useCallback((index: number, nextLabel: string) => {
    setPendingLinks(prev => prev.map((link, i) => i === index ? { ...link, label: nextLabel } : link));
  }, []);

  const handleAdd = async () => {
    if (!title.trim()) return;
    let finalTitle = title.trim();
    let finalDueDate = dueDate || '';

    // Auto-parse date from title if no manual due date set
    if (inputMode === 'deadline' && !finalDueDate) {
      const { cleanTitle, parsedDate } = parseDateFromTitle(finalTitle);
      if (parsedDate) {
        finalTitle = cleanTitle;
        finalDueDate = parsedDate;
      }
    }

    // Only pass habit_category if explicitly in habit mode
    const category = inputMode === 'habit' ? (habitCategory || 'Uncategorized') : undefined;
    await addDue(finalTitle, inputMode === 'deadline' ? (finalDueDate || undefined) : undefined, category);
    // After adding, refetch to get the new due's ID for attaching links/photos
    if (pendingLinks.length > 0 || pendingPhotos.length > 0) {
      await refetch();
    }
    // Use a short delay + re-read to find the new due
    if (pendingLinks.length > 0 || pendingPhotos.length > 0) {
      // Refetch again to ensure we have the latest data
      const { data: freshData } = await supabase
        .from('todos')
        .select('*')
        .like('date', '_due_%')
        .eq('title', finalTitle)
        .order('created_at', { ascending: false })
        .limit(1);
      if (freshData && freshData.length > 0) {
        const newDueId = freshData[0].id;
        if (pendingLinks.length > 0) await updateDue(newDueId, { links: pendingLinks });
        if (pendingPhotos.length > 0) await updateDue(newDueId, { photos: pendingPhotos });
      }
    }
    setTitle(''); setDueDate(''); setDueDateDraft(getDefaultDueDateDraft()); setHabitCategory('');
    setPendingLinks([]); setPendingPhotos([]); setShowPlusMenu(false);
    await refetch();
  };

  const handleAddToToday = async (id: string, stepTitle?: string) => {
    await addToToday(id, stepTitle);
    setJustAdded(id);
    setTimeout(() => setJustAdded(null), 2000);
  };

  const getRemindersForDueTree = useCallback((due: DueWithStats) => {
    return [
      ...getRemindersForDue(due.id),
      ...due.steps.flatMap(step => getRemindersForDue(step.id)),
    ];
  }, [getRemindersForDue]);

  const activeDues = dues.filter(d => !d.is_completed);
  const allCompletedDues = dues.filter(d => d.is_completed);

  // Separate habits from deadlines — habit_category distinguishes them
  const activeHabits = activeDues.filter(d => d.habit_category !== null);
  const activeDeadlines = activeDues.filter(d => d.habit_category === null);
  const completedDues = lockedMode
    ? allCompletedDues.filter(d => isDeadlineMode ? d.habit_category === null : d.habit_category !== null)
    : allCompletedDues;
  const visibleActiveCount = lockedMode
    ? (isDeadlineMode ? activeDeadlines.length : activeHabits.length)
    : activeDues.length;
  const hasFutureCommitments = visibleActiveCount > 0;
  const viewTitle = lockedMode ? (isDeadlineMode ? 'Deadlines' : 'Habits') : 'Commitments';
  const viewSubtitle = lockedMode
    ? (isDeadlineMode ? 'Due once. Pull the next one into Today.' : 'Small repeatable routines.')
    : 'Deadlines are due once. Habits repeat.';

  const noDateDeadlines = activeDeadlines.filter(d => !d.due_date);

  const todayUrgent = activeDeadlines.filter(d => {
    if (!d.due_date) return false;
    const dueDate = parseISO(d.due_date);
    const daysLeft = differenceInDays(dueDate, new Date());
    return daysLeft <= 3;
  });

  const upcoming = activeDeadlines.filter(d => {
    if (!d.due_date) return false;
    const daysLeft = differenceInDays(parseISO(d.due_date), new Date());
    return daysLeft > 3;
  });

  const moveHabitBefore = useCallback(async (draggedId: string, targetId: string) => {
    if (!draggedId || !targetId || draggedId === targetId) return;
    const reordered = [...activeHabits];
    const fromIndex = reordered.findIndex(item => item.id === draggedId);
    const toIndex = reordered.findIndex(item => item.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    await reorderDues(reordered.map(item => item.id));
  }, [activeHabits, reorderDues]);

  return (
    <div className="flex h-full w-full max-w-[1040px] mx-auto flex-col overflow-y-auto px-5 pb-4 pt-3">

      {!hasFutureCommitments && !lockedMode && (
        <div className="mb-5">
          <div className="rounded-[30px] border border-border/70 bg-[hsl(var(--surface-soft))] px-5 py-4 shadow-[0_10px_28px_hsl(var(--foreground)/0.05)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/55">
                  Future Commitments
                </p>
                <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-foreground">
                  Deadlines and habits
                </h1>
                <p className="mt-1 max-w-[54ch] text-[14px] leading-6 text-muted-foreground">
                  Keep future work visible here, then pull the next actionable thing into Today.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="min-w-[132px] rounded-[20px] border border-[rgba(232,130,90,0.16)] bg-[rgba(232,130,90,0.07)] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#e8825a]/78">Deadlines</p>
                  <div className="mt-1 flex items-end gap-2">
                    <p className="text-[20px] font-semibold leading-none text-foreground">{activeDeadlines.length}</p>
                    <p className="text-[11px] text-muted-foreground">{todayUrgent.length} urgent</p>
                  </div>
                </div>
                <div className="min-w-[132px] rounded-[20px] border border-[rgba(45,212,191,0.18)] bg-[rgba(45,212,191,0.07)] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#2dd4bf]/78">Habits</p>
                  <div className="mt-1 flex items-end gap-2">
                    <p className="text-[20px] font-semibold leading-none text-foreground">{activeHabits.length}</p>
                    <p className="text-[11px] text-muted-foreground">repeatable</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-background px-3 py-1.5 text-[12px] text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.7)]">
                Move the next actionable item into Today.
              </div>
              {noDateDeadlines.length > 0 ? (
                <div className="rounded-full bg-[rgba(232,130,90,0.08)] px-3 py-1.5 text-[12px] text-[#b96644] shadow-[inset_0_0_0_1px_rgba(232,130,90,0.18)]">
                  {noDateDeadlines.length} deadline{noDateDeadlines.length > 1 ? 's' : ''} still missing a date
                </div>
              ) : (
                <div className="rounded-full bg-background px-3 py-1.5 text-[12px] text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.7)]">
                  {upcoming.length} upcoming deadline{upcoming.length === 1 ? '' : 's'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasFutureCommitments && lockedMode && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[19px] font-semibold tracking-[-0.03em] text-foreground">{viewTitle}</h2>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground/48">
              {viewSubtitle}
            </p>
          </div>
          <div className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-semibold',
            isDeadlineMode
              ? 'bg-[rgba(232,130,90,0.08)] text-[#c86e4a]'
              : 'bg-[rgba(45,212,191,0.1)] text-[#1f9f91]'
          )}>
            0 active
          </div>
        </div>
      )}

      {hasFutureCommitments && (
        <div className="mb-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[19px] font-semibold tracking-[-0.03em] text-foreground">{viewTitle}</h2>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground/48">
                {viewSubtitle}
              </p>
            </div>
          {!lockedMode && (
          <div className="flex gap-1.5">
            <button
              onClick={() => setInputMode('deadline')}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all',
                isDeadlineMode
                  ? 'border-[rgba(232,130,90,0.32)] bg-[rgba(232,130,90,0.11)] text-[#d97750] shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <Clock size={14} />
              <span>{t('dues.deadline')}</span>
              <span className={cn(
                'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                isDeadlineMode ? 'bg-white/80 text-[#d97750]' : 'bg-muted text-muted-foreground'
              )}>
                {activeDeadlines.length}
              </span>
            </button>
            <button
              onClick={() => setInputMode('habit')}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all',
                !isDeadlineMode
                  ? 'border-[rgba(45,212,191,0.32)] bg-[rgba(45,212,191,0.11)] text-[#1fae9e] shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <Repeat size={14} />
              <span>{t('dues.habit')}</span>
              <span className={cn(
                'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                !isDeadlineMode ? 'bg-white/80 text-[#1fae9e]' : 'bg-muted text-muted-foreground'
              )}>
                {activeHabits.length}
              </span>
            </button>
          </div>
          )}
          </div>
        </div>
      )}

      {/* Bottom composer — shared by Deadlines and Habits */}
      <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUploadForNew} />
      {!voiceSheetOpen && <div className="order-last sticky bottom-2 z-40 mx-auto mt-4 mb-1 w-full max-w-[720px] rounded-[22px] bg-background/76 p-1 backdrop-blur-xl shadow-[0_14px_34px_rgba(80,68,58,0.11)]">
        <div className="bg-card/95 border border-border/70 rounded-[18px] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.025)]">
          {/* Pending attachments preview */}
          {(pendingLinks.length > 0 || pendingPhotos.length > 0) && (
            <div className="px-4 pt-3 flex flex-wrap gap-2">
              {pendingLinks.map((link, i) => (
                isDeadlineMode ? (
                  <LightweightLinkItem
                    key={`${link.url}-${i}`}
                    link={link}
                    compact
                    onRemove={() => setPendingLinks(prev => prev.filter((_, idx) => idx !== i))}
                    onRename={(nextLabel) => updatePendingLinkLabel(i, nextLabel)}
                  />
                ) : (
                  <LinkPreviewCard
                    key={`${link.url}-${i}`}
                    preview={{
                      url: link.url,
                      title: link.title || link.label,
                      description: link.description,
                      image: link.image,
                      siteName: link.siteName,
                    }}
                    compact
                    className="max-w-[320px]"
                    onRemove={() => setPendingLinks(prev => prev.filter((_, idx) => idx !== i))}
                  />
                )
              ))}
              {pendingPhotos.map((photo, i) => (
                <div key={i} className="relative w-8 h-8 rounded-lg overflow-hidden">
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setPendingPhotos(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0 right-0 bg-black/50 text-white p-0.5 rounded-bl"><X size={8} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="px-2 py-2">
            <div className="flex items-center gap-2.5 min-h-[38px] rounded-[15px] bg-[hsl(var(--surface-soft))] px-3 py-1">
            {/* Plus menu */}
            <Popover open={showPlusMenu} onOpenChange={setShowPlusMenu}>
              <PopoverTrigger asChild>
                <button className="h-7 w-7 rounded-full bg-background/75 hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 shadow-[inset_0_0_0_1px_hsl(var(--border)/0.55)]">
                  <Plus size={14} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2 space-y-1.5" align="start" side="top">
                <button onClick={() => { photoInputRef.current?.click(); setShowPlusMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] hover:bg-secondary transition-colors">
                  <Camera size={14} className="text-muted-foreground" />{t('dues.photo')}
                </button>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 px-3 py-1">
                    <Link size={14} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-[12px] text-muted-foreground">{t('dues.link')}</span>
                  </div>
                  <input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="https://..."
                    className="w-full bg-secondary rounded-lg px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary"
                    onKeyDown={e => { const ne = e.nativeEvent as KeyboardEvent; if (e.key === 'Enter' && !ne.isComposing) void handleAddPendingLink(); }} />
                  <input value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} placeholder={t('dues.labelOptional')}
                    className="w-full bg-secondary rounded-lg px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary"
                    onKeyDown={e => { const ne = e.nativeEvent as KeyboardEvent; if (e.key === 'Enter' && !ne.isComposing) void handleAddPendingLink(); }} />
                  {newLinkUrl.trim() && (
                    <button onClick={() => void handleAddPendingLink()} className="text-[12px] text-primary hover:underline w-full text-left px-1" disabled={addingPendingLink}>{t('dues.addBtn')}</button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <input value={title} onChange={e => handleTitleInputChange(e.target.value)}
              onPaste={(e) => {
                const imageItem = Array.from(e.clipboardData.items).find(item => item.type.startsWith('image/'));
                if (imageItem) {
                  e.preventDefault();
                  const file = imageItem.getAsFile();
                  if (file) void uploadPhotoFile(file).then(url => { if (url) setPendingPhotos(prev => [...prev, url]); });
                  return;
                }
                const pastedText = e.clipboardData.getData('text/plain');
                const pastedUrl = extractFirstUrl(pastedText);
                if (pastedUrl && isStandaloneUrl(pastedUrl)) {
                  e.preventDefault();
                  void handleAddPendingLink(pastedUrl);
                }
              }}
              placeholder={isDeadlineMode ? t('dues.deadlinePlaceholder') : t('dues.habitPlaceholder')}
              onKeyDown={e => {
                const native = e.nativeEvent as KeyboardEvent;
                if (e.key === 'Enter') {
                  if (isImeComposing(native)) return;
                  handleAdd();
                }
              }}
              className="flex-1 bg-transparent focus:outline-none text-[14px] font-medium text-foreground placeholder:text-muted-foreground/58" />
            {onOpenVoiceSheet && (
              <button
                onClick={onOpenVoiceSheet}
                className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all text-muted-foreground hover:text-foreground hover:bg-background/80"
              >
                <Mic size={14} />
              </button>
            )}
            <Button onClick={handleAdd} disabled={!title.trim()} size="icon" className="h-7 w-7 rounded-full bg-[#dfb9a8] hover:bg-[#d6aa96] text-white shadow-none disabled:opacity-35">
              <ArrowUp size={14} />
            </Button>
            </div>
          </div>
          {isDeadlineMode && (
            <div className="px-2 pb-2">
              {(() => {
                const parts = getNativeDueParts();
                return (
              <div className="flex items-center gap-2 rounded-[16px] border border-border/45 bg-[hsl(var(--surface-soft))] px-2.5 py-2 text-muted-foreground/80">
                <button
                  type="button"
                  onClick={() => {
                    const input = dueDateInputRef.current;
                    input?.focus();
                    input?.showPicker?.();
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/72 transition-colors hover:bg-background/85 hover:text-foreground"
                  aria-label="Choose due date"
                >
                  <Calendar size={15} />
                </button>
                <label className="min-w-0 flex-1">
                  <span className="mb-0.5 block text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground/45">Due date</span>
                  <input
                    ref={dueDateInputRef}
                    type="date"
                    value={parts.date}
                    onChange={(e) => applyNativeDueDate(e.target.value, parts.time)}
                    className="datetime-input-iconless w-full min-w-0 bg-transparent text-[13px] font-medium text-foreground/82 focus:outline-none"
                  />
                </label>
                <label className="w-[82px] shrink-0">
                  <span className="mb-0.5 block text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground/45">Time</span>
                  <input
                    ref={dueTimeInputRef}
                    type="time"
                    value={parts.time}
                    onChange={(e) => applyNativeDueDate(parts.date || format(new Date(), 'yyyy-MM-dd'), e.target.value)}
                    className="datetime-input-iconless w-full bg-transparent text-[13px] font-medium text-foreground/82 focus:outline-none"
                  />
                </label>
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => applyNativeDueDate('', '23:59')}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/45 transition-colors hover:bg-background/85 hover:text-destructive"
                    aria-label="Clear due date"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
                );
              })()}
            </div>
          )}
          {!isDeadlineMode && (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-border/45">
              <span className="text-[11px] text-muted-foreground/65">Category</span>
              <div className="flex gap-1.5 flex-1 flex-wrap">
                {PRESET_CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setHabitCategory(habitCategory === cat ? '' : cat)}
                    className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors",
                      habitCategory === cat ? "bg-[#2dd4bf]/15 text-[#2dd4bf]" : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}>{cat}</button>
                ))}
                <input value={habitCategory && !PRESET_CATEGORIES.includes(habitCategory) ? habitCategory : ''}
                  onChange={e => setHabitCategory(e.target.value)}
                  placeholder="Custom..."
                  className="bg-transparent text-[12px] text-muted-foreground focus:outline-none w-20"
                  onKeyDown={e => {
                    const ne = e.nativeEvent as KeyboardEvent;
                    if (e.key === 'Enter') {
                      if (isImeComposing(ne)) return;
                      handleAdd();
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>}

      <div className="mb-8">
        {isDeadlineMode ? (
          <div className="min-w-0">
          {/* Today / Urgent */}
          {todayUrgent.length > 0 && (
            <div className="mb-5">
              <h2 className="text-[12px] text-muted-foreground/62 uppercase tracking-[0.16em] mb-2.5 flex items-center gap-2" >
                <Target size={14} />
                {t('dues.todayUrgent')}
              </h2>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
                {todayUrgent.map(due => (
                  <DueCard key={due.id} due={due} onUpdate={updateDue} onDelete={deleteDue}
                    onAddToToday={handleAddToToday} justAdded={justAdded === due.id}
                    dueReminders={getRemindersForDueTree(due)} onUpsertReminder={upsertReminder} onRemoveReminder={removeReminder}
                    onAddStep={addStep} onToggleStep={toggleStep} onDeleteStep={deleteStep}
                    onIncrementHabitCount={incrementHabitCount} onSetHabitCount={setHabitCount} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="mb-5">
              <button onClick={() => setUpcomingCollapsed(!upcomingCollapsed)}
                className="w-full flex items-center justify-between text-[12px] text-muted-foreground/62 uppercase tracking-[0.16em] mb-2.5 hover:text-muted-foreground transition-colors" >
                <span className="flex items-center gap-2">
                  <Calendar size={14} />
                  {t('dues.upcoming')} ({upcoming.length})
                </span>
                {upcomingCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
              {!upcomingCollapsed && (
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
                  {upcoming.map(due => (
                    <DueCard key={due.id} due={due} onUpdate={updateDue} onDelete={deleteDue}
                      onAddToToday={handleAddToToday} justAdded={justAdded === due.id}
                      dueReminders={getRemindersForDueTree(due)} onUpsertReminder={upsertReminder} onRemoveReminder={removeReminder}
                      onAddStep={addStep} onToggleStep={toggleStep} onDeleteStep={deleteStep}
                      onIncrementHabitCount={incrementHabitCount} onSetHabitCount={setHabitCount} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No date yet */}
          {noDateDeadlines.length > 0 && (
            <div className="mb-5">
              <button onClick={() => setNoDateCollapsed(!noDateCollapsed)}
                className="w-full flex items-center justify-between text-[12px] text-muted-foreground/62 uppercase tracking-[0.16em] mb-2.5 hover:text-muted-foreground transition-colors">
                <span className="flex items-center gap-2">
                  <Calendar size={14} />
                  No date yet ({noDateDeadlines.length})
                </span>
                {noDateCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
              {!noDateCollapsed && (
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
                  {noDateDeadlines.map(due => (
                    <DueCard key={due.id} due={due} onUpdate={updateDue} onDelete={deleteDue}
                      onAddToToday={handleAddToToday} justAdded={justAdded === due.id}
                      dueReminders={getRemindersForDueTree(due)} onUpsertReminder={upsertReminder} onRemoveReminder={removeReminder}
                      onAddStep={addStep} onToggleStep={toggleStep} onDeleteStep={deleteStep}
                      onIncrementHabitCount={incrementHabitCount} onSetHabitCount={setHabitCount} />
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        ) : activeHabits.length > 0 ? (
          <div className="rounded-[22px] border border-border/45 bg-background/35 px-3 py-3">
            <div className="mb-3 flex items-center justify-between gap-3 px-0.5">
              <h2 className="text-[12px] text-muted-foreground/65 uppercase tracking-[0.16em] flex items-center gap-2" >
                <Repeat size={14} className="text-[#2dd4bf]" />
                Habits ({activeHabits.length})
              </h2>
              <button
                onClick={() => {
                  setShowHabitDetails(prev => !prev);
                  setExpandedHabitId(null);
                }}
                className="rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--text-soft))] transition-colors hover:text-foreground"
              >
                {showHabitDetails ? 'Close' : 'Manage'}
              </button>
            </div>
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
            >
              {activeHabits.map(due => showHabitDetails ? (
                <div
                  key={due.id}
                  draggable
                  onDragStart={() => {
                    setDraggedHabitId(due.id);
                    setHabitDropTargetId(due.id);
                  }}
                  onDragEnd={() => {
                    setDraggedHabitId(null);
                    setHabitDropTargetId(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (habitDropTargetId !== due.id) setHabitDropTargetId(due.id);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const currentDraggedId = draggedHabitId;
                    setDraggedHabitId(null);
                    setHabitDropTargetId(null);
                    if (currentDraggedId) {
                      await moveHabitBefore(currentDraggedId, due.id);
                    }
                  }}
                  className={cn(
                    "rounded-[22px] transition-all",
                    draggedHabitId === due.id && "opacity-60 scale-[0.985]",
                    habitDropTargetId === due.id && draggedHabitId !== due.id && "ring-2 ring-[#2dd4bf]/35 ring-offset-2 ring-offset-background"
                  )}
                >
                  <DueCard due={due} onUpdate={updateDue} onDelete={deleteDue}
                    onAddToToday={handleAddToToday} justAdded={justAdded === due.id}
                    dueReminders={getRemindersForDueTree(due)} onUpsertReminder={upsertReminder} onRemoveReminder={removeReminder}
                    onAddStep={addStep} onToggleStep={toggleStep} onDeleteStep={deleteStep}
                    onIncrementHabitCount={incrementHabitCount} onSetHabitCount={setHabitCount} />
                </div>
              ) : expandedHabitId === due.id ? (
                <div key={due.id} className="rounded-[22px] border border-[#2dd4bf]/22 bg-[rgba(45,212,191,0.03)]">
                  <button
                    onClick={() => setExpandedHabitId(null)}
                    className="w-full flex items-center justify-center py-1.5 text-muted-foreground/35 hover:text-muted-foreground transition-colors"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <div className="px-1 pb-1">
                    <DueCard due={due} onUpdate={updateDue} onDelete={deleteDue}
                      onAddToToday={handleAddToToday} justAdded={justAdded === due.id}
                      dueReminders={getRemindersForDueTree(due)} onUpsertReminder={upsertReminder} onRemoveReminder={removeReminder}
                      onAddStep={addStep} onToggleStep={toggleStep} onDeleteStep={deleteStep}
                      onIncrementHabitCount={incrementHabitCount} onSetHabitCount={setHabitCount} />
                  </div>
                </div>
              ) : (
                <CompactHabitCard
                  key={due.id}
                  due={due}
                  expanded={expandedHabitId === due.id}
                  onToggleExpand={() => setExpandedHabitId(current => current === due.id ? null : due.id)}
                  onIncrement={() => incrementHabitCount(due.id)}
                  onManage={() => setExpandedHabitId(due.id)}
                  onUpdateLinks={(links) => updateDue(due.id, { links })}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Empty */}
      {visibleActiveCount === 0 && (
        <div>
          <p className="text-[13px] text-muted-foreground/65 text-center py-10 italic">
            {lockedMode
              ? (isDeadlineMode ? 'No deadlines yet.' : 'No habits yet.')
              : t('dues.empty')}
          </p>
        </div>
      )}

      {/* Completed - collapsible */}
      {completedDues.length > 0 && (
        <div className="mb-8">
          <button onClick={() => setCompletedCollapsed(!completedCollapsed)}
            className="w-full flex items-center justify-between text-[13px] text-muted-foreground/50 uppercase tracking-wider mb-4 hover:text-muted-foreground transition-colors" >
            <span>{t('dues.completed')} ({completedDues.length})</span>
            {completedCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          {!completedCollapsed && (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
              {completedDues.map(due => (
                <DueCard key={due.id} due={due} onUpdate={updateDue} onDelete={deleteDue}
                  onAddToToday={handleAddToToday} justAdded={false}
                  dueReminders={getRemindersForDueTree(due)} onUpsertReminder={upsertReminder} onRemoveReminder={removeReminder}
                  onAddStep={addStep} onToggleStep={toggleStep} onDeleteStep={deleteStep}
                  onIncrementHabitCount={incrementHabitCount} onSetHabitCount={setHabitCount} />
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
