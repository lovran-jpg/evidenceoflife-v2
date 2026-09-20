import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

export function RestaurantShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate('/auth', { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-dvh min-w-0 bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <Link to="/restaurants" className="text-lg font-semibold">Dnevnik restorana</Link>
            <Button type="button" variant="ghost" className="min-h-11 shrink-0 px-3 text-muted-foreground" disabled={signingOut} onClick={() => void handleSignOut()}>
              <LogOut aria-hidden="true" /> {signingOut ? 'Odjava…' : 'Odjava'}
            </Button>
          </div>
          <nav aria-label="Dnevnik restorana" className="mt-3 flex gap-2">
            <Link to="/restaurants" aria-current={pathname.startsWith('/restaurants') ? 'page' : undefined} className={`min-h-11 flex-1 rounded-xl px-4 py-3 text-center text-sm font-medium ${pathname.startsWith('/restaurants') ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>Restorani</Link>
            <Link to="/calendar" aria-current={pathname === '/calendar' ? 'page' : undefined} className={`min-h-11 flex-1 rounded-xl px-4 py-3 text-center text-sm font-medium ${pathname === '/calendar' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>Kalendar</Link>
            <Link to="/map" aria-current={pathname === '/map' ? 'page' : undefined} className={`min-h-11 flex-1 rounded-xl px-4 py-3 text-center text-sm font-medium ${pathname === '/map' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>Mapa</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl min-w-0 px-4 pb-[max(7rem,calc(env(safe-area-inset-bottom)+5rem))] pt-6">{children}</main>
    </div>
  );
}
