import { useState } from 'react';
import { X, MapPin, Camera, PenLine, Search } from 'lucide-react';
import { useDateLocale } from '@/hooks/useDateLocale';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AddMomentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    text?: string;
    photos: string[];
    location?: { name: string; lat: number; lng: number; category: 'restaurant' | 'coffee' | 'grocery' | 'park' | 'museum' | 'other' };
  }) => void;
}

const quickActions = [
  { icon: PenLine, label: 'Write', id: 'write' },
  { icon: Camera, label: 'Add photos', id: 'photos' },
  { icon: MapPin, label: 'Current location', id: 'location' },
  { icon: Search, label: 'Search place', id: 'search' },
];

export function AddMomentDialog({ open, onOpenChange, onSave }: AddMomentDialogProps) {
  const { formatDate } = useDateLocale();
  const [text, setText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  const handleActionClick = (actionId: string) => {
    if (actionId === 'write') {
      setShowTextInput(true);
    } else if (actionId === 'location') {
      // Simulate getting current location
      setSelectedLocation('Current Location');
    } else if (actionId === 'search') {
      // For MVP, just set a sample location
      setSelectedLocation('Butler Coffee');
    }
  };

  const handleSave = () => {
    if (!text.trim() && !selectedLocation) return;
    
    onSave({
      text: text.trim() || undefined,
      photos: [],
      location: selectedLocation ? {
        name: selectedLocation,
        lat: 40.7128,
        lng: -74.006,
        category: 'other',
      } : undefined,
    });

    // Reset state
    setText('');
    setShowTextInput(false);
    setSelectedLocation(null);
    onOpenChange(false);
  };

  const handleClose = () => {
    setText('');
    setShowTextInput(false);
    setSelectedLocation(null);
    onOpenChange(false);
  };

  const canSave = text.trim() || selectedLocation;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Add moment
            </DialogTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClose}
              className="h-8 w-8 rounded-full -mr-2"
            >
              <X size={18} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(new Date(), 'EEEE, MMMM d')}
          </p>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(({ icon: Icon, label, id }) => (
              <button
                key={id}
                onClick={() => handleActionClick(id)}
                className={`
                  flex items-center gap-3 p-4 rounded-2xl border border-border
                  transition-all duration-200 text-left
                  hover:bg-secondary hover:border-primary/20
                  ${id === 'write' && showTextInput ? 'bg-primary/5 border-primary/30' : ''}
                  ${id === 'location' && selectedLocation ? 'bg-primary/5 border-primary/30' : ''}
                `}
              >
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Icon size={20} className="text-foreground" />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Text input (shown when Write is clicked) */}
          {showTextInput && (
            <div className="animate-fade-in">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What happened today?"
                className="min-h-[120px] resize-none rounded-2xl border-border focus:border-primary/30"
                autoFocus
              />
            </div>
          )}

          {/* Selected location badge */}
          {selectedLocation && (
            <div className="flex items-center gap-2 px-4 py-3 bg-secondary rounded-xl animate-fade-in">
              <MapPin size={16} className="text-primary" />
              <span className="text-sm font-medium">{selectedLocation}</span>
              <button 
                onClick={() => setSelectedLocation(null)}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Save button */}
          <Button 
            onClick={handleSave}
            disabled={!canSave}
            className="w-full h-12 rounded-xl text-base font-medium"
          >
            Save moment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
