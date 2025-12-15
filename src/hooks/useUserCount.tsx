import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useUserCount() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_count');
        
        if (error) {
          console.error('Erro ao buscar contagem:', error);
          return;
        }
        
        setCount(data);
      } catch (error) {
        console.error('Erro ao buscar contagem:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCount();

    // Subscribe to realtime updates on profiles table
    const channel = supabase
      .channel('user-count-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { count, loading };
}
