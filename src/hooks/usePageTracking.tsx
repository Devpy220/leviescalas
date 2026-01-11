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
        await supabase.from('page_views').insert({
          page_path: location.pathname,
          user_agent: navigator.userAgent,
          referrer: document.referrer || null,
          session_id: getSessionId(),
        });
      } catch (error) {
        // Silently fail - don't interrupt user experience
        console.error('Failed to track page view:', error);
      }
    };

    trackPageView();
  }, [location.pathname]);
};
