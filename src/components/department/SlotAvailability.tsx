import { useState, useEffect } from 'react';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIXED_SLOTS, getSlotKey } from '@/lib/fixedSlots';

interface SlotAvailabilityProps {
  departmentId: string;
  userId: string;
}

interface SlotAvailabilityRecord {
  id: string;
  day_of_week: number;
  time_start: string;
  time_end: string;
  is_available: boolean;
  period_start?: string;
}

export default function SlotAvailability({ departmentId, userId }: SlotAvailabilityProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [availability, setAvailability] = useState<SlotAvailabilityRecord[]>([]);

  

  const normalizeTime = (time: string) => time?.slice(0, 5);

  useEffect(() => {
    if (!userId || !departmentId) return;
    fetchAvailability();
  }, [departmentId, userId]);

  const fetchAvailability = async () => {
    if (!userId || !departmentId) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('member_availability')
        .select('id, day_of_week, time_start, time_end, is_available')
        .eq('department_id', departmentId)
        .eq('user_id', userId);

      if (error) throw error;
      setAvailability(data || []);
    } catch (error) {
      console.error('Error fetching slot availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const isSlotAvailable = (slot: typeof FIXED_SLOTS[0]) => {
    const record = availability.find(a => 
      a.day_of_week === slot.dayOfWeek && 
      normalizeTime(a.time_start) === normalizeTime(slot.timeStart) &&
      normalizeTime(a.time_end) === normalizeTime(slot.timeEnd)
    );
    // Sem registro = disponível por padrão. Só bloqueia se is_available === false
    return record ? record.is_available : true;
  };

  const getSlotRecord = (slot: typeof FIXED_SLOTS[0]) => {
    return availability.find(a => 
      a.day_of_week === slot.dayOfWeek && 
      normalizeTime(a.time_start) === normalizeTime(slot.timeStart) &&
      normalizeTime(a.time_end) === normalizeTime(slot.timeEnd)
    );
  };

  const formatTimeForDb = (time: string) => {
    const normalized = normalizeTime(time);
    return normalized ? `${normalized}:00` : time;
  };

  const toggleSlotAvailability = async (slot: typeof FIXED_SLOTS[0]) => {
    if (!userId || !departmentId) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário ou departamento não identificado.' });
      return;
    }

    const slotKey = getSlotKey(slot);
    setSaving(slotKey);

    try {
      const existingRecord = getSlotRecord(slot);
      const newValue = !isSlotAvailable(slot);

      if (newValue) {
        // Ligando = disponível = deletar registro de bloqueio (volta ao padrão)
        if (existingRecord) {
          const { error } = await supabase
            .from('member_availability')
            .delete()
            .eq('id', existingRecord.id);
          if (error) throw error;
          setAvailability(prev => prev.filter(a => a.id !== existingRecord.id));
        }
      } else {
        // Desligando = bloqueado = inserir/atualizar registro com is_available = false
        if (existingRecord) {
          const { error } = await supabase
            .from('member_availability')
            .update({ is_available: false, updated_at: new Date().toISOString() })
            .eq('id', existingRecord.id);
          if (error) throw error;
          setAvailability(prev => prev.map(a => a.id === existingRecord.id ? { ...a, is_available: false } : a));
        } else {
          const { data, error } = await supabase
            .from('member_availability')
            .upsert({
              user_id: userId,
              department_id: departmentId,
              day_of_week: slot.dayOfWeek,
              time_start: formatTimeForDb(slot.timeStart),
              time_end: formatTimeForDb(slot.timeEnd),
              is_available: false,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,department_id,day_of_week,time_start,time_end',
            })
            .select()
            .maybeSingle();

          if (error) throw error;

          if (data) {
            setAvailability(prev => [...prev.filter(a => 
              !(a.day_of_week === slot.dayOfWeek && 
                normalizeTime(a.time_start) === normalizeTime(slot.timeStart) &&
                normalizeTime(a.time_end) === normalizeTime(slot.timeEnd))
            ), data]);
          } else {
            await fetchAvailability();
          }
        }
      }

      toast({
        title: newValue ? 'Disponibilidade marcada!' : 'Disponibilidade removida',
        description: slot.label,
      });
    } catch (error: unknown) {
      const err = error as { message?: string; details?: string; code?: string; hint?: string };
      console.error('Error toggling slot availability:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: err?.message || 'Não foi possível salvar sua disponibilidade.',
      });
    } finally {
      setSaving(null);
    }
  };

  const blockedCount = FIXED_SLOTS.filter(slot => !isSlotAvailable(slot)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Disponibilidade Semanal</h3>
        </div>
        <span className="text-xs text-muted-foreground">{blockedCount} bloqueado{blockedCount !== 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {FIXED_SLOTS.map(slot => {
          const slotKey = getSlotKey(slot);
          const isAvailable = isSlotAvailable(slot);
          const isSaving = saving === slotKey;
          const Icon = slot.icon;

          return (
            <div 
              key={slotKey}
              className={cn(
                "flex items-center justify-between px-2 py-1.5 rounded-md border transition-all",
                isAvailable ? slot.borderColor : "border-transparent",
                isAvailable ? slot.bgColor : "bg-muted/30",
                isSaving && "opacity-70"
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                  isAvailable ? slot.activeColor : "bg-muted"
                )}>
                  <Icon className={cn(
                    "w-3 h-3",
                    isAvailable ? "text-white" : "text-muted-foreground"
                  )} />
                </div>
                <div className="leading-tight min-w-0">
                  <Label className="text-xs font-medium text-foreground truncate block">{slot.label}</Label>
                  <p className="text-[10px] text-muted-foreground">{slot.timeStart}-{slot.timeEnd}</p>
                </div>
              </div>
              
              <div className="flex items-center flex-shrink-0 ml-1">
                {isSaving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Switch
                    checked={isAvailable}
                    onCheckedChange={() => toggleSlotAvailability(slot)}
                    disabled={!!saving}
                    className="scale-75"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Desative os dias que você <strong>NÃO</strong> pode servir.
      </p>
    </div>
  );
}
