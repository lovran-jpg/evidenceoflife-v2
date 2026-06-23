import { useState, useMemo, useRef, useEffect, KeyboardEvent } from 'react';
import { format } from 'date-fns';
import { Check, Plus, MoreHorizontal, Trash2, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDues, type DueWithStats } from '@/hooks/useDues';
import { useDueReminders } from '@/hooks/useDueReminders';
import { useLanguage } from '@/hooks/useLanguage';
import { cn, isImeComposing } from '@/lib/utils';
import { showUndoToast } from '@/lib/undoToast';
import { SheetHeader, SheetEmptyState } from '@/components/sheet/SheetShell';
import { DueCard } from '@/components/views/dues/DueCard';

/**
 * Habits, redesigned to a single repeating action: tap the ring to check in.
 * Tap the title to rename it inline. Tap the chevron / row body to expand a
 * full DueCard accordion in place — no sheets, no side drawers, no extra
 * page transitions. Everything edits without taking you off this view.
 */
export function HabitsView() {
  const { lang } = useLanguage();
  const {
    dues,
    addDue,
    addToToday,
    deleteDue,
    updateDue,
    addStep,
    toggleStep,
    deleteStep,
    incrementHabitCount,
    setHabitCount,
    refetch,
  } = useDues();
  const { getRemindersForDue, upsertReminder, removeReminder } = useDueReminders();

  const [draft, setDraft] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const draftRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = setInterval(refetch, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  const habits = useMemo(
    () => dues.filter(d => d.habit_category !== null && !d.is_completed),
    [dues],
  );

  const getRemindersForDueTree = (due: DueWithStats) => {
    const ids = [due.id, ...due.steps.map(s => s.id)];
    return ids.flatMap(id => getRemindersForDue(id));
  };

  const handleAdd = async () => {
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    await addDue(title, undefined, 'Uncategorized');
    draftRef.current?.focus();
  };

  const handleDelete = (due: DueWithStats) => {
    deleteDue(due.id);
    if (expandedId === due.id) setExpandedId(null);
    showUndoToast({
      description: lang === 'zh' ? `已删除"${due.title}"` : `Deleted "${due.title}"`,
      undoLabel: lang === 'zh' ? '撤销' : 'Undo',
      onUndo: () => {
        void addDue(due.title, undefined, due.habit_category || 'Uncategorized');
      },
    });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <SheetHeader title={lang === 'zh' ? '习惯' : 'Habits'} />

      <div className="flex-1 overflow-y-auto">
        {habits.length === 0 ? (
          <SheetEmptyState
            className="mt-16"
            title={lang === 'zh' ? '还没有习惯' : 'No habits yet'}
            hint={
              lang === 'zh'
                ? '在下方输入想坚持的小事,比如"喝水"。'
                : 'Type something repeatable below, like "drink water".'
            }
          />
        ) : (
          <ul className="divide-y divide-border/45 px-5">
            {habits.map(habit => (
              <HabitRow
                key={habit.id}
                habit={habit}
                expanded={expandedId === habit.id}
                onToggleExpand={() =>
                  setExpandedId(prev => (prev === habit.id ? null : habit.id))
                }
                onIncrement={() => incrementHabitCount(habit.id)}
                onRename={(nextTitle) => {
                  const trimmed = nextTitle.trim();
                  if (trimmed && trimmed !== habit.title) {
                    void updateDue(habit.id, { title: trimmed });
                  }
                }}
                onDelete={() => handleDelete(habit)}
                detail={
                  expandedId === habit.id ? (
                    <DueCard
                      due={habit}
                      onUpdate={updateDue}
                      onDelete={(id) => {
                        setExpandedId(null);
                        deleteDue(id);
                      }}
                      onAddToToday={addToToday}
                      justAdded={false}
                      dueReminders={getRemindersForDueTree(habit)}
                      onUpsertReminder={upsertReminder}
                      onRemoveReminder={removeReminder}
                      onAddStep={addStep}
                      onToggleStep={toggleStep}
                      onDeleteStep={deleteStep}
                      onIncrementHabitCount={incrementHabitCount}
                      onSetHabitCount={setHabitCount}
                    />
                  ) : null
                }
              />
            ))}
          </ul>
        )}

        <div className="mt-2 flex items-center gap-2.5 px-5 pb-6 pt-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--surface-soft))] text-muted-foreground/60">
            <Plus size={16} />
          </span>
          <input
            ref={draftRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              const native = e.nativeEvent as unknown as globalThis.KeyboardEvent;
              if (e.key === 'Enter') {
                if (isImeComposing(native)) return;
                void handleAdd();
              }
            }}
            placeholder={lang === 'zh' ? '新习惯…' : 'New habit…'}
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-foreground placeholder:text-muted-foreground/45 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function HabitRow({
  habit,
  expanded,
  onToggleExpand,
  onIncrement,
  onRename,
  onDelete,
  detail,
}: {
  habit: DueWithStats;
  expanded: boolean;
  onToggleExpand: () => void;
  onIncrement: () => void;
  onRename: (nextTitle: string) => void;
  onDelete: () => void;
  detail: React.ReactNode;
}) {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todayCount = habit.dailyCounts?.[todayKey] || 0;
  const targetCount = Math.max(1, habit.targetCount || 1);
  const met = todayCount >= targetCount;
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(habit.title);

  useEffect(() => {
    if (!isEditing) setDraft(habit.title);
  }, [habit.title, isEditing]);

  const commit = () => {
    if (draft.trim() && draft.trim() !== habit.title) onRename(draft);
    else setDraft(habit.title);
    setIsEditing(false);
  };

  return (
    <li className="group/row">
      <div className="flex items-center gap-3 py-3.5">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          className={cn(
            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground/45 transition-all hover:bg-[hsl(var(--surface-soft-hover))] hover:text-foreground',
            expanded && 'text-foreground',
          )}
        >
          <ChevronDown
            size={14}
            className={cn('transition-transform', expanded && 'rotate-180')}
          />
        </button>

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                const ne = e.nativeEvent as unknown as globalThis.KeyboardEvent;
                if (e.key === 'Enter') {
                  if (isImeComposing(ne)) return;
                  commit();
                }
                if (e.key === 'Escape') {
                  setDraft(habit.title);
                  setIsEditing(false);
                }
              }}
              className="w-full bg-transparent text-[16px] font-medium leading-snug text-foreground focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="block w-full text-left"
            >
              <p
                className={cn(
                  'truncate text-[16px] font-medium leading-snug text-foreground transition-colors',
                  met && 'text-foreground/55',
                )}
              >
                {habit.title}
              </p>
            </button>
          )}
        </div>

        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="More"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/50 opacity-0 transition-opacity hover:bg-[hsl(var(--surface-soft-hover))] hover:text-foreground',
                'group-hover/row:opacity-100 focus-visible:opacity-100',
                menuOpen && 'opacity-100',
              )}
            >
              <MoreHorizontal size={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" side="bottom" className="w-40 p-1">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </PopoverContent>
        </Popover>

        <CheckinRing count={todayCount} target={targetCount} onIncrement={onIncrement} ariaLabel={`Check in: ${habit.title}`} />
      </div>

      {expanded && detail && (
        <div className="pb-4">{detail}</div>
      )}
    </li>
  );
}

function CheckinRing({
  count,
  target,
  onIncrement,
  ariaLabel,
  size = 40,
}: {
  count: number;
  target: number;
  onIncrement: () => void;
  ariaLabel?: string;
  size?: number;
}) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const ratio = Math.min(1, count / Math.max(1, target));
  const met = count >= target;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onIncrement(); }}
      aria-label={ariaLabel || `Check in (${count} of ${target})`}
      className={cn(
        'relative flex flex-shrink-0 items-center justify-center rounded-full transition-transform',
        'hover:scale-[1.05] active:scale-[0.96]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--habit)/0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="hsl(var(--surface-soft-hover))"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill={met ? 'hsl(var(--habit))' : 'none'}
          strokeWidth={stroke}
          stroke="hsl(var(--habit))"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - ratio)}
          className="transition-[stroke-dashoffset,fill] duration-300 ease-out"
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums leading-none',
          met ? 'text-[hsl(var(--habit-foreground))]' : 'text-foreground/75',
        )}
      >
        {met ? <Check size={16} strokeWidth={2.8} /> : target > 1 ? `${count}/${target}` : ''}
      </span>
    </button>
  );
}
