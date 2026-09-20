import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { consumePendingSignup, trackEvent } from '@/lib/analytics';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Prijava je u tijeku…');

  useEffect(() => {
    let mounted = true;

    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          const signupMethod = consumePendingSignup();
          if (signupMethod) {
            trackEvent('account_created', {
              method: signupMethod,
            });
          }
          navigate('/restaurants', { replace: true });
          return;
        }

        setMessage('Aktivna sesija nije pronađena. Prijavi se ponovno.');
      } catch (error: unknown) {
        console.error('OAuth callback error:', error);
        setMessage('Prijava nije uspjela. Pokušaj ponovno.');
      }
    };

    void handleCallback();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-semibold">Prijava</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
