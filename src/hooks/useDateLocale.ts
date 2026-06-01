import { format as dateFnsFormat } from 'date-fns';
import { zhCN } from 'date-fns/locale/zh-CN';
import { useLanguage } from '@/hooks/useLanguage';
import { useCallback } from 'react';

export function useDateLocale() {
  const { lang } = useLanguage();

  const formatDate = useCallback(
    (date: Date | number, formatStr: string) => {
      return dateFnsFormat(date, formatStr, lang === 'zh' ? { locale: zhCN } : undefined);
    },
    [lang]
  );

  return { formatDate };
}
