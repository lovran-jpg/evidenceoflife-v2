import { useCallback, useEffect, useState } from 'react';
import {
  getWorkTypeKey,
  readWorkTypeOverrides,
  resolveWorkType,
  WorkType,
  WorkTypeEntity,
  WORK_TYPE_EVENT,
  writeWorkTypeOverrides,
} from '@/lib/workType';

export function useWorkTypes() {
  const [overrides, setOverrides] = useState(readWorkTypeOverrides);

  useEffect(() => {
    const sync = () => setOverrides(readWorkTypeOverrides());
    window.addEventListener('storage', sync);
    window.addEventListener(WORK_TYPE_EVENT, sync as EventListener);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(WORK_TYPE_EVENT, sync as EventListener);
    };
  }, []);

  const setWorkType = useCallback((entity: WorkTypeEntity, id: string, type: WorkType | null) => {
    setOverrides(prev => {
      const next = { ...prev };
      const key = getWorkTypeKey(entity, id);
      if (type) next[key] = type;
      else delete next[key];
      writeWorkTypeOverrides(next);
      return next;
    });
  }, []);

  const getWorkType = useCallback((input: {
    entity: WorkTypeEntity;
    id: string;
    title?: string;
    text?: string;
    tags?: string[];
  }) => {
    return resolveWorkType({ ...input, overrides });
  }, [overrides]);

  return {
    overrides,
    getWorkType,
    setWorkType,
  };
}
