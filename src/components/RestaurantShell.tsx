import { Link, useLocation } from 'react-router-dom';

export function RestaurantShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh min-w-0 bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95 px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-3">
            <Link to="/restaurants" className="text-lg font-semibold">Dnevnik restorana</Link>
            <Link to="/app" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Stara aplikacija</Link>
          </div>
          <nav aria-label="Dnevnik restorana" className="mt-3 flex gap-2">
            <Link to="/restaurants" aria-current={pathname.startsWith('/restaurants') ? 'page' : undefined} className={`min-h-11 flex-1 rounded-xl px-4 py-3 text-center text-sm font-medium ${pathname.startsWith('/restaurants') ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>Restorani</Link>
            <Link to="/calendar" aria-current={pathname === '/calendar' ? 'page' : undefined} className={`min-h-11 flex-1 rounded-xl px-4 py-3 text-center text-sm font-medium ${pathname === '/calendar' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>Kalendar</Link>
            <Link to="/map" aria-current={pathname === '/map' ? 'page' : undefined} className={`min-h-11 flex-1 rounded-xl px-4 py-3 text-center text-sm font-medium ${pathname === '/map' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>Mapa</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl min-w-0 px-4 pb-28 pt-6">{children}</main>
    </div>
  );
}
