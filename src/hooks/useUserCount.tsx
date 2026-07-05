import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useUserCount() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_count');
        if (cancelled) return;
        if (error) {
          console.error('Erro ao buscar contagem:', error);
          return;
        }
        setCount(data);
      } catch (error) {
        console.error('Erro ao buscar contagem:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Defer network + realtime subscription until after first paint so it
    // doesn't block LCP on the landing page.
    const idle = (cb: () => void) => {
      if (typeof (window as any).requestIdleCallback === 'function') {
        (window as any).requestIdleCallback(cb, { timeout: 2000 });
      } else {
        setTimeout(cb, 800);
      }
    };

    idle(() => {
      if (cancelled) return;
      fetchCount();
      channel = supabase
        .channel('user-count-updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          () => fetchCount(),
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);


  return { count, loading };
}
