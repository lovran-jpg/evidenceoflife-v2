import { useState, useCallback, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';

interface LinearTimeProgressProps {
  wakeHour: number;
  wakeMinute: number;
  bedtimeHour: number;
  bedtimeMinute: number;
  onWakeChange?: (h: number, m: number) => void;
  onBedtimeChange?: (h: number, m: number) => void;
  draggable?: boolean;
  mode?: 'recap' | 'plan';
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export function LinearTimeProgress({
  wakeHour, wakeMinute, bedtimeHour, bedtimeMinute,
  onWakeChange, onBedtimeChange, draggable = false, mode = 'recap'
}: LinearTimeProgressProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'wake' | 'bed' | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const wakeMin = wakeHour * 60 + wakeMinute;
  const bedMin = bedtimeHour * 60 + bedtimeMinute;
  const totalAwake = bedMin - wakeMin;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const elapsed = Math.max(0, Math.min(nowMin - wakeMin, totalAwake));
  const pct = totalAwake > 0 ? (elapsed / totalAwake) * 100 : 0;
  const remaining = Math.max(0, bedMin - nowMin);
  const elapsedH = Math.floor(elapsed / 60);
  const elapsedM = elapsed % 60;
  const remH = Math.floor(remaining / 60);
  const remM = remaining % 60;

  const clientXToMin = useCallback((clientX: number) => {
    if (!barRef.current) return wakeMin;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const totalMin = Math.round(ratio * 24 * 60);
    return Math.round(totalMin / 5) * 5;
  }, [wakeMin]);

  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragging) return;
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const min = clientXToMin(clientX);
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    if (dragging === 'wake' && onWakeChange) onWakeChange(h, m);
    if (dragging === 'bed' && onBedtimeChange) onBedtimeChange(h, m);
  }, [dragging, clientXToMin, onWakeChange, onBedtimeChange]);

  const handleUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging, handleMove, handleUp]);

  const wakePct = (wakeMin / (24 * 60)) * 100;
  const bedPct = (bedMin / (24 * 60)) * 100;

  const centerLabel = mode === 'plan'
    ? <><span className="text-foreground font-semibold">{remH}h {pad(remM)}m</span><span className="text-muted-foreground/50"> left</span></>
    : <><span className="text-foreground font-semibold">{elapsedH}h {pad(elapsedM)}m</span><span className="text-muted-foreground/50"> passed</span></>;

  return (
    <div className="px-5 py-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 font-mono">
          {pad(wakeHour)}:{pad(wakeMinute)}
        </span>
        <div ref={barRef} className="relative h-1.5 bg-muted rounded-full overflow-visible flex-1">
          {/* Elapsed fill */}
          <div
            className="absolute inset-y-0 left-0 bg-primary/40 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
          {/* Now indicator */}
          {pct > 0 && pct < 100 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background shadow-sm z-10"
              style={{ left: `${pct}%`, marginLeft: -5 }}
            />
          )}
          {/* Draggable wake handle */}
          {draggable && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-accent border border-accent/30 shadow cursor-grab active:cursor-grabbing z-20"
              style={{ left: `${wakePct}%`, marginLeft: -8 }}
              onMouseDown={e => { e.preventDefault(); setDragging('wake'); }}
              onTouchStart={e => { e.preventDefault(); setDragging('wake'); }}
            />
          )}
          {draggable && (
            <div
              className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-primary border border-primary/30 shadow cursor-grab active:cursor-grabbing z-20"
              style={{ left: `${bedPct}%`, marginLeft: -8 }}
              onMouseDown={e => { e.preventDefault(); setDragging('bed'); }}
              onTouchStart={e => { e.preventDefault(); setDragging('bed'); }}
            >
              <Pencil size={8} className="text-primary-foreground" />
            </div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 font-mono">
          {pad(bedtimeHour)}:{pad(bedtimeMinute)}
        </span>
      </div>
      <div className="text-center mt-0.5">
        <span className="text-[10px] font-mono text-muted-foreground">{centerLabel}</span>
      </div>
    </div>
  );
}
