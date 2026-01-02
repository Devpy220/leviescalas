import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, isWednesday, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AvailabilityCalendarProps {
  departmentId: string;
  userId: string;
}

interface FixedSlot {
  id: string;
  dayOfWeek: number; // 0 = Sunday, 3 = Wednesday
  timeStart: string;
  timeEnd: string;
  label: string;
  shortLabel: string;
}

// Horários fixos pré-definidos
const FIXED_SLOTS: FixedSlot[] = [
  { id: 'wed-night', dayOfWeek: 3, timeStart: '19:20', timeEnd: '22:00', label: 'Quarta 19:20-22:00', shortLabel: '19:20-22:00' },
  { id: 'sun-morning', dayOfWeek: 0, timeStart: '08:00', timeEnd: '11:30', label: 'Domingo Manhã 8:00-11:30', shortLabel: 'Manhã' },
  { id: 'sun-night', dayOfWeek: 0, timeStart: '18:00', timeEnd: '22:00', label: 'Domingo Noite 18:00-22:00', shortLabel: 'Noite' },
];

interface AvailabilityRecord {
  id: string;
  day_of_week: number;
  time_start: string;
  time_end: string;
  is_available: boolean;
}

export default function AvailabilityCalendar({ departmentId, userId }: AvailabilityCalendarProps) {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);

  // Get all valid dates for the month (Wednesdays and Sundays)
  const getMonthDates = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start, end });
    return allDays.filter(day => isSunday(day) || isWednesday(day));
  };

  const validDates = getMonthDates();

  useEffect(() => {
    fetchAvailability();
  }, [departmentId, userId]);

  const fetchAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from('member_availability')
        .select('id, day_of_week, time_start, time_end, is_available')
        .eq('department_id', departmentId)
        .eq('user_id', userId);

      if (error) throw error;
      setAvailability(data || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const isSlotAvailable = (slot: FixedSlot) => {
    const record = availability.find(a => 
      a.day_of_week === slot.dayOfWeek && 
      a.time_start.slice(0, 5) === slot.timeStart &&
      a.time_end.slice(0, 5) === slot.timeEnd &&
      a.is_available
    );
    return !!record;
  };

  const getSlotRecord = (slot: FixedSlot) => {
    return availability.find(a => 
      a.day_of_week === slot.dayOfWeek && 
      a.time_start.slice(0, 5) === slot.timeStart &&
      a.time_end.slice(0, 5) === slot.timeEnd
    );
  };

  const toggleSlotAvailability = async (slot: FixedSlot) => {
    const slotKey = `${slot.dayOfWeek}-${slot.timeStart}`;
    setSaving(slotKey);
    
    try {
      const existingRecord = getSlotRecord(slot);
      const newValue = !isSlotAvailable(slot);

      if (existingRecord) {
        // Update existing record
        const { error } = await supabase
          .from('member_availability')
          .update({ is_available: newValue, updated_at: new Date().toISOString() })
          .eq('id', existingRecord.id);

        if (error) throw error;

        setAvailability(prev => 
          prev.map(a => a.id === existingRecord.id ? { ...a, is_available: newValue } : a)
        );
      } else {
        // Insert new record
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
      console.error('Error toggling availability:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Não foi possível salvar sua disponibilidade.',
      });
    } finally {
      setSaving(null);
    }
  };

  const navigateMonth = (direction: number) => {
    setCurrentMonth(prev => addMonths(prev, direction));
  };

  const getSlotsForDate = (date: Date) => {
    const dayOfWeek = date.getDay();
    return FIXED_SLOTS.filter(slot => slot.dayOfWeek === dayOfWeek);
  };

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Minha Disponibilidade
            </CardTitle>
            <CardDescription className="mt-1">
              Marque os horários fixos em que você pode ser escalado.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[140px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fixed Slots Legend */}
        <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
          <h4 className="font-medium mb-3 text-sm">Horários Fixos Disponíveis</h4>
          <div className="flex flex-wrap gap-2">
            {FIXED_SLOTS.map(slot => {
              const available = isSlotAvailable(slot);
              const slotKey = `${slot.dayOfWeek}-${slot.timeStart}`;
              const isSavingThis = saving === slotKey;
              
              return (
                <Button
                  key={slot.id}
                  variant={available ? 'default' : 'outline'}
                  size="sm"
                  disabled={!!saving}
                  onClick={() => toggleSlotAvailability(slot)}
                  className="gap-2"
                >
                  {isSavingThis ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : available ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <X className="h-3 w-3 opacity-50" />
                  )}
                  {slot.label}
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Clique para marcar ou desmarcar sua disponibilidade em cada horário fixo.
          </p>
        </div>

        {/* Calendar View */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Dias do mês com horários fixos</h4>
          {validDates.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayName = format(date, 'EEEE', { locale: ptBR });
            const slotsForDate = getSlotsForDate(date);
            
            return (
              <div 
                key={dateStr} 
                className="flex items-center gap-4 p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="min-w-[100px]">
                  <div className="font-medium capitalize text-sm">{dayName}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(date, 'dd/MM', { locale: ptBR })}
                  </div>
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  {slotsForDate.map(slot => {
                    const available = isSlotAvailable(slot);
                    return (
                      <Badge
                        key={slot.id}
                        variant={available ? 'default' : 'secondary'}
                        className={available ? '' : 'opacity-50'}
                      >
                        {available ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                        {slot.shortLabel}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm text-muted-foreground">
            <strong>Dica:</strong> Marque sua disponibilidade nos horários fixos acima. O líder poderá gerar escalas automáticas baseadas na disponibilidade de todos os membros.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
