import { useEffect, useState } from 'react';

/**
 * Tracks whether the document is currently rendering in dark mode.
 *
 * Reacts to BOTH:
 *   • the OS-level `prefers-color-scheme: dark` media query
 *   • a manual `dark` class toggled on `<html>` (used when the app
 *     overrides system preference)
 *
 * Use sparingly — most theme-aware styling should live in CSS via
 * Tailwind's `dark:` variants or HSL custom properties. Reach for this
 * hook only when you need to compute inline-style hex / alpha values
 * that can't be expressed declaratively.
 */
export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    if (document.documentElement.classList.contains('dark')) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const recompute = () => {
      const hasClass = document.documentElement.classList.contains('dark');
      setIsDark(hasClass || mq.matches);
    };
    recompute();
    mq.addEventListener('change', recompute);
    const observer = new MutationObserver(recompute);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => {
      mq.removeEventListener('change', recompute);
      observer.disconnect();
    };
  }, []);

  return isDark;
}
