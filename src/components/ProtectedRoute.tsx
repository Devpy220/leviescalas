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

  useEffect(() => {
    // Wait for auth context to finish loading
    if (authLoading) return;

    // If we have a user or session, we're good
    if (user || session) {
      setVerified(true);
      recoveryAttemptedRef.current = false; // Reset for future navigations
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

    // No user and no session after auth loaded.
    // Try ONE safe recovery (common after the tab sleeps / laptop resumes).
    // Also set a hard timeout so we never show an infinite spinner if recovery hangs.
    let cancelled = false;
    const hardTimeout = window.setTimeout(() => {
      if (cancelled) return;
      recoveryAttemptedRef.current = true;
      const returnUrl = location.pathname + location.search;
      navigate('/auth', {
        replace: true,
        state: { returnUrl },
      });
    }, 8000);
    
    // Add 300ms delay before attempting recovery to let React state synchronize
    const recoveryDelay = window.setTimeout(async () => {
      if (cancelled) return;
      
      // Check again if user/session appeared during the delay
      if (user || session) {
        window.clearTimeout(hardTimeout);
        setVerified(true);
        return;
      }
      
      // Mark that we're attempting recovery
      recoveryAttemptedRef.current = true;
      
      const recovered = await ensureSession();
      if (cancelled) return;

      window.clearTimeout(hardTimeout);
      
      if (recovered?.user) {
        setVerified(true);
        return;
      }

      // Store the intended destination so we can redirect back after login
      const returnUrl = location.pathname + location.search;
      navigate('/auth', {
        replace: true,
        state: { returnUrl },
      });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(hardTimeout);
      window.clearTimeout(recoveryDelay);
    };
  }, [user, session, authLoading, ensureSession, navigate, location.pathname, location.search]);

  // Show loading spinner while auth is loading or not yet verified
  if (authLoading || (!verified && !user && !session)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // User is verified, render children
  return <>{children}</>;
}
