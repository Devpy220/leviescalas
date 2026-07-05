import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const getSessionId = () => {
  let sessionId = sessionStorage.getItem('levi_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('levi_session_id', sessionId);
  }
  return sessionId;
};

export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    const trackPageView = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const isAuthenticated = !!session?.user;

        await supabase.from('page_views').insert({
          page_path: location.pathname,
          user_agent: navigator.userAgent,
          referrer: document.referrer || null,
          session_id: getSessionId(),
          is_authenticated: isAuthenticated,
        });
      } catch (error) {
        // Silently fail - don't interrupt user experience
        console.error('Failed to track page view:', error);
      }
    };

    // Defer analytics insert past first paint so it doesn't compete with LCP.
    const handle: number | NodeJS.Timeout = (typeof (window as any).requestIdleCallback === 'function')
      ? (window as any).requestIdleCallback(trackPageView, { timeout: 3000 })
      : setTimeout(trackPageView, 1200);

    return () => {
      if (typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(handle);
      } else {
        clearTimeout(handle as NodeJS.Timeout);
      }
    };
  }, [location.pathname]);

};
