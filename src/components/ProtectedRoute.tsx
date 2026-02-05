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
  
  // CRITICAL: Derive currentUser from either user OR session.user
  // This ensures pages always have access to identity data
  const currentUser = user ?? session?.user ?? null;
  
  // Debug log (temporary - can be removed after confirming fix)
  useEffect(() => {
    if (session && !user) {
      console.log('[ProtectedRoute] Session exists but user is null - waiting for sync');
    }
  }, [session, user]);

  useEffect(() => {
    // Wait for auth context to finish loading
    if (authLoading) return;

    // FIXED: Only consider verified when we have a CURRENT USER (not just session)
    // This prevents rendering pages before user data is ready
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
    if (isRecoveringRef.current) {
      return;
    }

    // No user and no session after auth loaded.
    // Try ONE safe recovery (common after the tab sleeps / laptop resumes).
    // Also set a hard timeout so we never show an infinite spinner if recovery hangs.
    let cancelled = false;
    isRecoveringRef.current = true;

    const hardTimeout = window.setTimeout(() => {
      if (cancelled) return;
      recoveryAttemptedRef.current = true;
      isRecoveringRef.current = false;
      const returnUrl = location.pathname + location.search;
      navigate('/auth', {
        replace: true,
        state: { returnUrl },
      });
    }, 5000); // Reduced from 8s to 5s for faster feedback
    
    // Add 500ms delay before attempting recovery to let React state synchronize
    const recoveryDelay = window.setTimeout(() => {
      if (cancelled) return;
      
      // Use async IIFE to avoid async in useEffect
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

          // Mark recovery as attempted
          recoveryAttemptedRef.current = true;
          isRecoveringRef.current = false;

          // Store the intended destination so we can redirect back after login
          const returnUrl = location.pathname + location.search;
          navigate('/auth', {
            replace: true,
            state: { returnUrl },
          });
        } catch {
          if (cancelled) return;
          isRecoveringRef.current = false;
          recoveryAttemptedRef.current = true;
          const returnUrl = location.pathname + location.search;
          navigate('/auth', {
            replace: true,
            state: { returnUrl },
          });
        }
      })();
    }, 500); // Increased from 300ms to 500ms for better state sync

    return () => {
      cancelled = true;
      window.clearTimeout(hardTimeout);
      window.clearTimeout(recoveryDelay);
    };
  }, [currentUser, authLoading, ensureSession, navigate, location.pathname, location.search]);

  // Show loading spinner while auth is loading or not yet verified
  // FIXED: Also wait if session exists but currentUser is not ready yet
  if (authLoading || !verified || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // User is verified, render children
  return <>{children}</>;
}
