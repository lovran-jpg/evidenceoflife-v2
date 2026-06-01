import { useState } from 'react';
import { BrandLogo } from '@/components/BrandLogo';

interface TopNavProps {
  activeTab: unknown;
  onTabChange: (tab: unknown) => void;
}

export function TopNav({ activeTab, onTabChange }: TopNavProps) {
  void activeTab;
  void onTabChange;
  const [logoVisible, setLogoVisible] = useState(true);

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/60">
      <div className="flex items-center px-3 sm:px-4 h-9">
        {/* Logo + Title */}
        <div className="flex items-center gap-1">
          {logoVisible ? (
            <span onError={() => setLogoVisible(false) as never}>
              <BrandLogo alt="Logo" className="w-7 h-7" />
            </span>
          ) : (
            <span className="inline-flex h-7 w-7 items-center justify-center text-[13px] leading-none text-[hsl(var(--text-soft))]">◌</span>
          )}
          <span
            className="font-brand text-base sm:text-xl text-foreground leading-none"
          >
            Evidence of life
          </span>
        </div>
      </div>
    </header>
  );
}
