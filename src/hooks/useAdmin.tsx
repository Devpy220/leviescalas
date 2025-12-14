import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const ADMIN_EMAIL = 'leviescalas@gmail.com';

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Check if user email matches admin email
    if (user.email !== ADMIN_EMAIL) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    checkAndSetupAdmin();
  }, [user, authLoading]);

  const checkAndSetupAdmin = async () => {
    if (!user) return;

    try {
      // Check if user has admin role using RPC
      const { data: hasRole } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });

      if (hasRole) {
        setIsAdmin(true);
      } else {
        // First time admin login - add admin role
        // This will only work if no admin exists yet (first setup)
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role: 'admin' });
        
        if (!error) {
          setIsAdmin(true);
        }
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, loading, adminEmail: ADMIN_EMAIL };
}
