import { useState, useEffect } from 'react';
import { Link, ExternalLink, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getDomain as getSiteFallback,
  buildProxyImageUrl,
  getFaviconUrl,
} from '@/lib/linkUtils';
import type { DueLink } from '@/hooks/useDues';

export function hasRichPreview(link: Partial<DueLink> | undefined): boolean {
  if (!link?.url) return false;
  const siteFallback = getSiteFallback(link.url).toLowerCase();
  const title = (link.title || '').trim().toLowerCase();
  const description = (link.description || '').trim();
  return Boolean(
    description ||
    (title && title !== siteFallback && title !== link.url.toLowerCase())
  );
}

export function getLinkDisplayName(link: Partial<DueLink>): string {
  return link.label?.trim() || link.title?.trim() || link.siteName?.trim() || getSiteFallback(link.url || '');
}

export function CompactHabitLinkThumb({ link }: { link: Partial<DueLink> }) {
  const [mode, setMode] = useState<'image' | 'favicon' | 'icon'>(() => {
    return link.image ? 'image' : link.url ? 'favicon' : 'icon';
  });

  useEffect(() => {
    setMode(link.image ? 'image' : link.url ? 'favicon' : 'icon');
  }, [link.image, link.url]);

  if (mode === 'icon') {
    return (
      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-border/70 bg-[hsl(var(--surface-soft))] text-muted-foreground/70">
        <Link size={12} />
      </div>
    );
  }

  const src = mode === 'image' && link.image
    ? buildProxyImageUrl(link.image)
    : link.url
      ? getFaviconUrl(link.url)
      : '';

  return (
    <img
      src={src}
      alt=""
      className={cn(
        "h-5 w-5 flex-shrink-0 rounded-md border border-border/60 bg-white/85",
        mode === 'image' ? "object-cover" : "object-contain p-0.5"
      )}
      onError={() => {
        setMode((current) => {
          if (current === 'image' && link.url) return 'favicon';
          return 'icon';
        });
      }}
    />
  );
}

export function LightweightLinkItem({
  link,
  onRemove,
  onRename,
  compact = false,
}: {
  link: Partial<DueLink>;
  onRemove?: () => void;
  onRename?: (nextLabel: string) => void;
  compact?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(getLinkDisplayName(link));
  const siteName = link.siteName || (link.url ? getSiteFallback(link.url) : '');

  useEffect(() => {
    setDraftLabel(getLinkDisplayName(link));
  }, [link.label, link.title, link.siteName, link.url]);

  const save = () => {
    const next = draftLabel.trim();
    if (next && next !== getLinkDisplayName(link)) onRename?.(next);
    setIsEditing(false);
  };

  return (
    <div className={cn(
      "group flex items-center gap-2.5 rounded-xl border border-border/60 bg-[hsl(var(--surface-soft))] px-3",
      compact ? "min-h-[48px] py-2" : "min-h-[64px] py-2.5"
    )}>
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') {
                setDraftLabel(getLinkDisplayName(link));
                setIsEditing(false);
              }
            }}
            className="w-full bg-transparent text-[13px] font-medium text-foreground focus:outline-none"
            autoFocus
          />
        ) : (
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-[13px] font-medium text-foreground hover:underline"
          >
            {getLinkDisplayName(link)}
          </a>
        )}
        <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.08em] text-muted-foreground/65">
          {siteName}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onRename && !isEditing && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setDraftLabel(getLinkDisplayName(link));
              setIsEditing(true);
            }}
            className="rounded-full p-1 text-muted-foreground/55 transition-colors hover:text-foreground"
          >
            <Pencil size={11} />
          </button>
        )}
        {link.url && (
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full p-1 text-muted-foreground/55 transition-colors hover:text-foreground"
          >
            <ExternalLink size={11} />
          </a>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onRemove();
            }}
            className="rounded-full p-1 text-muted-foreground/55 transition-colors hover:text-destructive"
          >
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
