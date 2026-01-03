import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';

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

  useEffect(() => {
    // Wait for loading to complete
    if (authLoading || adminLoading) return;

    // If user is admin and not already in admin pages, redirect to /admin
    if (user && isAdmin) {
      const isInAdminArea = location.pathname.startsWith('/admin');
      
      if (!isInAdminArea) {
        navigate('/admin', { replace: true });
      }
    }
  }, [user, isAdmin, authLoading, adminLoading, location.pathname, navigate]);

  // If still loading, render children (they'll handle their own loading states)
  if (authLoading || adminLoading) {
    return <>{children}</>;
  }

  // If user is admin and not in admin area, don't render anything (redirect happening)
  if (user && isAdmin) {
    const isInAdminArea = location.pathname.startsWith('/admin');
    
    if (!isInAdminArea) {
      return null;
    }
  }

  return <>{children}</>;
}
