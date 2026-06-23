import { ReactNode } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export function SheetHeader({
  title,
  subtitle,
  right,
  secondaryRow,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  secondaryRow?: ReactNode;
  className?: string;
}) {
  return (
    <PageHeader
      variant="sheet"
      title={title}
      subtitle={subtitle}
      right={right}
      secondaryRow={secondaryRow}
      className={className}
    />
  );
}

export function SheetEmptyState({
  icon,
  title,
  hint,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return <EmptyState variant="centered" icon={icon} title={title} hint={hint} className={className} />;
}
