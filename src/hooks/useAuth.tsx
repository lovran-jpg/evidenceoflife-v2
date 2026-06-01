import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authReady: boolean;
  signOut: () => Promise<void>;
  isDemo: boolean;
  enterDemo: () => void;
  resetLocalSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  authReady: false,
  signOut: async () => {},
  isDemo: false,
  enterDemo: () => {},
  resetLocalSession: async () => {},
});

const DEMO_USER: User = {
  id: 'demo-user-000',
  app_metadata: {},
  user_metadata: { display_name: 'Demo User' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User;

const clearAuthStorage = () => {
  const keys = Object.keys(window.localStorage);
  for (const key of keys) {
    if (key.startsWith('sb-') || key.includes('supabase.auth.token')) {
      window.localStorage.removeItem(key);
    }
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let finishedInitialLoad = false;

    const timeoutId = window.setTimeout(() => {
      if (!isMounted) return;
      finishedInitialLoad = true;
      setLoading(false);
      setAuthReady(true);
    }, 5000);

    const finishInitialLoad = () => {
      if (!isMounted || finishedInitialLoad) return;
      finishedInitialLoad = true;
      window.clearTimeout(timeoutId);
      setLoading(false);
      setAuthReady(true);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) setIsDemo(false);
      if (event !== 'INITIAL_SESSION' || !!nextSession?.user) {
        finishInitialLoad();
      }
    });

    const bootstrapSession = async (attempt = 0) => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (error) {
          throw error;
        }

        setSession(data.session);
        setUser(data.session?.user ?? null);
        finishInitialLoad();
      } catch (error) {
        if (!isMounted) return;

        const isAbortError = error instanceof Error && error.name === 'AbortError';
        if (isAbortError && attempt < 2) {
          window.setTimeout(() => {
            void bootstrapSession(attempt + 1);
          }, 250 * (attempt + 1));
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        const shouldResetLocalSession =
          /refresh token|invalid/i.test(message) ||
          (error instanceof Error && (error.name === 'AuthRetryableFetchError' || /load failed/i.test(message)));

        if (shouldResetLocalSession) {
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch (signOutError) {
            console.warn('Local sign-out failed during bootstrap cleanup:', signOutError);
          }
          clearAuthStorage();
          setSession(null);
          setUser(null);
          setIsDemo(false);
        }

        console.error('Auth session bootstrap failed:', error);
        finishInitialLoad();
      }
    };

    void bootstrapSession();

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const resetLocalSession = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.warn('Local sign-out failed, clearing storage directly:', error);
    }
    clearAuthStorage();
    setIsDemo(false);
    setUser(null);
    setSession(null);
    setLoading(false);
    setAuthReady(true);
  };

  const signOut = async () => {
    if (isDemo) {
      setIsDemo(false);
      setUser(null);
      setSession(null);
      return;
    }
    await resetLocalSession();
  };

  const enterDemo = () => {
    setIsDemo(true);
    setSession(null);
    setUser(DEMO_USER);
    setLoading(false);
    setAuthReady(true);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, authReady, signOut, isDemo, enterDemo, resetLocalSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
