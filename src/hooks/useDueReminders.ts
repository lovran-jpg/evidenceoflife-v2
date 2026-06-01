import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DueReminder {
  id: string;
  user_id: string;
  due_id: string;
  reminder_type: 'browser' | 'email';
  remind_before_minutes: number;
  is_recurring: boolean;
  recurring_interval_days: number | null;
  is_active: boolean;
  last_notified_at: string | null;
  created_at: string;
}

export function useDueReminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<DueReminder[]>([]);

  const fetchReminders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('due_reminders' as any)
      .select('*')
      .eq('user_id', user.id);
    if (data) setReminders(data as any as DueReminder[]);
  }, [user]);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const getRemindersForDue = useCallback((dueId: string) => {
    return reminders.filter(r => r.due_id === dueId);
  }, [reminders]);

  const upsertReminder = useCallback(async (dueId: string, type: 'browser' | 'email', beforeMinutes: number, isRecurring = false, intervalDays?: number) => {
    if (!user) return;
    // Check if exists
    const existing = reminders.find(r => r.due_id === dueId && r.reminder_type === type);
    if (existing) {
      await supabase
        .from('due_reminders' as any)
        .update({ remind_before_minutes: beforeMinutes, is_recurring: isRecurring, recurring_interval_days: intervalDays || null, is_active: true } as any)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('due_reminders' as any)
        .insert({ user_id: user.id, due_id: dueId, reminder_type: type, remind_before_minutes: beforeMinutes, is_recurring: isRecurring, recurring_interval_days: intervalDays || null } as any);
    }
    await fetchReminders();
  }, [user, reminders, fetchReminders]);

  const removeReminder = useCallback(async (reminderId: string) => {
    await supabase.from('due_reminders' as any).delete().eq('id', reminderId);
    setReminders(prev => prev.filter(r => r.id !== reminderId));
  }, []);

  const toggleReminder = useCallback(async (reminderId: string) => {
    const r = reminders.find(rem => rem.id === reminderId);
    if (!r) return;
    await supabase.from('due_reminders' as any).update({ is_active: !r.is_active } as any).eq('id', reminderId);
    setReminders(prev => prev.map(rem => rem.id === reminderId ? { ...rem, is_active: !rem.is_active } : rem));
  }, [reminders]);

  return { reminders, getRemindersForDue, upsertReminder, removeReminder, toggleReminder, refetch: fetchReminders };
}
