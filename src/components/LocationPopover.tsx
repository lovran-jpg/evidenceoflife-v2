import { forwardRef, useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Navigation, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn, isImeComposing } from '@/lib/utils';

interface LocationResult {
  name: string;
  lat: number;
  lng: number;
  category?: string;
}

interface LocationPopoverProps {
  onSelect: (location: { name: string; lat: number; lng: number; category: 'restaurant' | 'coffee' | 'grocery' | 'park' | 'museum' | 'other' }) => void;
  onClose: () => void;
  autoLocateToken?: number;
}

export const LocationPopover = forwardRef<HTMLDivElement, LocationPopoverProps>(
  function LocationPopover({ onSelect, onClose, autoLocateToken }, ref) {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<LocationResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const composingRef = useRef(false);
    // Use a ref so search debounce always reads the latest coords without needing a re-render cycle
    const coordsRef = useRef<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
          () => {}
        );
      }
    }, []);

    useEffect(() => {
      const q = search.trim();
      if (!q || q.length < 2) { setResults([]); return; }

      const handle = window.setTimeout(async () => {
        try {
          setIsSearching(true);
          const body: any = { type: 'search', q, limit: 8 };
          const coords = coordsRef.current;
          if (coords) { body.lat = coords.lat; body.lng = coords.lng; }
          const { data, error } = await supabase.functions.invoke('geo', { body });
          if (error) throw error;
          setResults((data?.results ?? []).map((r: any) => ({
            name: String(r.name ?? ''),
            lat: Number(r.lat),
            lng: Number(r.lng),
            category: r.category || 'other',
          })));
        } catch {
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 350);

      return () => window.clearTimeout(handle);
    }, [search]);

    const reverseGeocode = useCallback(async (lat: number, lng: number) => {
      try {
        const { data, error } = await supabase.functions.invoke('geo', {
          body: { type: 'reverse', lat, lng },
        });
        if (error) throw error;
        const name = String(data?.name ?? '').trim();
        const category = data?.category || 'other';
        if (!name || name === 'Nearby') {
          const city = String(data?.city ?? '').trim();
          return { name: city || 'Current location', category };
        }
        return { name, category };
      } catch {
        return { name: 'Current location', category: 'other' };
      }
    }, []);

    const handleGetCurrentLocation = useCallback(async () => {
      setIsGettingLocation(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude: lat, longitude: lng } = position.coords;
            coordsRef.current = { lat, lng };
            const result = await reverseGeocode(lat, lng);
            onSelect({ name: result.name, lat, lng, category: result.category as any });
            setIsGettingLocation(false);
            onClose();
          },
          () => { setIsGettingLocation(false); }
        );
      }
    }, [onSelect, onClose, reverseGeocode]);

    useEffect(() => {
      if (autoLocateToken === undefined) return;
      void handleGetCurrentLocation();
    }, [autoLocateToken, handleGetCurrentLocation]);

    const handleSelectResult = useCallback((r: LocationResult) => {
      onSelect({ name: r.name, lat: r.lat, lng: r.lng, category: (r.category || 'other') as any });
      onClose();
    }, [onSelect, onClose]);

    const handleAddManual = useCallback(async () => {
      if (!search.trim()) return;
      try {
        const body: any = { type: 'search', q: search.trim(), limit: 1 };
        const coords = coordsRef.current;
        if (coords) { body.lat = coords.lat; body.lng = coords.lng; }
        const { data } = await supabase.functions.invoke('geo', { body });
        const first = data?.results?.[0];
        if (first?.lat && first?.lng) {
          onSelect({ name: first.name || search.trim(), lat: Number(first.lat), lng: Number(first.lng), category: (first.category || 'other') as any });
          onClose();
          return;
        }
      } catch { /* fall through */ }
      const coords = coordsRef.current;
      onSelect({ name: search.trim(), lat: coords?.lat ?? 0, lng: coords?.lng ?? 0, category: 'other' });
      onClose();
    }, [search, onSelect, onClose]);

    return (
      <div
        ref={ref}
        className="w-[260px] overflow-hidden rounded-[14px] border border-border/55 bg-[hsl(var(--background)/0.98)] shadow-[0_12px_28px_hsl(var(--foreground)/0.09)] backdrop-blur-xl"
        data-edit-popover="true"
      >
        {/* Use current location */}
        <button
          onClick={handleGetCurrentLocation}
          disabled={isGettingLocation}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--surface-soft))] disabled:opacity-60"
        >
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isGettingLocation ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
          </span>
          <span className="text-[13px] font-medium text-foreground/88">Use current location</span>
        </button>

        <div className="mx-2 h-px bg-border/30" />

        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2">
          {isSearching
            ? <Loader2 size={13} className="flex-shrink-0 animate-spin text-muted-foreground/45" />
            : <Search size={13} className="flex-shrink-0 text-muted-foreground/45" />
          }
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (composingRef.current || isImeComposing(e.nativeEvent as KeyboardEvent)) return;
                handleAddManual();
              }
              e.stopPropagation();
            }}
            placeholder="Search nearby..."
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            autoFocus
          />
        </div>

        {/* Results */}
        {results.length > 0 && (
          <>
            <div className="mx-2 h-px bg-border/30" />
            <div className="max-h-[200px] overflow-y-auto py-1">
              {results.map((r) => (
                <button
                  key={`${r.lat}-${r.lng}-${r.name}`}
                  onClick={() => handleSelectResult(r)}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-[hsl(var(--surface-soft))]"
                >
                  <MapPin size={12} className="flex-shrink-0 text-muted-foreground/50" />
                  <span className="truncate text-[12.5px] text-foreground/85">{r.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Manual add fallback */}
        {search.trim().length >= 2 && results.length === 0 && !isSearching && (
          <>
            <div className="mx-2 h-px bg-border/30" />
            <button
              onClick={handleAddManual}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--surface-soft))]"
            >
              <MapPin size={12} className="flex-shrink-0 text-primary/70" />
              <span className="truncate text-[12.5px] text-primary/80">Add "{search}"</span>
            </button>
          </>
        )}
      </div>
    );
  }
);
