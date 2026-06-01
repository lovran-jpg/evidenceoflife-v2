import { useState, useCallback, useRef } from 'react';
import { addMonths, subMonths, format } from 'date-fns';
import { useDateLocale } from '@/hooks/useDateLocale';
import { Plus, MapPin, Camera, Mic, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { DayDetailSheet } from '@/components/DayDetail/DayDetailSheet';
import { MonthCalendar } from '@/components/Calendar/MonthCalendar';
import { Button } from '@/components/ui/button';
import { Moment } from '@/types';
import { cn, isImeComposing } from '@/lib/utils';

interface HomeViewProps {
  recordedDates: Set<string>;
  getMomentsForDate: (date: string) => Moment[];
  onAddMoment: (data: {
    text?: string;
    photos: string[];
    links?: import('@/types').MomentLinkPreview[];
    location?: { name: string; lat: number; lng: number; category: 'restaurant' | 'coffee' | 'grocery' | 'park' | 'museum' | 'other' };
  }) => void;
}

export function HomeView({ recordedDates, getMomentsForDate, onAddMoment }: HomeViewProps) {
  const { formatDate } = useDateLocale();
  const [text, setText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (!text.trim() && !selectedLocation) return;
    
    onAddMoment({
      text: text.trim() || undefined,
      photos: [],
      location: selectedLocation ? {
        name: selectedLocation,
        lat: 40.7128,
        lng: -74.006,
        category: 'other',
      } : undefined,
    });

    setText('');
    setSelectedLocation(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, selectedLocation, onAddMoment]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const native = e.nativeEvent as KeyboardEvent;
    const isComposing = isImeComposing(native);
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  };

  const handleLocationClick = () => {
    if (selectedLocation) {
      setSelectedLocation(null);
    } else {
      setSelectedLocation('Current Location');
    }
  };

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setShowDayDetail(true);
  }, []);

  const momentsForSelectedDate = selectedDate 
    ? getMomentsForDate(format(selectedDate, 'yyyy-MM-dd'))
    : [];

  const canSend = text.trim() || selectedLocation;

  return (
    <div className="flex-1 flex flex-col pb-24">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        {/* Greeting */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-2xl font-semibold mb-2">What did you do today?</h1>
          <p className="text-muted-foreground text-sm">
            Record your moments, build your evidence of life
          </p>
        </div>

        {/* Prompt input area */}
        <div className="w-full max-w-md animate-slide-up">
          {/* Selected location badge */}
          {selectedLocation && (
            <div className="flex items-center gap-2 px-4 py-2.5 mb-3 bg-primary/10 rounded-xl animate-fade-in">
              <MapPin size={16} className="text-primary" />
              <span className="text-sm font-medium flex-1">{selectedLocation}</span>
              <button 
                onClick={() => setSelectedLocation(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                ×
              </button>
            </div>
          )}

          {/* Main input container */}
          <div className="relative bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="I went to..."
              rows={1}
              className="w-full px-4 pt-4 pb-2 bg-transparent resize-none focus:outline-none text-foreground placeholder:text-muted-foreground"
              style={{ minHeight: '52px', maxHeight: '150px' }}
            />

            {/* Action bar */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-border/50">
              <div className="flex items-center gap-1">
                {/* Add attachment */}
                <button className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                  <Plus size={20} />
                </button>

                {/* Location */}
                <button 
                  onClick={handleLocationClick}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    selectedLocation 
                      ? "bg-primary/10 text-primary" 
                      : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MapPin size={20} />
                </button>

                {/* Camera */}
                <button className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                  <Camera size={20} />
                </button>

                {/* Voice */}
                <button className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                  <Mic size={20} />
                </button>
              </div>

              {/* Send button */}
              <Button
                onClick={handleSend}
                disabled={!canSend}
                size="icon"
                className={cn(
                  "h-9 w-9 rounded-full transition-all",
                  canSend 
                    ? "bg-primary text-primary-foreground shadow-soft" 
                    : "bg-secondary text-muted-foreground"
                )}
              >
                <Send size={18} />
              </Button>
            </div>
          </div>

          {/* Hint text */}
          <p className="text-center text-xs text-muted-foreground mt-3">
            Press Enter to save • Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* Collapsible Calendar section */}
      <div className="border-t border-border">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showCalendar ? (
            <>
              <ChevronDown size={16} />
              Hide calendar
            </>
          ) : (
            <>
              <ChevronUp size={16} />
              View calendar ({recordedDates.size} days recorded)
            </>
          )}
        </button>

        {showCalendar && (
          <div className="animate-slide-up pb-4">
            {/* Month navigation */}
            <div className="flex items-center justify-center gap-4 py-2">
              <button 
                onClick={() => setCurrentDate(prev => subMonths(prev, 1))}
                className="p-2 hover:bg-secondary rounded-full"
              >
                ‹
              </button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {formatDate(currentDate, 'MMMM yyyy')}
              </span>
              <button 
                onClick={() => setCurrentDate(prev => addMonths(prev, 1))}
                className="p-2 hover:bg-secondary rounded-full"
              >
                ›
              </button>
            </div>

            <MonthCalendar
              currentDate={currentDate}
              selectedDate={selectedDate}
              recordedDates={recordedDates}
              onDateSelect={handleDateSelect}
            />
          </div>
        )}
      </div>

      <DayDetailSheet
        open={showDayDetail}
        onOpenChange={setShowDayDetail}
        date={selectedDate}
        moments={momentsForSelectedDate}
      />
    </div>
  );
}
