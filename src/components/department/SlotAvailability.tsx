import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCurrentPeriodInfo, getNextPeriodInfo, formatPeriodEnd } from '@/lib/periodUtils';
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
  const [selectedPeriod, setSelectedPeriod] = useState<'current' | 'next'>('current');
  const [currentAvailability, setCurrentAvailability] = useState<SlotAvailabilityRecord[]>([]);
  const [nextAvailability, setNextAvailability] = useState<SlotAvailabilityRecord[]>([]);

  const currentPeriod = useMemo(() => getCurrentPeriodInfo(), []);
  const nextPeriod = useMemo(() => getNextPeriodInfo(), []);

  const activePeriod = selectedPeriod === 'current' ? currentPeriod : nextPeriod;
  const availability = selectedPeriod === 'current' ? currentAvailability : nextAvailability;
  const setAvailability = selectedPeriod === 'current' ? setCurrentAvailability : setNextAvailability;

  // Normalize time to HH:mm format (database returns HH:mm:ss)
  const normalizeTime = (time: string) => time?.slice(0, 5);

  useEffect(() => {
    if (!userId || !departmentId) return;
    fetchAvailability();
  }, [departmentId, userId]);

  const fetchAvailability = async () => {
    if (!userId || !departmentId) return;
    
    try {
      setLoading(true);
      
      // Fetch availability for both periods
      const { data, error } = await supabase
        .from('member_availability')
        .select('id, day_of_week, time_start, time_end, is_available, period_start')
        .eq('department_id', departmentId)
        .eq('user_id', userId)
        .gte('period_start', currentPeriod.periodStartStr);

      if (error) throw error;

      // Separate into current and next period
      const current: SlotAvailabilityRecord[] = [];
      const next: SlotAvailabilityRecord[] = [];
      
      (data || []).forEach(record => {
        if (record.period_start === currentPeriod.periodStartStr) {
          current.push(record);
        } else if (record.period_start === nextPeriod.periodStartStr) {
          next.push(record);
        }
      });

      setCurrentAvailability(current);
      setNextAvailability(next);
    } catch (error) {
      console.error('Error fetching slot availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocalSlotKey = (slot: typeof FIXED_SLOTS[0]) => getSlotKey(slot);

  const isSlotAvailable = (slot: typeof FIXED_SLOTS[0]) => {
    const record = availability.find(a => 
      a.day_of_week === slot.dayOfWeek && 
      normalizeTime(a.time_start) === normalizeTime(slot.timeStart) &&
      normalizeTime(a.time_end) === normalizeTime(slot.timeEnd)
    );
    return record?.is_available ?? false;
  };

  const getSlotRecord = (slot: typeof FIXED_SLOTS[0]) => {
    return availability.find(a => 
      a.day_of_week === slot.dayOfWeek && 
      normalizeTime(a.time_start) === normalizeTime(slot.timeStart) &&
      normalizeTime(a.time_end) === normalizeTime(slot.timeEnd)
    );
  };

  // Format time to HH:mm:ss for database
  const formatTimeForDb = (time: string) => {
    const normalized = normalizeTime(time);
    return normalized ? `${normalized}:00` : time;
  };

  const toggleSlotAvailability = async (slot: typeof FIXED_SLOTS[0]) => {
    if (!userId || !departmentId) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Usuário ou departamento não identificado.',
      });
      return;
    }

    const slotKey = getSlotKey(slot);
    setSaving(slotKey);

    try {
      const existingRecord = getSlotRecord(slot);
      const newValue = !isSlotAvailable(slot);

      // Sunday exclusivity: if enabling a Sunday slot, first remove the opposite shift
      let removedOppositeLabel: string | null = null;
      if (newValue && slot.dayOfWeek === 0) {
        const isMorning = normalizeTime(slot.timeStart) < '13:00';
        const oppositeSlot = FIXED_SLOTS.find(s => 
          s.dayOfWeek === 0 && (isMorning ? normalizeTime(s.timeStart) >= '13:00' : normalizeTime(s.timeStart) < '13:00')
        );
        if (oppositeSlot) {
          const oppositeRecord = availability.find(a =>
            a.day_of_week === 0 &&
            normalizeTime(a.time_start) === normalizeTime(oppositeSlot.timeStart) &&
            normalizeTime(a.time_end) === normalizeTime(oppositeSlot.timeEnd) &&
            a.is_available
          );
          if (oppositeRecord) {
            await supabase
              .from('member_availability')
              .delete()
              .eq('id', oppositeRecord.id);
            setAvailability(prev => prev.filter(a => a.id !== oppositeRecord.id));
            removedOppositeLabel = oppositeSlot.label;
          }
        }
      }

      // Now toggle the target slot
      if (existingRecord) {
        if (newValue) {
          const { error } = await supabase
            .from('member_availability')
            .update({ is_available: true, updated_at: new Date().toISOString() })
            .eq('id', existingRecord.id);
          if (error) throw error;
          setAvailability(prev => 
            prev.map(a => a.id === existingRecord.id ? { ...a, is_available: true } : a)
          );
        } else {
          const { error } = await supabase
            .from('member_availability')
            .delete()
            .eq('id', existingRecord.id);
          if (error) throw error;
          setAvailability(prev => prev.filter(a => a.id !== existingRecord.id));
        }
      } else if (newValue) {
        const { data, error } = await supabase
          .from('member_availability')
          .insert({
            user_id: userId,
            department_id: departmentId,
            day_of_week: slot.dayOfWeek,
            time_start: formatTimeForDb(slot.timeStart),
            time_end: formatTimeForDb(slot.timeEnd),
            is_available: true,
            period_start: activePeriod.periodStartStr
          })
          .select()
          .maybeSingle();

        if (error) {
          if (error.code === '23505') {
            console.warn('Duplicate key detected, refetching...', error);
            await fetchAvailability();
            toast({
              title: 'Tente novamente',
              description: 'O registro foi atualizado. Clique novamente para salvar.',
            });
            return;
          }
          throw error;
        }

        if (data) {
          setAvailability(prev => [...prev, data]);
        } else {
          await fetchAvailability();
        }
      }

      toast({
        title: newValue ? 'Disponibilidade marcada!' : 'Disponibilidade removida',
        description: newValue && removedOppositeLabel
          ? `${slot.label} (${removedOppositeLabel} foi desmarcado automaticamente)`
          : slot.label,
      });
    } catch (error: unknown) {
      const err = error as { message?: string; details?: string; code?: string; hint?: string };
      console.error('Error toggling slot availability:', {
        message: err?.message,
        details: err?.details,
        code: err?.code,
        hint: err?.hint,
        fullError: error
      });
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: err?.message || 'Não foi possível salvar sua disponibilidade.',
      });
    } finally {
      setSaving(null);
    }
  };

  const availableCount = FIXED_SLOTS.filter(slot => isSlotAvailable(slot)).length;
  const periodEndFormatted = formatPeriodEnd(activePeriod.periodEnd);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Disponibilidade Semanal
        </CardTitle>
        <CardDescription>
          Marque os dias/horários em que você pode ser escalado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Tabs */}
        <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as 'current' | 'next')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current" className="text-xs sm:text-sm">
              {currentPeriod.label}
              <span className="hidden sm:inline ml-1 text-muted-foreground">(atual)</span>
            </TabsTrigger>
            <TabsTrigger value="next" className="text-xs sm:text-sm">
              {nextPeriod.label}
              <span className="hidden sm:inline ml-1 text-muted-foreground">(próximo)</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedPeriod} className="mt-4 space-y-4">
            {/* Period validity notice */}
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Válida até {periodEndFormatted}
                </p>
                <p className="text-amber-700 dark:text-amber-300/80">
                  {selectedPeriod === 'next' 
                    ? 'Marque sua disponibilidade antecipadamente para o próximo período.'
                    : 'Após essa data, você precisará marcar novamente sua disponibilidade.'}
                </p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{availableCount} de {FIXED_SLOTS.length} slots disponíveis</span>
            </div>

            {/* Slots Grid */}
            <div className="space-y-3">
              {FIXED_SLOTS.map(slot => {
                const slotKey = getSlotKey(slot);
                const isAvailable = isSlotAvailable(slot);
                const isSaving = saving === slotKey;
                const Icon = slot.icon;

                return (
                  <div 
                    key={slotKey}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                      slot.bgColor,
                      isAvailable ? slot.borderColor : "border-transparent",
                      isSaving && "opacity-70"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        isAvailable ? slot.activeColor : "bg-muted"
                      )}>
                        <Icon className={cn(
                          "w-5 h-5",
                          isAvailable ? "text-white" : "text-muted-foreground"
                        )} />
                      </div>
                      <div>
                        <Label className="font-medium text-foreground">
                          {slot.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {slot.timeStart} - {slot.timeEnd}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Switch
                          checked={isAvailable}
                          onCheckedChange={() => toggleSlotAvailability(slot)}
                          disabled={!!saving}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tip */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground">
                <strong>Dica:</strong> O líder usará esta informação para gerar escalas automáticas. 
                Marque apenas os horários em que você realmente pode participar.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
