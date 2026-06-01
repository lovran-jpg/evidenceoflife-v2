import { useState, useEffect, useRef } from 'react';
import { parseISO } from 'date-fns';
import { Plus, Calendar, Trash2, CalendarPlus, Check, Repeat, Pencil, X, Link, ExternalLink, Target, Camera, Bell, BellOff, Mail, ChevronDown, ChevronUp, Paperclip } from 'lucide-react';
import { cn, isImeComposing } from '@/lib/utils';
import {
  normalizeUrl,
  getDomain as getSiteFallback,
} from '@/lib/linkUtils';
import { DueWithStats, DueLink } from '@/hooks/useDues';
import { DueReminder } from '@/hooks/useDueReminders';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useDateLocale } from '@/hooks/useDateLocale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LinkPreviewCard } from '@/components/LinkPreviewCard';
import { hasRichPreview, LightweightLinkItem } from '@/components/views/dues/DueLinkItems';
import { getTimeLeft, formatDuration, HabitPunchCard } from '@/components/views/dues/DueCards';
import { toast } from 'sonner';

/* ── Due Card (Redesigned) ── */
export function DueCard({ due, onUpdate, onDelete, onAddToToday, justAdded, dueReminders, onUpsertReminder, onRemoveReminder, onAddStep, onToggleStep, onDeleteStep, onIncrementHabitCount, onSetHabitCount }: {
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
