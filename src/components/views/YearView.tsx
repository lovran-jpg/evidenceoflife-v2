import { useState, useMemo } from 'react';
import { 
  format, 
  startOfYear, 
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addYears,
  subYears,
  setMonth,
  setYear,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface YearViewProps {
  recordedDates: Set<string>;
  onMonthSelect: (date: Date) => void;
  onDaySelect?: (date: Date) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

export function YearView({ recordedDates, onMonthSelect, onDaySelect }: YearViewProps) {
  const [currentYear, setCurrentYear] = useState(new Date());

  const months = useMemo(() => {
    const start = startOfYear(currentYear);
    return eachMonthOfInterval({
      start,
      end: new Date(start.getFullYear(), 11, 31),
    });
  }, [currentYear]);

  const totalRecorded = useMemo(() => {
    let count = 0;
    recordedDates.forEach(date => {
      if (date.startsWith(format(currentYear, 'yyyy'))) {
        count++;
      }
    });
    return count;
  }, [recordedDates, currentYear]);

  const handlePreviousYear = () => {
    setCurrentYear(prev => subYears(prev, 1));
  };

  const handleNextYear = () => {
    setCurrentYear(prev => addYears(prev, 1));
  };

  const goToToday = () => {
    setCurrentYear(new Date());
  };

  return (
    <div className="flex-1 pb-6 px-4 overflow-y-auto">
      {/* Year header */}
      <header className="flex items-center justify-between py-4">
        <h1 className="text-3xl font-bold">
          {format(currentYear, 'yyyy')}年
        </h1>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToToday}
            className="h-8 px-3 rounded-full text-sm"
          >
            今天
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handlePreviousYear}
            className="h-8 w-8 rounded-full"
          >
            <ChevronLeft size={18} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleNextYear}
            className="h-8 w-8 rounded-full"
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      </header>

      {/* Month grid - 4 columns, pure text layout */}
      <div className="grid grid-cols-4 gap-x-8 gap-y-6">
        {months.map((month) => (
          <MiniMonth
            key={format(month, 'yyyy-MM')}
            month={month}
            recordedDates={recordedDates}
            onMonthClick={() => onMonthSelect(month)}
            onDayClick={onDaySelect}
          />
        ))}
      </div>

      {/* Summary */}
      {totalRecorded > 0 && (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          {format(currentYear, 'yyyy')} 年共记录 {totalRecorded} 天
        </div>
      )}
    </div>
  );
}

interface MiniMonthProps {
  month: Date;
  recordedDates: Set<string>;
  onMonthClick: () => void;
  onDayClick?: (date: Date) => void;
}

function MiniMonth({ month, recordedDates, onMonthClick, onDayClick }: MiniMonthProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const monthName = MONTH_NAMES[month.getMonth()];

  return (
    <div>
      {/* Month title */}
      <button 
        onClick={onMonthClick}
        className="text-base font-semibold text-primary mb-2 hover:opacity-70 transition-opacity"
      >
        {monthName}
      </button>
      
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {WEEKDAYS.map((day, i) => (
          <div 
            key={day} 
            className={cn(
              "w-6 text-center text-xs",
              i === 0 ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {day}
          </div>
        ))}
      </div>
      
      {/* Days grid - pure text */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((day, i) => {
          const isCurrentMonth = isSameMonth(day, month);
          const hasRecord = recordedDates.has(format(day, 'yyyy-MM-dd'));
          const isTodayDate = isToday(day);
          const isSunday = day.getDay() === 0;
          
          return (
            <button
              key={i}
              onClick={() => isCurrentMonth && onDayClick?.(day)}
              disabled={!isCurrentMonth}
              className={cn(
                'w-6 h-6 text-center text-sm transition-colors',
                !isCurrentMonth && 'text-muted-foreground/30',
                isCurrentMonth && isSunday && 'text-destructive',
                isCurrentMonth && hasRecord && 'underline underline-offset-2',
                isTodayDate && 'bg-primary text-primary-foreground rounded-full font-medium',
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
