import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute - single-pass auth check with 5s timeout.
 * Eliminates duplicate timers and concurrent recovery attempts.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, session, loading: authLoading, ensureSession } = useAuth();
  const [verified, setVerified] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const recoveryDoneRef = useRef(false);

  const currentUser = user ?? session?.user ?? null;

  useEffect(() => {
    // Still loading auth context — wait
    if (authLoading) return;

    // User found — done
    if (currentUser) {
      setVerified(true);
      recoveryDoneRef.current = false;
      return;
    }

    // Already tried recovery and failed — redirect immediately
    if (recoveryDoneRef.current) {
      const returnUrl = location.pathname + location.search;
      navigate('/auth', { replace: true, state: { returnUrl } });
      return;
    }

    // Single recovery attempt with hard 5s timeout
    let cancelled = false;
    recoveryDoneRef.current = true;

    const hardTimeout = window.setTimeout(() => {
      if (cancelled) return;
      const returnUrl = location.pathname + location.search;
      navigate('/auth', { replace: true, state: { returnUrl } });
    }, 5000);

    // Small delay then try ensureSession
    const delay = window.setTimeout(() => {
      if (cancelled) return;
      (async () => {
        try {
          const recovered = await ensureSession();
          if (cancelled) return;
          window.clearTimeout(hardTimeout);
          if (recovered?.user) {
            setVerified(true);
            return;
          }
        } catch {
          // fall through to redirect
        }
        if (!cancelled) {
          window.clearTimeout(hardTimeout);
          const returnUrl = location.pathname + location.search;
          navigate('/auth', { replace: true, state: { returnUrl } });
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(hardTimeout);
      window.clearTimeout(delay);
    };
  }, [currentUser, authLoading, ensureSession, navigate, location.pathname, location.search]);

  if (authLoading || !verified || !currentUser) {
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
