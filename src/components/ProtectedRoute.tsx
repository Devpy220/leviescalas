import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute - checks React state first, then falls back to
 * supabase.auth.getSession() to avoid race conditions during hydration.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, session, loading: authLoading } = useAuth();
  const [verified, setVerified] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const checkDoneRef = useRef(false);

  const currentUser = user ?? session?.user ?? null;

  useEffect(() => {
    if (authLoading) return;

    // User found in React state — done
    if (currentUser) {
      setVerified(true);
      checkDoneRef.current = false;
      return;
    }

    // User disappeared after being verified — real logout
    if (verified) {
      const returnUrl = location.pathname + location.search;
      navigate('/auth', { replace: true, state: { returnUrl } });
      return;
    }

    // Already checked storage and failed — redirect
    if (checkDoneRef.current) {
      const returnUrl = location.pathname + location.search;
      navigate('/auth', { replace: true, state: { returnUrl } });
      return;
    }

    // Single check: look directly in Supabase storage
    let cancelled = false;
    checkDoneRef.current = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session?.user) {
          // Session exists in storage, React just hasn't hydrated yet
          setVerified(true);
          return;
        }
      } catch {
        // fall through
      }
      if (!cancelled) {
        const returnUrl = location.pathname + location.search;
        navigate('/auth', { replace: true, state: { returnUrl } });
      }
    })();

    return () => { cancelled = true; };
  }, [currentUser, authLoading, verified, navigate, location.pathname, location.search]);

  if (authLoading || !verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando sessão…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
