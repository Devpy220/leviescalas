import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, getDay, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AvailabilityCalendarProps {
  departmentId: string;
  userId: string;
}

interface DateAvailability {
  id: string;
  date: string;
  is_available: boolean;
}

export default function AvailabilityCalendar({ departmentId, userId }: AvailabilityCalendarProps) {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [availability, setAvailability] = useState<DateAvailability[]>([]);

  // Get all days for the month
  const getMonthDates = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };

  const allDates = getMonthDates();
  const today = startOfDay(new Date());

  useEffect(() => {
    fetchAvailability();
  }, [departmentId, userId, currentMonth]);

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('member_date_availability')
        .select('id, date, is_available')
        .eq('department_id', departmentId)
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;
      setAvailability(data || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const isDateAvailable = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const record = availability.find(a => a.date === dateStr);
    return record?.is_available ?? false;
  };

  const getDateRecord = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availability.find(a => a.date === dateStr);
  };

  const toggleDateAvailability = async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Don't allow toggling past dates
    if (isBefore(date, today)) {
      toast({
        variant: 'destructive',
        title: 'Data passada',
        description: 'Não é possível alterar disponibilidade de datas passadas.',
      });
      return;
    }

    setSaving(dateStr);
    
    try {
      const existingRecord = getDateRecord(date);
      const newValue = !isDateAvailable(date);

      if (existingRecord) {
        if (newValue) {
          // Update existing record
          const { error } = await supabase
            .from('member_date_availability')
            .update({ is_available: true, updated_at: new Date().toISOString() })
            .eq('id', existingRecord.id);

          if (error) throw error;

          setAvailability(prev => 
            prev.map(a => a.id === existingRecord.id ? { ...a, is_available: true } : a)
          );
        } else {
          // Delete record when marking as unavailable
          const { error } = await supabase
            .from('member_date_availability')
            .delete()
            .eq('id', existingRecord.id);

          if (error) throw error;

          setAvailability(prev => prev.filter(a => a.id !== existingRecord.id));
        }
      } else {
        // Insert new record (only when marking as available)
        const { data, error } = await supabase
          .from('member_date_availability')
          .insert({
            user_id: userId,
            department_id: departmentId,
            date: dateStr,
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
        description: format(date, "dd 'de' MMMM", { locale: ptBR }),
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

  // Get the first day of the week for the month (0 = Sunday)
  const firstDayOfMonth = getDay(startOfMonth(currentMonth));

  // Count available days
  const availableCount = availability.filter(a => a.is_available).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="glass border-border/50">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Minha Disponibilidade
            </CardTitle>
            <CardDescription className="mt-1">
              Clique nos dias em que você pode ser escalado.
            </CardDescription>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)} className="shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[140px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={() => navigateMonth(1)} className="shrink-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Check className="w-4 h-4 text-primary-foreground" />
            </div>
            <span>Disponível</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-muted border border-border/50"></div>
            <span>Indisponível</span>
          </div>
          <div className="ml-auto text-muted-foreground">
            {availableCount} dias marcados
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-muted/30 rounded-lg border border-border/50 p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before the first day of the month */}
            {Array.from({ length: firstDayOfMonth }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}

            {/* Actual days */}
            {allDates.map(date => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const available = isDateAvailable(date);
              const isPast = isBefore(date, today);
              const isSavingThis = saving === dateStr;

              return (
                <button
                  key={dateStr}
                  onClick={() => toggleDateAvailability(date)}
                  disabled={!!saving || isPast}
                  className={cn(
                    "aspect-square rounded-md flex flex-col items-center justify-center text-sm transition-all relative",
                    "hover:ring-2 hover:ring-primary/50",
                    available && "bg-primary text-primary-foreground",
                    !available && !isPast && "bg-card border border-border/50 hover:bg-accent/50",
                    isPast && "opacity-40 cursor-not-allowed bg-muted/20",
                    isSavingThis && "animate-pulse"
                  )}
                >
                  <span className="font-medium">{format(date, 'd')}</span>
                  {available && !isSavingThis && (
                    <Check className="w-3 h-3 absolute bottom-0.5" />
                  )}
                  {isSavingThis && (
                    <Loader2 className="w-3 h-3 animate-spin absolute bottom-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tip */}
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm text-muted-foreground">
            <strong>Dica:</strong> Marque os dias em que você está disponível para ser escalado. 
            O líder poderá gerar escalas automáticas baseadas na disponibilidade de todos os membros.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
