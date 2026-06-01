import { useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { cn } from '@/lib/utils';

interface MonthCalendarProps {
  currentDate: Date;
  selectedDate: Date | null;
  recordedDates: Set<string>;
  onDateSelect: (date: Date) => void;
}

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MonthCalendar({ 
  currentDate, 
  selectedDate, 
  recordedDates,
  onDateSelect 
}: MonthCalendarProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  return (
    <div className="w-full px-2">
      {/* Week day headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map((day, i) => (
          <div 
            key={day} 
            className={cn(
              "text-center text-xs font-medium py-2",
              i === 0 ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {day.charAt(0)}
          </div>
        ))}
      </div>

      {/* Calendar grid - square cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const hasRecord = recordedDates.has(dateStr);
          const dayIsToday = isToday(day);
          const isSunday = day.getDay() === 0;

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(day)}
              disabled={!isCurrentMonth}
              className={cn(
                'aspect-square flex flex-col items-center justify-center rounded-xl transition-all duration-200 cursor-pointer relative',
                !isCurrentMonth && 'opacity-30 cursor-default',
                isCurrentMonth && !isSelected && !dayIsToday && 'hover:bg-secondary',
                isCurrentMonth && isSunday && !isSelected && 'text-destructive',
                dayIsToday && !isSelected && 'bg-muted',
                isSelected && 'bg-primary text-primary-foreground',
              )}
            >
              <span className={cn(
                'text-base font-medium',
                isSelected && 'text-primary-foreground'
              )}>
                {format(day, 'd')}
              </span>
              
              {/* Record indicator - small icons */}
              {hasRecord && isCurrentMonth && (
                <div className="absolute bottom-1.5 flex items-center gap-0.5">
                  <div className={cn(
                    'w-1 h-1 rounded-full',
                    isSelected ? 'bg-primary-foreground' : 'bg-primary'
                  )} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
