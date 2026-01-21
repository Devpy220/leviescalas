import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Global cache to prevent redundant admin checks across component instances
const adminCache = {
  userId: null as string | null,
  isAdmin: false,
  checkedAt: 0,
};

const CACHE_TTL = 300000; // 5 minute cache to reduce API calls

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const checkingRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Check cache first
    const now = Date.now();
    if (adminCache.userId === user.id && now - adminCache.checkedAt < CACHE_TTL) {
      setIsAdmin(adminCache.isAdmin);
      setLoading(false);
      return;
    }

    // Prevent concurrent checks
    if (checkingRef.current) return;
    
    checkAdminStatus();
  }, [user?.id, authLoading]);

  const checkAdminStatus = async () => {
    if (!user || checkingRef.current) return;
    
    checkingRef.current = true;

    try {
      // Check if user has admin role using server-side RPC only
      // Note: ensure_admin_role is already called in useAuth bootstrapUser
      const { data: hasRole, error } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });

      if (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } else {
        const adminStatus = hasRole || false;
        setIsAdmin(adminStatus);
        
        // Update cache
        adminCache.userId = user.id;
        adminCache.isAdmin = adminStatus;
        adminCache.checkedAt = Date.now();
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
      checkingRef.current = false;
    }
  };

  return { isAdmin, loading };
}
