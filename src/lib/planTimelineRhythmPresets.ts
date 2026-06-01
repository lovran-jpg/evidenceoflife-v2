/**
 * Planned vs focused fills for the Plan “Execution” rhythm chart.
 * Persisted preset id elsewhere (localStorage); this module is pure data + lookup.
 */

export type PlanTimelineRhythmPalette = {
  plannedLight: string;
  plannedDark: string;
  focusedLight: string;
  focusedDark: string;
};

export type PlanTimelineRhythmPreset = {
  id: string;
  labelEn: string;
  labelZh: string;
  /** Short subtitle for picker */
  hintEn?: string;
  hintZh?: string;
} & PlanTimelineRhythmPalette;

export const PLAN_TIMELINE_RHYTHM_PRESETS: readonly PlanTimelineRhythmPreset[] = [
  {
    id: 'warm',
    labelEn: 'Warm default',
    labelZh: '暖色默认',
    hintEn: 'Matches app primary',
    hintZh: '与主题主色一致',
    plannedLight: 'rgba(60, 60, 67, 0.10)',
    plannedDark: 'hsl(0 0% 96% / 0.11)',
    focusedLight: 'hsl(var(--primary) / 0.50)',
    focusedDark: 'hsl(var(--primary) / 0.52)',
  },
  {
    id: 'rose',
    labelEn: 'Dusty rose',
    labelZh: '雾玫瑰',
    hintEn: 'Soft pink focus bars',
    hintZh: '粉调专注柱',
    plannedLight: 'rgba(58, 55, 60, 0.11)',
    plannedDark: 'hsl(320 12% 88% / 0.09)',
    focusedLight: 'rgba(178, 115, 140, 0.52)',
    focusedDark: 'rgba(218, 150, 175, 0.45)',
  },
  {
    id: 'forest',
    labelEn: 'Forest calm',
    labelZh: '森绿沉静',
    plannedLight: 'rgba(52, 58, 55, 0.10)',
    plannedDark: 'hsl(150 12% 90% / 0.09)',
    focusedLight: 'hsl(152 42% 30% / 0.46)',
    focusedDark: 'hsl(154 48% 48% / 0.42)',
  },
  {
    id: 'ocean',
    labelEn: 'Ocean slate',
    labelZh: '海蓝石板',
    plannedLight: 'rgba(53, 60, 68, 0.11)',
    plannedDark: 'hsl(210 14% 90% / 0.09)',
    focusedLight: 'hsl(198 62% 36% / 0.46)',
    focusedDark: 'hsl(195 58% 55% / 0.44)',
  },
  {
    id: 'ink',
    labelEn: 'Ink monochrome',
    labelZh: '墨色单色',
    plannedLight: 'rgba(24, 24, 26, 0.09)',
    plannedDark: 'hsl(0 0% 100% / 0.08)',
    focusedLight: 'hsl(30 10% 22% / 0.40)',
    focusedDark: 'hsl(0 0% 72% / 0.38)',
  },
] as const;

export const DEFAULT_PLAN_TIMELINE_RHYTHM_PRESET_ID = 'warm';

export function getPlanTimelineRhythmPreset(id: string): PlanTimelineRhythmPreset {
  const found = PLAN_TIMELINE_RHYTHM_PRESETS.find((p) => p.id === id);
  return found ?? PLAN_TIMELINE_RHYTHM_PRESETS[0];
}

export const PLAN_TIMELINE_RHYTHM_STORAGE_KEY = 'eol.planTimelineRhythmPresetId';

export function loadPlanTimelineRhythmPresetId(): string {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(PLAN_TIMELINE_RHYTHM_STORAGE_KEY) : null;
    if (v && PLAN_TIMELINE_RHYTHM_PRESETS.some((p) => p.id === v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_PLAN_TIMELINE_RHYTHM_PRESET_ID;
}

export function persistPlanTimelineRhythmPresetId(id: string): void {
  try {
    if (!PLAN_TIMELINE_RHYTHM_PRESETS.some((p) => p.id === id)) return;
    localStorage.setItem(PLAN_TIMELINE_RHYTHM_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function presetToRhythmPalette(p: PlanTimelineRhythmPreset): PlanTimelineRhythmPalette {
  return {
    plannedLight: p.plannedLight,
    plannedDark: p.plannedDark,
    focusedLight: p.focusedLight,
    focusedDark: p.focusedDark,
  };
}

/** “Now” line + dot — same preset family as rhythm chart so the picker visibly updates the timeline rail. */
export type RhythmNowMarkers = {
  dot: string;
  lineGradient: string;
  glow: string;
};

const PRIMARY_NOW: RhythmNowMarkers = {
  dot: 'hsl(var(--primary) / 0.82)',
  lineGradient:
    'linear-gradient(to right, hsl(var(--primary) / 0.30) 0%, hsl(var(--primary) / 0.14) 40%, hsl(var(--primary) / 0.04) 74%, transparent 100%)',
  glow: '0 0 0 3px hsl(var(--primary) / 0.09), 0 0 10px hsl(var(--primary) / 0.28)',
};

export function presetToNowMarkers(preset: PlanTimelineRhythmPreset, isDark: boolean): RhythmNowMarkers {
  const f = (isDark ? preset.focusedDark : preset.focusedLight).trim();
  if (f.includes('var(--primary)')) return PRIMARY_NOW;

  const rgbaMatch = f.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (rgbaMatch) {
    const r = rgbaMatch[1];
    const g = rgbaMatch[2];
    const b = rgbaMatch[3];
    const a = rgbaMatch[4] != null ? parseFloat(rgbaMatch[4]) : 1;
    return {
      dot: `rgba(${r},${g},${b},${Math.min(1, a + 0.38)})`,
      lineGradient: `linear-gradient(to right, rgba(${r},${g},${b},${Math.min(0.55, a + 0.06)}) 0%, rgba(${r},${g},${b},${Math.max(0.08, a * 0.42)}) 45%, transparent 100%)`,
      glow: `0 0 0 2px rgba(${r},${g},${b},0.32), 0 0 8px rgba(${r},${g},${b},0.22)`,
    };
  }

  if (f.startsWith('hsl(') && f.endsWith(')')) {
    const inner = f.slice(4, -1).trim();
    const slashIdx = inner.lastIndexOf('/');
    if (slashIdx > 0 && !inner.includes('var(')) {
      const body = inner.slice(0, slashIdx).trim();
      const alpha = parseFloat(inner.slice(slashIdx + 1));
      if (Number.isFinite(alpha) && body.length > 0) {
        return {
          dot: `hsl(${body} / ${Math.min(0.95, alpha + 0.42)})`,
          lineGradient: `linear-gradient(to right, hsl(${body} / ${Math.min(0.42, alpha + 0.06)}) 0%, hsl(${body} / ${Math.max(0.08, alpha * 0.32)}) 45%, transparent 100%)`,
          glow: `0 0 0 3px hsl(${body} / ${Math.min(0.2, alpha + 0.08)}), 0 0 10px hsl(${body} / ${Math.min(0.26, alpha + 0.1)})`,
        };
      }
    }
  }

  return PRIMARY_NOW;
}
