import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Fixed slots configuration - matches UnifiedScheduleView
const FIXED_SLOTS = [
  { 
    dayOfWeek: 0, 
    timeStart: '09:00', 
    timeEnd: '12:00', 
    label: 'Domingo Manhã', 
    icon: Sun,
    bgColor: 'bg-cyan-100/80 dark:bg-cyan-900/30',
    borderColor: 'border-cyan-300 dark:border-cyan-700/50',
    activeColor: 'bg-cyan-500'
  },
  { 
    dayOfWeek: 0, 
    timeStart: '18:00', 
    timeEnd: '22:00', 
    label: 'Domingo Noite', 
    icon: Moon,
    bgColor: 'bg-rose-100/80 dark:bg-rose-900/30',
    borderColor: 'border-rose-300 dark:border-rose-700/50',
    activeColor: 'bg-rose-500'
  },
  { 
    dayOfWeek: 1, 
    timeStart: '19:20', 
    timeEnd: '22:00', 
    label: 'Segunda', 
    icon: Moon,
    bgColor: 'bg-amber-100/80 dark:bg-amber-900/30',
    borderColor: 'border-amber-300 dark:border-amber-700/50',
    activeColor: 'bg-amber-500'
  },
  { 
    dayOfWeek: 3, 
    timeStart: '19:20', 
    timeEnd: '22:00', 
    label: 'Quarta', 
    icon: Moon,
    bgColor: 'bg-violet-100/80 dark:bg-violet-900/30',
    borderColor: 'border-violet-300 dark:border-violet-700/50',
    activeColor: 'bg-violet-500'
  },
  { 
    dayOfWeek: 5, 
    timeStart: '19:20', 
    timeEnd: '22:00', 
    label: 'Sexta', 
    icon: Moon,
    bgColor: 'bg-pink-100/80 dark:bg-pink-900/30',
    borderColor: 'border-pink-300 dark:border-pink-700/50',
    activeColor: 'bg-pink-500'
  },
];

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
}

export default function SlotAvailability({ departmentId, userId }: SlotAvailabilityProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [availability, setAvailability] = useState<SlotAvailabilityRecord[]>([]);

  useEffect(() => {
    fetchAvailability();
  }, [departmentId, userId]);

  const fetchAvailability = async () => {
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

  const getSlotKey = (slot: typeof FIXED_SLOTS[0]) => 
    `${slot.dayOfWeek}-${slot.timeStart}`;

  const isSlotAvailable = (slot: typeof FIXED_SLOTS[0]) => {
    const record = availability.find(a => 
      a.day_of_week === slot.dayOfWeek && 
      a.time_start === slot.timeStart
    );
    return record?.is_available ?? false;
  };

  const getSlotRecord = (slot: typeof FIXED_SLOTS[0]) => {
    return availability.find(a => 
      a.day_of_week === slot.dayOfWeek && 
      a.time_start === slot.timeStart
    );
  };

  const toggleSlotAvailability = async (slot: typeof FIXED_SLOTS[0]) => {
    const slotKey = getSlotKey(slot);
    setSaving(slotKey);

    try {
      const existingRecord = getSlotRecord(slot);
      const newValue = !isSlotAvailable(slot);

      if (existingRecord) {
        if (newValue) {
          // Update to available
          const { error } = await supabase
            .from('member_availability')
            .update({ is_available: true, updated_at: new Date().toISOString() })
            .eq('id', existingRecord.id);

          if (error) throw error;

          setAvailability(prev => 
            prev.map(a => a.id === existingRecord.id ? { ...a, is_available: true } : a)
          );
        } else {
          // Delete record when marking as unavailable
          const { error } = await supabase
            .from('member_availability')
            .delete()
            .eq('id', existingRecord.id);

          if (error) throw error;

          setAvailability(prev => prev.filter(a => a.id !== existingRecord.id));
        }
      } else {
        // Insert new record (only when marking as available)
        const { data, error } = await supabase
          .from('member_availability')
          .insert({
            user_id: userId,
            department_id: departmentId,
            day_of_week: slot.dayOfWeek,
            time_start: slot.timeStart,
            time_end: slot.timeEnd,
            is_available: true
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setAvailability(prev => [...prev, data]);
        }
      }

      toast({
        title: newValue ? 'Disponibilidade marcada!' : 'Disponibilidade removida',
        description: slot.label,
      });
    } catch (error) {
      console.error('Error toggling slot availability:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Não foi possível salvar sua disponibilidade.',
      });
    } finally {
      setSaving(null);
    }
  };

  const availableCount = FIXED_SLOTS.filter(slot => isSlotAvailable(slot)).length;

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
      </CardContent>
    </Card>
  );
}
