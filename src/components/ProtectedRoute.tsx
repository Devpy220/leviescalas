import { useEffect, useState } from 'react';
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
  const { user, session, loading: authLoading } = useAuth();
  const [verified, setVerified] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Wait for auth context to finish loading
    if (authLoading) return;

    // If we have a user or session, we're good
    if (user || session) {
      setVerified(true);
      return;
    }

    // No user and no session after auth loaded = redirect to auth
    // Store the intended destination so we can redirect back after login
    const returnUrl = location.pathname + location.search;
    navigate('/auth', { 
      replace: true, 
      state: { returnUrl } 
    });
  }, [user, session, authLoading, navigate, location]);

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
