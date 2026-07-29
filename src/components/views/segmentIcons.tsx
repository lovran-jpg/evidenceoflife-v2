// Solid (filled) glyphs for the plan time-segment headers and quick-add menu.
// lucide ships outline-only icons; these are custom filled shapes so all four
// segments read as one consistent, saturated single-colour set (currentColor)
// instead of the mixed monochrome/colour that emoji produced. Kept minimal and
// geometric to match the warm-editorial, low-noise aesthetic.

interface SegmentIconProps {
  size?: number;
  className?: string;
  /** Stroke width for the sun rays only; the discs/shapes stay solid. */
  strokeWidth?: number;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  'aria-hidden': true as const,
  focusable: false as const,
});

/** Anytime — two offset stacked cards: an unscheduled collection, no fixed hour. */
export function AnytimeIcon({ size = 16, className }: SegmentIconProps) {
  return (
    <svg {...base(size)} fill="currentColor" className={className}>
      <rect x="7.5" y="3.5" width="13" height="9" rx="2.6" opacity="0.45" />
      <rect x="3.5" y="8.5" width="13" height="12" rx="2.8" />
    </svg>
  );
}

/** Morning — a bold solid sun with short chunky rays. */
export function MorningIcon({ size = 16, className, strokeWidth = 2.1 }: SegmentIconProps) {
  return (
    <svg {...base(size)} fill="none" className={className}>
      <circle cx="12" cy="12" r="4.8" fill="currentColor" />
      <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round">
        <line x1="12" y1="2.2" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="21.8" />
        <line x1="2.2" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="21.8" y2="12" />
        <line x1="5.05" y1="5.05" x2="6.3" y2="6.3" />
        <line x1="17.7" y1="17.7" x2="18.95" y2="18.95" />
        <line x1="5.05" y1="18.95" x2="6.3" y2="17.7" />
        <line x1="17.7" y1="6.3" x2="18.95" y2="5.05" />
      </g>
    </svg>
  );
}

/** Afternoon — a solid sun peeking above a bold solid cloud. */
export function AfternoonIcon({ size = 16, className, strokeWidth = 2 }: SegmentIconProps) {
  return (
    <svg {...base(size)} fill="none" className={className}>
      <circle cx="15.5" cy="7.5" r="3.4" fill="currentColor" />
      <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round">
        <line x1="15.5" y1="1.4" x2="15.5" y2="3" />
        <line x1="21.6" y1="7.5" x2="23.2" y2="7.5" />
        <line x1="19.8" y1="3.2" x2="20.9" y2="2.1" />
      </g>
      <path d="M6.2 20.5h9a3.9 3.9 0 0 0 .3-7.78 5.1 5.1 0 0 0-9.76-1A3.9 3.9 0 0 0 6.2 20.5Z" fill="currentColor" />
    </svg>
  );
}

/** Evening — a fat, bold solid crescent moon. */
export function EveningIcon({ size = 16, className }: SegmentIconProps) {
  return (
    <svg {...base(size)} fill="currentColor" className={className}>
      <path d="M12.8 2.2a9.8 9.8 0 1 0 9 13.6A8 8 0 0 1 12.8 2.2Z" />
    </svg>
  );
}
