import { useEffect, useCallback, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';

const STORAGE_KEY = 'life-reminder-config';
const LAST_NOTIFIED_KEY = 'life-reminder-last';

export interface ReminderConfig {
  enabled: boolean;
  intervalHours: number; // 1, 2, 3, 4
}

const DEFAULT_CONFIG: ReminderConfig = { enabled: false, intervalHours: 2 };

function getConfig(): ReminderConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}

function saveConfig(c: ReminderConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

export function useLifeReminder(options?: { disabled?: boolean }) {
  const { lang } = useLanguage();
  const disabled = options?.disabled ?? false;
  const [config, setConfigState] = useState<ReminderConfig>(getConfig);

  const setConfig = useCallback((updates: Partial<ReminderConfig>) => {
    setConfigState(prev => {
      const next = { ...prev, ...updates };
      saveConfig(next);
      return next;
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }, []);

  // Periodic check
  useEffect(() => {
    if (disabled) return;
    if (!config.enabled) return;

    const check = () => {
      if (Notification.permission !== 'granted') return;

      const now = Date.now();
      const last = parseInt(localStorage.getItem(LAST_NOTIFIED_KEY) || '0', 10);
      const intervalMs = config.intervalHours * 60 * 60 * 1000;

      // Don't notify between 11pm and 7am
      const hour = new Date().getHours();
      if (hour >= 23 || hour < 7) return;

      if (now - last >= intervalMs) {
        localStorage.setItem(LAST_NOTIFIED_KEY, String(now));

        const titles = lang === 'zh'
          ? ['刚刚发生了什么？', '记录一下这个瞬间 ✨', '你刚刚在做什么？', '留下生活的痕迹 🌱']
          : ['What just happened?', 'Capture this moment ✨', 'What did you just do?', 'Leave evidence of life 🌱'];

        const title = titles[Math.floor(Math.random() * titles.length)];
        const body = lang === 'zh' ? '点击记录你的生活瞬间' : 'Tap to record your life moment';

        try {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
            tag: 'life-reminder',
            silent: false,
          });
        } catch { /* ignore */ }
      }
    };

    check();
    const interval = setInterval(check, 60 * 1000); // check every minute
    return () => clearInterval(interval);
  }, [config.enabled, config.intervalHours, lang, disabled]);

  return { config, setConfig, requestPermission };
}
