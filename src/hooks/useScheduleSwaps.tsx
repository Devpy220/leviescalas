import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type SwapStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface ScheduleSwap {
  id: string;
  department_id: string;
  requester_schedule_id: string;
  target_schedule_id: string;
  requester_user_id: string;
  target_user_id: string;
  status: SwapStatus;
  reason: string | null;
  created_at: string;
  resolved_at: string | null;
  // Populated fields
  requester_name?: string;
  target_name?: string;
  requester_schedule?: {
    date: string;
    time_start: string;
    time_end: string;
    sector_name?: string;
  };
  target_schedule?: {
    date: string;
    time_start: string;
    time_end: string;
    sector_name?: string;
  };
}

export function useScheduleSwaps(departmentId?: string) {
  const [swaps, setSwaps] = useState<ScheduleSwap[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSwaps = useCallback(async () => {
    if (!user || !departmentId) {
      setSwaps([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('schedule_swaps')
        .select('*')
        .eq('department_id', departmentId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with schedule and profile data
      const enrichedSwaps: ScheduleSwap[] = [];
      
      for (const swap of data || []) {
        // Fetch schedules
        const { data: schedules } = await supabase
          .from('schedules')
          .select('id, date, time_start, time_end, sector_id, sectors(name)')
          .in('id', [swap.requester_schedule_id, swap.target_schedule_id]);

        // Fetch profiles
        const { data: profiles } = await supabase
          .rpc('get_member_profile', { member_user_id: swap.requester_user_id });
        
        const { data: targetProfiles } = await supabase
          .rpc('get_member_profile', { member_user_id: swap.target_user_id });

        const requesterSchedule = schedules?.find(s => s.id === swap.requester_schedule_id);
        const targetSchedule = schedules?.find(s => s.id === swap.target_schedule_id);

        enrichedSwaps.push({
          ...swap,
          status: swap.status as SwapStatus,
          requester_name: profiles?.[0]?.name || 'Desconhecido',
          target_name: targetProfiles?.[0]?.name || 'Desconhecido',
          requester_schedule: requesterSchedule ? {
            date: requesterSchedule.date,
            time_start: requesterSchedule.time_start,
            time_end: requesterSchedule.time_end,
            sector_name: (requesterSchedule.sectors as any)?.name,
          } : undefined,
          target_schedule: targetSchedule ? {
            date: targetSchedule.date,
            time_start: targetSchedule.time_start,
            time_end: targetSchedule.time_end,
            sector_name: (targetSchedule.sectors as any)?.name,
          } : undefined,
        });
      }

      setSwaps(enrichedSwaps);
    } catch (error) {
      console.error('Error fetching swaps:', error);
    } finally {
      setLoading(false);
    }
  }, [user, departmentId]);

  const createSwapRequest = useCallback(async (
    requesterScheduleId: string,
    targetScheduleId: string,
    targetUserId: string,
    reason?: string
  ) => {
    if (!user || !departmentId) return false;

    try {
      const { error } = await supabase
        .from('schedule_swaps')
        .insert({
          department_id: departmentId,
          requester_schedule_id: requesterScheduleId,
          target_schedule_id: targetScheduleId,
          requester_user_id: user.id,
          target_user_id: targetUserId,
          reason: reason || null,
        });

      if (error) throw error;

      // Create notification for target user
      await supabase
        .from('notifications')
        .insert({
          user_id: targetUserId,
          department_id: departmentId,
          type: 'swap_request',
          message: 'Você recebeu uma solicitação de troca de escala!',
        });

      toast({
        title: 'Solicitação enviada!',
        description: 'Aguarde a resposta do membro.',
      });

      fetchSwaps();
      return true;
    } catch (error) {
      console.error('Error creating swap request:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao solicitar troca',
        description: 'Tente novamente mais tarde.',
      });
      return false;
    }
  }, [user, departmentId, toast, fetchSwaps]);

  const respondToSwap = useCallback(async (
    swapId: string,
    accept: boolean
  ) => {
    if (!user) return false;

    try {
      const newStatus = accept ? 'accepted' : 'rejected';
      
      const { error } = await supabase
        .from('schedule_swaps')
        .update({ 
          status: newStatus,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', swapId);

      if (error) throw error;

      // If accepted, execute the swap
      if (accept) {
        const { error: execError } = await supabase
          .rpc('execute_schedule_swap', { swap_id: swapId });

        if (execError) throw execError;
      }

      // Get swap details for notification
      const swap = swaps.find(s => s.id === swapId);
      if (swap) {
        await supabase
          .from('notifications')
          .insert({
            user_id: swap.requester_user_id,
            department_id: swap.department_id,
            type: accept ? 'swap_accepted' : 'swap_rejected',
            message: accept 
              ? 'Sua solicitação de troca foi aceita! As escalas foram trocadas.'
              : 'Sua solicitação de troca foi recusada.',
          });
      }

      toast({
        title: accept ? 'Troca aceita!' : 'Troca recusada',
        description: accept 
          ? 'As escalas foram trocadas com sucesso.'
          : 'A solicitação foi recusada.',
      });

      fetchSwaps();
      return true;
    } catch (error) {
      console.error('Error responding to swap:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao responder',
        description: 'Tente novamente mais tarde.',
      });
      return false;
    }
  }, [user, swaps, toast, fetchSwaps]);

  const cancelSwap = useCallback(async (swapId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('schedule_swaps')
        .delete()
        .eq('id', swapId);

      if (error) throw error;

      toast({
        title: 'Solicitação cancelada',
        description: 'A troca foi cancelada com sucesso.',
      });

      fetchSwaps();
      return true;
    } catch (error) {
      console.error('Error cancelling swap:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar',
        description: 'Tente novamente mais tarde.',
      });
      return false;
    }
  }, [user, toast, fetchSwaps]);

  const getSwapForSchedule = useCallback((scheduleId: string) => {
    return swaps.find(
      s => s.requester_schedule_id === scheduleId || s.target_schedule_id === scheduleId
    );
  }, [swaps]);

  const getPendingSwapsForUser = useCallback(() => {
    if (!user) return [];
    return swaps.filter(s => s.target_user_id === user.id && s.status === 'pending');
  }, [swaps, user]);

  useEffect(() => {
    fetchSwaps();
  }, [fetchSwaps]);

  // Realtime subscription
  useEffect(() => {
    if (!departmentId) return;

    const channel = supabase
      .channel(`swaps-${departmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedule_swaps',
          filter: `department_id=eq.${departmentId}`
        },
        () => {
          fetchSwaps();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId, fetchSwaps]);

  return {
    swaps,
    loading,
    createSwapRequest,
    respondToSwap,
    cancelSwap,
    getSwapForSchedule,
    getPendingSwapsForUser,
    refresh: fetchSwaps,
  };
}
