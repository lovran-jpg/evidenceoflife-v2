interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title = "Evidence of life" }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-end px-5 py-3">
      <span className="font-brand text-lg text-muted-foreground">{title}</span>
    </header>
  );
}
