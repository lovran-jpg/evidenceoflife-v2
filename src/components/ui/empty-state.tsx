import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  variant?: 'centered' | 'inline';
  className?: string;
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
  variant = 'centered',
  className,
}: EmptyStateProps) {
  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'rounded-3xl border border-dashed border-border/70 bg-card/45 px-4 py-6 text-center',
          className,
        )}
      >
        <p className="text-[13px] font-medium text-muted-foreground/65">{title}</p>
        {hint && (
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground/55">{hint}</p>
        )}
        {action && <div className="mt-3 flex justify-center">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mx-auto mt-12 flex max-w-[320px] flex-col items-center text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--surface-soft))] text-muted-foreground/55">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-semibold tracking-[-0.02em] text-foreground/85">
        {title}
      </p>
      {hint && (
        <p className="mt-1.5 text-[12.5px] leading-5 text-muted-foreground/60">{hint}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
