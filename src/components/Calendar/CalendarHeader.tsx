import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDateLocale } from '@/hooks/useDateLocale';

interface CalendarHeaderProps {
  currentDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onAddClick: () => void;
}

export function CalendarHeader({ 
  currentDate, 
  onPreviousMonth, 
  onNextMonth,
  onAddClick,
}: CalendarHeaderProps) {
  const { formatDate } = useDateLocale();
  return (
    <header className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onPreviousMonth}
          className="h-9 w-9 rounded-full"
        >
          <ChevronLeft size={20} />
        </Button>
        
        <h1 className="text-xl font-semibold font-display min-w-[140px] text-center">
          {formatDate(currentDate, 'MMMM yyyy')}
        </h1>
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onNextMonth}
          className="h-9 w-9 rounded-full"
        >
          <ChevronRight size={20} />
        </Button>
      </div>

      <Button 
        onClick={onAddClick}
        size="icon"
        className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-soft hover:shadow-elevated transition-shadow"
      >
        <Plus size={22} />
      </Button>
    </header>
  );
}
