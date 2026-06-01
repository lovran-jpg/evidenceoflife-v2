import lightLogo from '@/assets/evidence-logo-light.png';
import darkLogo from '@/assets/evidence-logo-dark.png';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  alt?: string;
  className?: string;
}

export function BrandLogo({ alt = 'Evidence of Life', className }: BrandLogoProps) {
  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={darkLogo} />
      <img
        src={lightLogo}
        alt={alt}
        className={cn('object-contain', className)}
      />
    </picture>
  );
}
