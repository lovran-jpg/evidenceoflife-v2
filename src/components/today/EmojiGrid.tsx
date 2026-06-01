import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { useRef } from 'react';

interface EmojiGridProps {
  emojis: string[];
  value: string | null;
  onChange: (emoji: string | null) => void;
  onPick?: () => void;
}

export function EmojiGrid({ emojis, value, onChange, onPick }: EmojiGridProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCustomEmoji = () => {
    // Focus the hidden input to trigger native emoji keyboard on mobile
    // or allow paste/type on desktop
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Get the emoji from input - just take the first emoji/character entered
    if (inputValue) {
      // Use simple approach - just take the input value (most emoji inputs give single emoji)
      const emoji = inputValue.trim();
      if (emoji) {
        onChange(emoji);
        onPick?.();
      }
    }
    // Clear input after picking
    e.target.value = '';
  };

  // Filter out the ➕ from display emojis
  const displayEmojis = emojis.filter(e => e !== '➕');

  return (
    <div className="grid grid-cols-6 gap-1">
      {displayEmojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onChange(value === emoji ? null : emoji);
            onPick?.();
          }}
          className={cn(
            'text-xl p-2 rounded-lg hover:bg-secondary transition-colors',
            value === emoji && 'bg-primary/10'
          )}
          aria-label={`Pick ${emoji}`}
        >
          {emoji}
        </button>
      ))}
      
      {/* Custom emoji picker - opens native keyboard */}
      <button
        type="button"
        onClick={handleCustomEmoji}
        className="text-xl p-2 rounded-lg hover:bg-secondary transition-colors flex items-center justify-center"
        aria-label="Add custom emoji"
      >
        <Plus size={20} className="text-muted-foreground" />
      </button>
      
      {/* Hidden input for native emoji picker */}
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        className="sr-only"
        onChange={handleInputChange}
        aria-hidden="true"
      />
    </div>
  );
}
