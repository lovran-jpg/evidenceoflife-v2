import type { ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

/**
 * Shared "deleted — Undo" toast so every destructive action across the app
 * feels the same: delete happens instantly (no blocking dialog), then a brief
 * window to restore the exact thing that was removed.
 */
export function showUndoToast(opts: {
  description: ReactNode;
  undoLabel: string;
  onUndo: () => void;
  duration?: number;
}) {
  const { dismiss } = toast({
    description: opts.description,
    action: (
      <ToastAction altText={opts.undoLabel} onClick={() => { opts.onUndo(); dismiss(); }}>
        {opts.undoLabel}
      </ToastAction>
    ),
  });
  const timer = setTimeout(() => dismiss(), opts.duration ?? 6000);
  return () => { clearTimeout(timer); dismiss(); };
}
