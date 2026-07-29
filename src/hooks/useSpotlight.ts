import { useCallback, useEffect, useRef } from 'react';

/**
 * Pointer-following radial glow. Writes `--mx` / `--my` (percent) onto the
 * ref'd element so a CSS `radial-gradient(circle at var(--mx) var(--my), ...)`
 * layer follows the cursor. rAF-throttled; no-op when the device has no fine
 * pointer or the user prefers reduced motion.
 */
export function useSpotlight<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const frameRef = useRef<number | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const fine = window.matchMedia('(pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      enabledRef.current = fine.matches && !reduced.matches;
      if (!enabledRef.current && ref.current) {
        ref.current.style.removeProperty('--mx');
        ref.current.style.removeProperty('--my');
        ref.current.dataset.spotlight = 'off';
      } else if (ref.current) {
        ref.current.dataset.spotlight = 'on';
      }
    };
    update();
    fine.addEventListener?.('change', update);
    reduced.addEventListener?.('change', update);
    return () => {
      fine.removeEventListener?.('change', update);
      reduced.removeEventListener?.('change', update);
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    if (!enabledRef.current) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      el.style.setProperty('--mx', `${x}%`);
      el.style.setProperty('--my', `${y}%`);
    });
  }, []);

  const onPointerLeave = useCallback(() => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
