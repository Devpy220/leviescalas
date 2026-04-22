import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { isRecoveryLinkActive } from '@/components/AuthRecoveryRedirect';

interface AdminRedirectProps {
  children: React.ReactNode;
}

/**
 * This component redirects admin users to /admin page.
 * Admin users should only access the admin area.
 */
export function AdminRedirect({ children }: AdminRedirectProps) {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // CRITICAL: Never redirect admins while a password-recovery link is being
  // processed, or while the user is on /auth (where the reset-password form lives).
  // Otherwise the brief session created by the recovery link would bounce the
  // user to /admin before they can set a new password.
  const recoveryActive =
    isRecoveryLinkActive() || location.pathname === '/auth';

  useEffect(() => {
    if (authLoading || adminLoading) return;
    if (recoveryActive) return;

    if (user && isAdmin) {
      const isInAdminArea = location.pathname.startsWith('/admin');
      const isInJoinArea = location.pathname.startsWith('/join');
      const isInPublicArea = location.pathname.startsWith('/igreja');
      const isInAuthArea = location.pathname.startsWith('/auth');
      const isInSupportArea = location.pathname.startsWith('/apoiar') || location.pathname.startsWith('/payment');
      const isExempt = isInAdminArea || isInJoinArea || isInPublicArea || isInAuthArea || isInSupportArea;

      if (!isExempt) {
        navigate('/admin', { replace: true });
      }
    }
  }, [user, isAdmin, authLoading, adminLoading, location.pathname, navigate, recoveryActive]);

  if (authLoading || adminLoading) {
    return <>{children}</>;
  }

  if (recoveryActive) {
    return <>{children}</>;
  }

  if (user && isAdmin) {
    const isInAdminArea = location.pathname.startsWith('/admin');
    const isInJoinArea = location.pathname.startsWith('/join');
    const isInPublicArea = location.pathname.startsWith('/igreja');
    const isInAuthArea = location.pathname.startsWith('/auth');
    const isExempt = isInAdminArea || isInJoinArea || isInPublicArea || isInAuthArea;

    if (!isExempt) {
      return null;
    }
  }

  return <>{children}</>;
}
