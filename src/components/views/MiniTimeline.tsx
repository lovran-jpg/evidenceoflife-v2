import { parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Todo } from '@/hooks/useTodos';
import { Moment } from '@/types';

interface MiniTimelineProps {
  todos: Todo[];
  moments: Moment[];
}

const WAKE_HOUR = 8;
const BEDTIME_HOUR = 23;
const TOTAL_HOURS = BEDTIME_HOUR - WAKE_HOUR + 1; // 8-23 = 16 slots

function hourLabel(h: number): string {
  if (h < 12) return `${h}`;
  if (h === 12) return '12';
  return `${h - 12}`;
}

export function MiniTimeline({ todos, moments }: MiniTimelineProps) {
  // Build occupied hours
  const occupied = new Map<number, { type: 'todo' | 'moment'; count: number }>();

  todos.forEach(todo => {
    if (todo.timer_started_at) {
      const h = parseISO(todo.timer_started_at).getHours();
      if (h >= WAKE_HOUR && h <= BEDTIME_HOUR) {
        const existing = occupied.get(h);
        occupied.set(h, { type: 'todo', count: (existing?.count || 0) + 1 });
      }
    } else if (todo.is_completed) {
      const h = parseISO(todo.created_at).getHours();
      if (h >= WAKE_HOUR && h <= BEDTIME_HOUR) {
        const existing = occupied.get(h);
        occupied.set(h, { type: 'todo', count: (existing?.count || 0) + 1 });
      }
    }
  });

  moments.forEach(m => {
    const h = parseISO(m.createdAt).getHours();
    if (h >= WAKE_HOUR && h <= BEDTIME_HOUR) {
      const existing = occupied.get(h);
      occupied.set(h, { type: existing?.type || 'moment', count: (existing?.count || 0) + 1 });
    }
  });

  const currentHour = new Date().getHours();

  return (
    <div className="flex flex-col h-full py-1">
      {Array.from({ length: TOTAL_HOURS }, (_, i) => {
        const hour = WAKE_HOUR + i;
        const entry = occupied.get(hour);
        const isCurrent = hour === currentHour;
        const isPast = hour < currentHour;

        return (
          <div key={hour} className="flex items-center gap-1 flex-1 min-h-0">
            <span className={cn(
              "text-[9px] font-mono w-4 text-right leading-none",
              isCurrent ? "text-primary/60" : "text-muted-foreground/25"
            )}>
              {hour % 3 === 0 || isCurrent ? hourLabel(hour) : ''}
            </span>
            <div className="flex-1 flex items-center h-full">
              <div className={cn(
                "w-full rounded-sm transition-all",
                entry
                  ? entry.type === 'todo'
                    ? "bg-primary/10 h-[60%]"
                    : "bg-accent/20 h-[60%]"
                  : isCurrent
                    ? "bg-primary/5 h-px"
                    : isPast
                      ? "bg-border/15 h-px"
                      : "bg-border/8 h-px"
              )} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
