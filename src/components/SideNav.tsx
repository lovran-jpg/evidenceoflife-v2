import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronRight, Clock3, Link2, LogOut, MapPin, Pin, Repeat, StickyNote, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TabType } from '@/types';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/BrandLogo';
import { useLanguage } from '@/hooks/useLanguage';
import { useProfile } from '@/hooks/useProfile';
import { useDues } from '@/hooks/useDues';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

type SheetKey = 'notes' | 'dues' | 'habits' | 'links';

interface SideNavProps {
  activeTab: TabType;
  activeSheet?: SheetKey | null;
  onTabChange: (tab: TabType) => void;
}

// Maps a sheet-opener tab id to the Index activeSheet key.
const SHEET_KEY_BY_TAB: Partial<Record<TabType, SheetKey>> = {
  dues: 'dues',
  habits: 'habits',
  notes: 'notes',
  linkup: 'links',
};

// Primary navigation tabs (full-page views)
const tabConfig: { id: TabType; icon: typeof Clock3; labelKey: string }[] = [
  { id: 'today', icon: Clock3, labelKey: 'nav.today' },
  { id: 'calendar', icon: Calendar, labelKey: 'nav.calendar' },
  { id: 'map', icon: MapPin, labelKey: 'nav.places' },
];

// Sheet-opener quick-access buttons, grouped by the role each plays in the
// Plan → Live → Capture → Revisit loop. "Evidence" holds the material that
// proves a day actually happened; "Obligations" holds what keeps life moving.
type SheetItem = { id: TabType; icon: typeof Clock3; shortLabel: string; hint: string };
const sheetGroups: { label: string; items: SheetItem[] }[] = [
  {
    label: 'Evidence',
    items: [
      { id: 'notes', icon: StickyNote, shortLabel: 'Notes', hint: 'Lists, images, reminders' },
      { id: 'linkup', icon: Link2, shortLabel: 'Links', hint: 'Collections & references' },
    ],
  },
  {
    label: 'Obligations',
    items: [
      { id: 'dues', icon: Pin, shortLabel: 'Deadlines', hint: 'Due dates & urgent work' },
      { id: 'habits', icon: Repeat, shortLabel: 'Habits', hint: 'Repeatable routines' },
    ],
  },
];
const TAB_ORDER_KEY = 'side-nav-tab-order';

export function SideNav({ activeTab, activeSheet, onTabChange }: SideNavProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { dues } = useDues();
  const { signOut } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [logoVisible, setLogoVisible] = useState(true);
  const [showProfileHoverCard, setShowProfileHoverCard] = useState(false);
  const [draggedTab, setDraggedTab] = useState<TabType | null>(null);
  const [tabOrder, setTabOrder] = useState<TabType[]>(() => {
    try {
      const raw = localStorage.getItem(TAB_ORDER_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const validIds = tabConfig.map((tab) => tab.id);
      if (Array.isArray(parsed) && validIds.every((id) => parsed.includes(id))) {
        return parsed as TabType[];
      }
    } catch {}
    return tabConfig.map((tab) => tab.id);
  });
  const hoverExpandTimeoutRef = useRef<number | null>(null);
  const profileHoverTimeoutRef = useRef<number | null>(null);
  const sideNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sideNavRef.current && !sideNavRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);
  const displayName = profile?.display_name?.trim() || 'Demo User';
  const validTimedDues = dues.filter((due) => {
    if (due.is_completed || !due.due_date) return false;
    const parsed = new Date(due.due_date).getTime();
    return Number.isFinite(parsed);
  });
  const nextDue = validTimedDues
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0];

  const clearHoverExpandTimeout = () => {
    if (hoverExpandTimeoutRef.current !== null) {
      window.clearTimeout(hoverExpandTimeoutRef.current);
      hoverExpandTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearHoverExpandTimeout();
      if (profileHoverTimeoutRef.current !== null) {
        window.clearTimeout(profileHoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(tabOrder));
  }, [tabOrder]);

  const clearProfileHoverTimeout = () => {
    if (profileHoverTimeoutRef.current !== null) {
      window.clearTimeout(profileHoverTimeoutRef.current);
      profileHoverTimeoutRef.current = null;
    }
  };

  const openProfileHoverCardWithDelay = () => {
    clearProfileHoverTimeout();
    profileHoverTimeoutRef.current = window.setTimeout(() => {
      setShowProfileHoverCard(true);
      profileHoverTimeoutRef.current = null;
    }, 420);
  };

  const closeProfileHoverCardWithDelay = () => {
    clearProfileHoverTimeout();
    profileHoverTimeoutRef.current = window.setTimeout(() => {
      setShowProfileHoverCard(false);
      profileHoverTimeoutRef.current = null;
    }, 120);
  };

  const nextDueDateLabel = nextDue?.due_date
    ? (() => {
        const parsed = new Date(nextDue.due_date);
        if (!Number.isFinite(parsed.getTime())) return null;
        return `${format(parsed, 'MMM d')} · ${format(parsed, 'h:mma').toLowerCase()}`;
      })()
    : null;
  const nextDueRemainingLabel = nextDue?.due_date
    ? (() => {
        const parsed = new Date(nextDue.due_date);
        if (!Number.isFinite(parsed.getTime())) return null;
        const diffMs = parsed.getTime() - Date.now();
        if (diffMs <= 0) return 'due now';
        const diffMin = Math.ceil(diffMs / 60000);
        const days = Math.floor(diffMin / 1440);
        const hours = Math.floor((diffMin % 1440) / 60);
        if (days >= 1) return `${days}${days === 1 ? ' day' : ' days'} left`;
        if (hours >= 1) return `${hours}h left`;
        return `${diffMin}m left`;
      })()
    : null;
  const orderedTabs = tabOrder
    .map((id) => tabConfig.find((tab) => tab.id === id))
    .filter((tab): tab is (typeof tabConfig)[number] => Boolean(tab));

  return (
    <aside
      ref={sideNavRef}
      className={cn(
        'flex-shrink-0 border-r border-border bg-[hsl(var(--surface-contrast))] transition-[width] duration-200',
        expanded ? 'w-[236px]' : 'w-[52px]'
      )}
    >
      <div className="sticky top-0 flex h-screen flex-col py-2.5">
        <div className={cn(expanded ? 'px-1.5' : 'px-2')}>
          <button
            onClick={() => setExpanded((prev) => !prev)}
            onMouseEnter={() => {
              if (expanded) return;
              clearHoverExpandTimeout();
              hoverExpandTimeoutRef.current = window.setTimeout(() => {
                setExpanded(true);
                hoverExpandTimeoutRef.current = null;
              }, 220);
            }}
            onMouseLeave={() => {
              clearHoverExpandTimeout();
            }}
            className={cn(
              'flex h-10 w-full items-center rounded-[12px] transition-colors',
              expanded ? 'justify-between gap-2 bg-[hsl(var(--surface-soft))] px-2' : 'justify-center'
            )}
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <span className={cn(
              'flex items-center justify-center rounded-[10px]',
              expanded ? 'h-10 w-10 bg-[hsl(var(--surface-contrast))] shadow-[0_1px_2px_hsl(var(--foreground)/0.08)]' : 'h-11 w-11'
            )}>
              {logoVisible ? (
                <span onError={() => setLogoVisible(false) as never}>
                  <BrandLogo
                    alt="Evidence of life"
                    className={cn(expanded ? 'h-9 w-9' : 'h-10 w-10')}
                  />
                </span>
              ) : (
                <span className="text-[12px] leading-none text-[hsl(var(--text-soft))]">◌</span>
              )}
            </span>
            {expanded && (
              <span className="flex min-w-0 flex-1 items-center justify-between gap-1.5">
                <span
                  className="font-brand min-w-0 flex-1 text-[19px] text-foreground leading-none truncate"
                >
                  Evidence of life
                </span>
                <ChevronRight size={14} className="text-muted-foreground" />
              </span>
            )}
          </button>
        </div>

        <nav className={cn('mt-3 flex flex-col gap-1', expanded ? 'px-1.5' : 'px-2')}>
          {/* Daily loop: full-page core surfaces (plan → live → capture → revisit) */}
          {expanded && (
            <span className="mb-0.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/45">
              Daily loop
            </span>
          )}
          {/* Primary nav tabs */}
          {orderedTabs.map(({ id, icon: Icon, labelKey }) => (
            <button
              key={id}
              draggable={expanded}
              onClick={() => onTabChange(id)}
              onDragStart={() => setDraggedTab(id)}
              onDragOver={(e) => {
                if (!expanded) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!draggedTab || draggedTab === id) return;
                setTabOrder((prev) => {
                  const sourceIndex = prev.indexOf(draggedTab);
                  const targetIndex = prev.indexOf(id);
                  if (sourceIndex < 0 || targetIndex < 0) return prev;
                  const next = [...prev];
                  const [moved] = next.splice(sourceIndex, 1);
                  next.splice(targetIndex, 0, moved);
                  return next;
                });
                setDraggedTab(null);
              }}
              onDragEnd={() => setDraggedTab(null)}
              title={t(labelKey)}
              className={cn(
                'flex h-9 items-center rounded-[10px] transition-colors',
                expanded ? 'w-full justify-start gap-2 px-3' : 'w-9 justify-center self-center',
                expanded && 'cursor-grab active:cursor-grabbing',
                draggedTab === id && 'opacity-60',
                activeTab === id
                  ? 'bg-[hsl(var(--surface-soft))] text-foreground'
                  : 'text-[hsl(var(--text-soft))] hover:bg-[hsl(var(--surface-soft-hover))]'
              )}
            >
              <Icon size={24} strokeWidth={activeTab === id ? 1.85 : 1.6} />
              {expanded && (
                <span className="text-[16px] font-medium text-inherit">
                  {t(labelKey)}
                </span>
              )}
            </button>
          ))}

          {/* Utility library: sheet openers grouped by role (Evidence / Obligations) */}
          {expanded ? (
            <div className="mt-3 space-y-2">
              {sheetGroups.map((group) => (
                <div key={group.label} className="rounded-[18px] border border-border/55 bg-background/55 p-1.5 shadow-[0_8px_24px_hsl(var(--foreground)/0.035)]">
                  <div className="mb-1 flex items-center justify-between px-2 py-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/45">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/35">{group.items.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map(({ id, icon: Icon, shortLabel, hint }) => {
                      const isOpen = activeSheet != null && SHEET_KEY_BY_TAB[id] === activeSheet;
                      return (
                      <button
                        key={id}
                        onClick={() => onTabChange(id)}
                        title={`${shortLabel} · ${hint}`}
                        aria-current={isOpen ? 'true' : undefined}
                        className={cn(
                          "group/lib flex min-h-11 w-full items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-left transition-colors",
                          isOpen
                            ? "bg-[hsl(var(--surface-soft-hover))] text-foreground"
                            : "text-[hsl(var(--text-soft))] hover:bg-[hsl(var(--surface-soft-hover))] hover:text-foreground"
                        )}
                      >
                        <span className={cn(
                          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-[hsl(var(--surface-soft))] transition-colors group-hover/lib:text-foreground",
                          isOpen ? "text-foreground" : "text-muted-foreground/75"
                        )}>
                          <Icon size={17} strokeWidth={isOpen ? 1.95 : 1.65} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold leading-none text-inherit">
                            {shortLabel}
                          </span>
                          <span className="mt-1 block truncate text-[10px] font-medium leading-none text-muted-foreground/45">
                            {hint}
                          </span>
                        </span>
                        <ChevronRight size={13} className="flex-shrink-0 text-muted-foreground/25 transition-colors group-hover/lib:text-muted-foreground/55" />
                      </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {sheetGroups.map((group) => (
                <div key={group.label}>
                  <div className="my-1 h-px bg-border/35 mx-1" />
                  <div className="flex flex-col gap-1 rounded-[14px] bg-background/35 py-1">
                    {group.items.map(({ id, icon: Icon, shortLabel, hint }) => {
                      const isOpen = activeSheet != null && SHEET_KEY_BY_TAB[id] === activeSheet;
                      return (
                      <button
                        key={id}
                        onClick={() => onTabChange(id)}
                        title={`${shortLabel} · ${hint}`}
                        aria-current={isOpen ? 'true' : undefined}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center self-center rounded-[10px] transition-colors",
                          isOpen
                            ? "bg-[hsl(var(--surface-soft-hover))] text-foreground"
                            : "text-[hsl(var(--text-soft))] hover:bg-[hsl(var(--surface-soft-hover))] hover:text-foreground"
                        )}
                      >
                        <Icon size={19} strokeWidth={isOpen ? 1.95 : 1.65} />
                      </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </nav>

        {expanded && activeTab === 'today' && (
          <div className="mt-4 px-1.5">
            <button
              onClick={() => {
                if (nextDue) {
                  window.dispatchEvent(new CustomEvent('navigate-to-dues', { detail: { dueId: nextDue.id } }));
                } else {
                  onTabChange('dues');
                }
              }}
              className="w-full rounded-[14px] border border-border bg-card px-4 py-3.5 text-left transition-colors hover:bg-[hsl(var(--surface-soft-hover))]"
            >
              {nextDue ? (
                <>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50 font-medium">
                      {t('plan.comingUp')}
                    </span>
                    <ChevronRight size={12} className="text-muted-foreground/40" />
                  </div>
                  <p className="text-[12px] font-semibold leading-snug text-foreground truncate">
                    {nextDue.title}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {nextDueDateLabel && (
                      <span className="text-[11px] text-muted-foreground/70">{nextDueDateLabel}</span>
                    )}
                    {nextDueRemainingLabel && (
                      <span className="text-[11px] font-medium text-primary/80">{nextDueRemainingLabel}</span>
                    )}
                  </div>
                  {nextDue.links?.[0] && (
                    <p className="mt-1.5 truncate text-[11px] text-primary/70">
                      {nextDue.links[0].label || nextDue.links[0].url?.replace(/^https?:\/\//, '')}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-muted-foreground/60">
                    {t('plan.deadlinesHabits')}
                  </span>
                  <ChevronRight size={12} className="text-muted-foreground/40" />
                </div>
              )}
            </button>
          </div>
        )}

        <div
          className={cn('relative mt-auto pt-3.5', expanded ? 'px-1.5' : 'px-2')}
          onMouseEnter={openProfileHoverCardWithDelay}
          onMouseLeave={closeProfileHoverCardWithDelay}
        >
          <button
            onClick={() => onTabChange('profile')}
            title={displayName}
            className={cn(
              'flex h-9 items-center rounded-[10px] transition-colors overflow-hidden',
              expanded ? 'w-full justify-start gap-2 px-3' : 'w-9 justify-center self-center',
              activeTab === 'profile'
                ? 'bg-[hsl(var(--surface-soft))]'
                : 'hover:bg-[hsl(var(--surface-soft-hover))]'
            )}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className={cn(expanded ? 'h-8 w-8' : 'h-9 w-9', 'rounded-full object-cover')} />
            ) : (
              <User size={22} className="text-[hsl(var(--text-soft))]" />
            )}
            {expanded && (
              <span className="text-[16px] font-medium text-foreground">
                {displayName}
              </span>
            )}
          </button>
          {showProfileHoverCard && (
            <div
              onMouseEnter={() => {
                clearProfileHoverTimeout();
                setShowProfileHoverCard(true);
              }}
              onMouseLeave={closeProfileHoverCardWithDelay}
              className={cn(
                'absolute bottom-full z-30 mb-2 rounded-[14px] border border-border bg-background/95 p-2 shadow-[0_12px_28px_hsl(var(--foreground)/0.12)] backdrop-blur-sm',
                expanded ? 'left-1.5 w-[170px]' : 'left-10 w-[150px]'
              )}
            >
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setShowProfileHoverCard(false);
                  await signOut();
                  navigate('/', { replace: true });
                }}
                className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-[hsl(var(--surface-soft-hover))]"
              >
                <LogOut size={14} className="text-[hsl(var(--text-soft))]" />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
