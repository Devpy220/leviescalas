import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute component that centralizes authentication checks
 * for protected pages. This prevents multiple getSession() calls
 * and race conditions that cause rate limiting (429 errors).
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, session, loading: authLoading, ensureSession } = useAuth();
  const [verified, setVerified] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Guard to prevent infinite recovery loops
  const recoveryAttemptedRef = useRef(false);
  // Guard to prevent concurrent recovery attempts
  const isRecoveringRef = useRef(false);
  // Track how long we've been waiting (for UX + diagnostics)
  const waitStartedAtRef = useRef<number | null>(null);

  // CRITICAL: Derive currentUser from either user OR session.user
  // This ensures pages always have access to identity data
  const currentUser = user ?? session?.user ?? null;

  // Debug log (enable via localStorage.DEBUG_AUTH = '1')
  const debug = (() => {
    try {
      return localStorage.getItem('DEBUG_AUTH') === '1';
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (debug) {
      console.log('[ProtectedRoute] state', {
        path: location.pathname,
        authLoading,
        hasUser: !!user,
        hasSession: !!session,
        hasCurrentUser: !!currentUser,
        verified,
      });
    }
  }, [debug, location.pathname, authLoading, user, session, currentUser, verified]);

  // Auto-redirect to /auth after 5 seconds if no session is found
  useEffect(() => {
    if (currentUser) {
      waitStartedAtRef.current = null;
      return;
    }

    if (!waitStartedAtRef.current) waitStartedAtRef.current = Date.now();

    const t = window.setTimeout(() => {
      if (!currentUser) {
        console.warn('[ProtectedRoute] Auto-redirect: no session after 5s');
        const returnUrl = location.pathname + location.search;
        navigate('/auth', { replace: true, state: { returnUrl } });
      }
    }, 5000);

    return () => window.clearTimeout(t);
  }, [authLoading, currentUser, navigate, location.pathname, location.search]);

  useEffect(() => {
    // Wait for auth context to finish loading
    if (authLoading) return;

    // Only consider verified when we have a CURRENT USER
    if (currentUser) {
      setVerified(true);
      recoveryAttemptedRef.current = false; // Reset for future navigations
      isRecoveringRef.current = false;
      return;
    }

    // If we already attempted recovery and failed, redirect immediately
    if (recoveryAttemptedRef.current) {
      const returnUrl = location.pathname + location.search;
      navigate('/auth', {
        replace: true,
        state: { returnUrl },
      });
      return;
    }

    // Prevent concurrent recovery attempts
    if (isRecoveringRef.current) return;

    let cancelled = false;
    isRecoveringRef.current = true;

    const hardTimeout = window.setTimeout(() => {
      if (cancelled) return;
      recoveryAttemptedRef.current = true;
      isRecoveringRef.current = false;
      const returnUrl = location.pathname + location.search;
      navigate('/auth', { replace: true, state: { returnUrl } });
    }, 5000);

    // Small delay to let React state synchronize
    const recoveryDelay = window.setTimeout(() => {
      if (cancelled) return;

      (async () => {
        try {
          const recovered = await ensureSession();
          if (cancelled) return;

          window.clearTimeout(hardTimeout);

          if (recovered?.user) {
            setVerified(true);
            isRecoveringRef.current = false;
            return;
          }

          recoveryAttemptedRef.current = true;
          isRecoveringRef.current = false;
          const returnUrl = location.pathname + location.search;
          navigate('/auth', { replace: true, state: { returnUrl } });
        } catch {
          if (cancelled) return;
          isRecoveringRef.current = false;
          recoveryAttemptedRef.current = true;
          const returnUrl = location.pathname + location.search;
          navigate('/auth', { replace: true, state: { returnUrl } });
        }
      })();
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(hardTimeout);
      window.clearTimeout(recoveryDelay);
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
