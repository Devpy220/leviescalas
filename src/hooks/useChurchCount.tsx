import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useChurchCount() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const { data, error } = await supabase.rpc('get_church_count');
        if (cancelled) return;
        if (error) {
          console.error('Erro ao buscar igrejas:', error);
          return;
        }
        setCount(data as number);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const idle = (cb: () => void) => {
      if (typeof (window as any).requestIdleCallback === 'function') {
        (window as any).requestIdleCallback(cb, { timeout: 2000 });
      } else {
        setTimeout(cb, 800);
      }
    };

    idle(() => {
      if (!cancelled) fetchCount();
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { count, loading };
}
