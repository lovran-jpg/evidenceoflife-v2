import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, ReactNode } from 'react';

/**
 * User-selectable brand/accent color.
 *
 * The whole app derives its accent from a handful of CSS variables
 * (--primary, --ring, --dot-recorded, --sidebar-primary, --sidebar-ring).
 * We override them with an inline style on <html>, which beats both the light
 * `:root` and the dark `.dark` / media-query rules — so one value works for
 * light and dark alike. Terracotta (the original) stays as the default option,
 * so existing users see no change unless they pick something else.
 */

export interface AccentOption {
  id: string;
  labelZh: string;
  labelEn: string;
  /** Raw HSL triplet, e.g. "234 42% 62%" (no hsl() wrapper). */
  hsl: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  { id: 'terracotta', labelZh: '赤陶橘', labelEn: 'Terracotta', hsl: '18 45% 55%' },
  { id: 'indigo', labelZh: '靛蓝', labelEn: 'Indigo', hsl: '234 42% 62%' },
  { id: 'sage', labelZh: '鼠尾草绿', labelEn: 'Sage', hsl: '155 28% 48%' },
  { id: 'slate', labelZh: '石板蓝', labelEn: 'Slate blue', hsl: '212 38% 56%' },
  { id: 'plum', labelZh: '梅紫', labelEn: 'Plum', hsl: '285 30% 60%' },
  { id: 'rose', labelZh: '玫瑰', labelEn: 'Rose', hsl: '345 55% 62%' },
  { id: 'teal', labelZh: '青碧', labelEn: 'Teal', hsl: '182 40% 44%' },
];

const STORAGE_KEY = 'app-accent';
const DEFAULT_ID = 'terracotta';

const ACCENT_VARS = ['--primary', '--ring', '--dot-recorded', '--sidebar-primary', '--sidebar-ring'] as const;

function applyAccent(hsl: string | null) {
  const root = document.documentElement;
  ACCENT_VARS.forEach(v => {
    if (hsl) root.style.setProperty(v, hsl);
    else root.style.removeProperty(v);
  });
}

interface AccentColorContextType {
  accentId: string;
  setAccentId: (id: string) => void;
  options: AccentOption[];
}

const AccentColorContext = createContext<AccentColorContextType>({
  accentId: DEFAULT_ID,
  setAccentId: () => {},
  options: ACCENT_OPTIONS,
});

export function AccentColorProvider({ children }: { children: ReactNode }) {
  const [accentId, setAccentIdState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ACCENT_OPTIONS.some(o => o.id === stored)) return stored;
    } catch { /* ignore */ }
    return DEFAULT_ID;
  });

  // Apply before paint to avoid a flash of the default color.
  useLayoutEffect(() => {
    const opt = ACCENT_OPTIONS.find(o => o.id === accentId);
    // Terracotta is the CSS default — clear the override so the stylesheet's
    // own light/dark values take over for the original look.
    applyAccent(opt && opt.id !== DEFAULT_ID ? opt.hsl : null);
  }, [accentId]);

  const setAccentId = useCallback((id: string) => {
    if (!ACCENT_OPTIONS.some(o => o.id === id)) return;
    setAccentIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  }, []);

  const value = useMemo(
    () => ({ accentId, setAccentId, options: ACCENT_OPTIONS }),
    [accentId, setAccentId],
  );

  return <AccentColorContext.Provider value={value}>{children}</AccentColorContext.Provider>;
}

export const useAccentColor = () => useContext(AccentColorContext);
