import { ChangeEvent, useRef } from 'react';
import { Camera, Check, Monitor, Moon, RotateCcw, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, ThemeMode } from '@/hooks/useTheme';
import { useAccentColor } from '@/hooks/useAccentColor';

interface AppearanceEditorProps {
  lang: string;
  homepageImageUrl: string | null | undefined;
  uploading: boolean;
  onUploadImage: (e: ChangeEvent<HTMLInputElement>) => void;
  onResetImage: () => void;
}

const THEME_MODES: { id: ThemeMode; labelZh: string; labelEn: string; Icon: typeof Sun }[] = [
  { id: 'system', labelZh: '跟随系统', labelEn: 'System', Icon: Monitor },
  { id: 'light', labelZh: '明亮', labelEn: 'Light', Icon: Sun },
  { id: 'dark', labelZh: '暗色', labelEn: 'Dark', Icon: Moon },
];

export function AppearanceEditor({ lang, homepageImageUrl, uploading, onUploadImage, onResetImage }: AppearanceEditorProps) {
  const { mode, setMode } = useTheme();
  const { accentId, setAccentId, options: accentOptions } = useAccentColor();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-[24px] border border-border/55 bg-card/72 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/45">
            {lang === 'zh' ? '外观' : 'Appearance'}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground/58">
            {lang === 'zh' ? '主题、品牌色与主页氛围图。' : 'Theme, brand color, and home image.'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/55">
            {lang === 'zh' ? '主题' : 'Theme'}
          </p>
          <div className="inline-flex rounded-full border border-border/65 bg-background p-1">
            {THEME_MODES.map(({ id, labelZh, labelEn, Icon }) => {
              const selected = mode === id;
              return (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  aria-pressed={selected}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                    selected ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon size={13} />
                  {lang === 'zh' ? labelZh : labelEn}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/55">
            {lang === 'zh' ? '主题色' : 'Accent color'}
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            {accentOptions.map(opt => {
              const selected = opt.id === accentId;
              return (
                <button
                  key={opt.id}
                  onClick={() => setAccentId(opt.id)}
                  title={lang === 'zh' ? opt.labelZh : opt.labelEn}
                  aria-label={`${opt.labelEn} accent`}
                  aria-pressed={selected}
                  className={cn(
                    'relative h-8 w-8 rounded-full transition-transform hover:scale-105 focus:outline-none',
                    selected ? 'scale-105' : 'ring-1 ring-border/50',
                  )}
                  style={{
                    backgroundColor: `hsl(${opt.hsl})`,
                    ...(selected ? { boxShadow: `0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(${opt.hsl})` } : {}),
                  }}
                >
                  {selected && <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/55">
            {lang === 'zh' ? '主页氛围图' : 'Home image'}
          </p>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onUploadImage} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/65 bg-background px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <Camera size={13} />
              {uploading ? '…' : lang === 'zh' ? '更换' : 'Change'}
            </button>
            <button
              onClick={onResetImage}
              disabled={!homepageImageUrl}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/65 bg-background px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <RotateCcw size={13} />
              {lang === 'zh' ? '恢复默认' : 'Reset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
