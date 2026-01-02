import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Clock } from 'lucide-react';

interface AvailabilityCalendarProps {
  departmentId: string;
  userId: string;
}

interface DayAvailability {
  day_of_week: number;
  is_available: boolean;
  time_start: string;
  time_end: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

export default function AvailabilityCalendar({ departmentId, userId }: AvailabilityCalendarProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<DayAvailability[]>(
    DAYS_OF_WEEK.map(d => ({
      day_of_week: d.value,
      is_available: false,
      time_start: '19:00',
      time_end: '22:00'
    }))
  );

  useEffect(() => {
    fetchAvailability();
  }, [departmentId, userId]);

  const fetchAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from('member_availability')
        .select('day_of_week, is_available, time_start, time_end')
        .eq('department_id', departmentId)
        .eq('user_id', userId);

      if (error) throw error;

      if (data && data.length > 0) {
        setAvailability(prev => {
          return prev.map(day => {
            const saved = data.find(d => d.day_of_week === day.day_of_week);
            if (saved) {
              return {
                ...day,
                is_available: saved.is_available,
                time_start: saved.time_start?.slice(0, 5) || '19:00',
                time_end: saved.time_end?.slice(0, 5) || '22:00'
              };
            }
            return day;
          });
        });
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDay = (dayOfWeek: number) => {
    setAvailability(prev =>
      prev.map(day =>
        day.day_of_week === dayOfWeek
          ? { ...day, is_available: !day.is_available }
          : day
      )
    );
  };

  const handleTimeChange = (dayOfWeek: number, field: 'time_start' | 'time_end', value: string) => {
    setAvailability(prev =>
      prev.map(day =>
        day.day_of_week === dayOfWeek
          ? { ...day, [field]: value }
          : day
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing availability for this user/department
      await supabase
        .from('member_availability')
        .delete()
        .eq('department_id', departmentId)
        .eq('user_id', userId);

      // Insert new availability (only for days that are available)
      const toInsert = availability
        .filter(a => a.is_available)
        .map(a => ({
          user_id: userId,
          department_id: departmentId,
          day_of_week: a.day_of_week,
          time_start: a.time_start,
          time_end: a.time_end,
          is_available: true
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('member_availability')
          .insert(toInsert);

        if (error) throw error;
      }

      toast({
        title: 'Disponibilidade salva!',
        description: 'Sua disponibilidade foi atualizada com sucesso.',
      });
    } catch (error) {
      console.error('Error saving availability:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar sua disponibilidade.',
      });
    } finally {
      setSaving(false);
    }
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
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Minha Disponibilidade
        </CardTitle>
        <CardDescription>
          Marque os dias e horários em que você está disponível para ser escalado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {DAYS_OF_WEEK.map(day => {
          const dayAvail = availability.find(a => a.day_of_week === day.value);
          const isAvailable = dayAvail?.is_available || false;

          return (
            <div
              key={day.value}
              className={`p-4 rounded-lg border transition-all ${
                isAvailable
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border/50 bg-muted/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={isAvailable}
                    onCheckedChange={() => handleToggleDay(day.value)}
                    id={`day-${day.value}`}
                  />
                  <Label
                    htmlFor={`day-${day.value}`}
                    className={`font-medium ${isAvailable ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {day.label}
                  </Label>
                </div>

                {isAvailable && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={dayAvail?.time_start || '19:00'}
                      onChange={(e) => handleTimeChange(day.value, 'time_start', e.target.value)}
                      className="w-24 h-8 text-sm"
                    />
                    <span className="text-muted-foreground">às</span>
                    <Input
                      type="time"
                      value={dayAvail?.time_end || '22:00'}
                      onChange={(e) => handleTimeChange(day.value, 'time_end', e.target.value)}
                      className="w-24 h-8 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full gradient-vibrant text-white gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salvar Disponibilidade
        </Button>
      </CardContent>
    </Card>
  );
}
