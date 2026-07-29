import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Clock, AlertTriangle } from 'lucide-react';
import { format, differenceInHours, differenceInDays, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import { DueWithStats } from '@/hooks/useDues';

interface DueNotification {
  id: string;
  title: string;
  dueDate: string;
  type: 'overdue' | 'urgent' | 'upcoming';
  timeLabel: string;
  dateLabel: string;
}

interface DueNotificationsProps {
  dues: DueWithStats[];
  onNavigateToDues: () => void;
}

const DISMISSED_KEY = 'due-notifications-dismissed';

function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const valid = Object.entries(parsed).filter(([, ts]) => now - (ts as number) < 12 * 60 * 60 * 1000);
    return new Set(valid.map(([id]) => id));
  } catch {
    return new Set();
  }
}

function dismissId(id: string) {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[id] = Date.now();
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(parsed));
  } catch {
    return;
  }
}

export function DueNotifications({ dues, onNavigateToDues }: DueNotificationsProps) {
  const { lang } = useLanguage();
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissedIds);
  const [visible, setVisible] = useState(false);

  const notifications = useMemo<DueNotification[]>(() => {
    const now = new Date();
    const result: DueNotification[] = [];

    for (const due of dues) {
      if (due.is_completed) continue;
      if (!due.due_date) continue;

      const dueDate = parseISO(due.due_date);
      if (!Number.isFinite(dueDate.getTime())) continue;
      const hoursUntil = differenceInHours(dueDate, now);
      const daysUntil = differenceInDays(dueDate, now);
      const dateLabel = format(dueDate, 'M/d');

      if (isPast(dueDate)) {
        const daysAgo = Math.abs(daysUntil);
        result.push({
          id: due.id, title: due.title, dueDate: due.due_date, type: 'overdue',
          timeLabel: daysAgo === 0
            ? (lang === 'zh' ? '今天到期' : 'Due today')
            : daysAgo === 1
              ? (lang === 'zh' ? '昨天到期' : 'Overdue')
              : (lang === 'zh' ? `已逾期 ${daysAgo}天` : `${daysAgo}d overdue`),
          dateLabel,
        });
      } else if (hoursUntil <= 24) {
        result.push({
          id: due.id, title: due.title, dueDate: due.due_date, type: 'urgent',
          timeLabel: hoursUntil <= 1
            ? (lang === 'zh' ? '<1小时' : '<1 hr')
            : (lang === 'zh' ? `${Math.ceil(hoursUntil)}小时后` : `${Math.ceil(hoursUntil)}h left`),
          dateLabel,
        });
      } else if (daysUntil <= 3) {
        result.push({
          id: due.id, title: due.title, dueDate: due.due_date, type: 'upcoming',
          timeLabel: daysUntil === 1
            ? (lang === 'zh' ? '明天' : 'Tomorrow')
            : (lang === 'zh' ? `${daysUntil}天后` : `In ${daysUntil} days`),
          dateLabel,
        });
      }
    }

    const order = { overdue: 0, urgent: 1, upcoming: 2 };
    result.sort((a, b) => order[a.type] - order[b.type]);
    return result;
  }, [dues, lang]);

  const activeNotifications = useMemo(
    () => notifications.filter(n => !dismissed.has(n.id)).slice(0, 2),
    [notifications, dismissed]
  );

  useEffect(() => {
    if (activeNotifications.length === 0) { setVisible(false); return; }
    const timer = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(timer);
  }, [activeNotifications.length]);

  const handleDismiss = useCallback((id: string) => {
    dismissId(id);
    setDismissed(prev => new Set([...prev, id]));
  }, []);

  if (activeNotifications.length === 0) return null;

  const notif = activeNotifications[0];

  const accent =
    notif.type === 'overdue' ? 'text-red-500' :
    notif.type === 'urgent' ? 'text-orange-500' :
    'text-primary';

  const iconBg =
    notif.type === 'overdue' ? 'bg-red-500/10' :
    notif.type === 'urgent' ? 'bg-orange-500/10' :
    'bg-primary/10';

  return (
    <div
      className={cn(
        'fixed top-3 right-3 z-40 transition-all duration-400 ease-out',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0 pointer-events-none'
      )}
    >
      <div
        className="flex items-center gap-2.5 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg px-3 py-2.5 cursor-pointer max-w-[260px]"
        onClick={onNavigateToDues}
      >
        <div className={cn('shrink-0 w-7 h-7 rounded-full flex items-center justify-center', iconBg, accent)}>
          {notif.type === 'overdue'
            ? <AlertTriangle size={13} />
            : <Clock size={13} />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold truncate text-foreground leading-tight">
            {notif.title}
          </p>
          <p className={cn('text-[11px] leading-tight mt-0.5', accent)}>
            {notif.timeLabel}
            <span className="text-muted-foreground/60 ml-1">· {notif.dateLabel}</span>
          </p>
        </div>

        <button
          onClick={e => { e.stopPropagation(); handleDismiss(notif.id); }}
          className="shrink-0 w-5 h-5 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
        >
          <X size={10} />
        </button>
      </div>

      {activeNotifications.length > 1 && (
        <div className="mt-1.5 flex items-center gap-2 bg-card/90 backdrop-blur-xl border border-border/40 rounded-2xl shadow px-3 py-2 cursor-pointer max-w-[260px]"
          onClick={onNavigateToDues}>
          <div className={cn('shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
            activeNotifications[1].type === 'overdue' ? 'bg-red-500/10 text-red-500' :
            activeNotifications[1].type === 'urgent' ? 'bg-orange-500/10 text-orange-500' : 'bg-primary/10 text-primary'
          )}>
            <Clock size={13} />
          </div>
          <p className="flex-1 text-[12px] font-medium truncate text-foreground">{activeNotifications[1].title}</p>
          <button
            onClick={e => { e.stopPropagation(); handleDismiss(activeNotifications[1].id); }}
            className="shrink-0 w-5 h-5 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <X size={10} />
          </button>
        </div>
      )}
    </div>
  );
}
