import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

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
  const [stuck, setStuck] = useState(false);
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

  // If we sit on spinner too long, show recovery UI (no infinite spinner)
  useEffect(() => {
    if (currentUser) {
      waitStartedAtRef.current = null;
      setStuck(false);
      return;
    }

    if (authLoading) {
      if (!waitStartedAtRef.current) waitStartedAtRef.current = Date.now();
      return;
    }

    if (!waitStartedAtRef.current) waitStartedAtRef.current = Date.now();

    const t = window.setTimeout(() => {
      const started = waitStartedAtRef.current ?? Date.now();
      const elapsed = Date.now() - started;
      if (elapsed >= 7000 && !currentUser) {
        setStuck(true);
      }
    }, 7500);

    return () => window.clearTimeout(t);
  }, [authLoading, currentUser]);

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

          {stuck ? (
            <div className="max-w-md space-y-3">
              <p className="text-sm text-muted-foreground">
                A autenticação está demorando mais do que o esperado. Você pode tentar recuperar a sessão ou voltar para a tela de login.
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await ensureSession();
                    } finally {
                      // force re-render attempt
                      setStuck(false);
                    }
                  }}
                >
                  Tentar recuperar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const returnUrl = location.pathname + location.search;
                    navigate('/auth', { replace: true, state: { returnUrl } });
                  }}
                >
                  Ir para login
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Dica: para diagnóstico, abra o console e ative <code className="px-1 py-0.5 rounded bg-muted">localStorage.DEBUG_AUTH='1'</code> e tente novamente.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
