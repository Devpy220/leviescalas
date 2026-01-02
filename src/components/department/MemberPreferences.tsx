import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Settings2, X, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MemberPreferencesProps {
  departmentId: string;
  userId: string;
}

export default function MemberPreferences({ departmentId, userId }: MemberPreferencesProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maxSchedules, setMaxSchedules] = useState(4);
  const [minDaysBetween, setMinDaysBetween] = useState(3);
  const [blackoutDates, setBlackoutDates] = useState<string[]>([]);
  const [newBlackoutDate, setNewBlackoutDate] = useState('');

  useEffect(() => {
    fetchPreferences();
  }, [departmentId, userId]);

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('member_preferences')
        .select('*')
        .eq('department_id', departmentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setMaxSchedules(data.max_schedules_per_month);
        setMinDaysBetween(data.min_days_between_schedules);
        setBlackoutDates(data.blackout_dates || []);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlackoutDate = () => {
    if (!newBlackoutDate) return;
    if (blackoutDates.includes(newBlackoutDate)) {
      toast({
        variant: 'destructive',
        title: 'Data já adicionada',
        description: 'Esta data já está na lista de bloqueio.',
      });
      return;
    }
    setBlackoutDates(prev => [...prev, newBlackoutDate].sort());
    setNewBlackoutDate('');
  };

  const handleRemoveBlackoutDate = (date: string) => {
    setBlackoutDates(prev => prev.filter(d => d !== date));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('member_preferences')
        .upsert({
          user_id: userId,
          department_id: departmentId,
          max_schedules_per_month: maxSchedules,
          min_days_between_schedules: minDaysBetween,
          blackout_dates: blackoutDates
        }, {
          onConflict: 'user_id,department_id'
        });

      if (error) throw error;

      toast({
        title: 'Preferências salvas!',
        description: 'Suas preferências foram atualizadas com sucesso.',
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar suas preferências.',
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
          <Settings2 className="w-5 h-5 text-primary" />
          Minhas Preferências
        </CardTitle>
        <CardDescription>
          Configure suas preferências de escala para que o sistema considere ao gerar escalas automáticas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="max-schedules">Máximo de escalas por mês</Label>
            <Input
              id="max-schedules"
              type="number"
              min={1}
              max={31}
              value={maxSchedules}
              onChange={(e) => setMaxSchedules(parseInt(e.target.value) || 4)}
            />
            <p className="text-xs text-muted-foreground">
              Limite de quantas vezes você pode ser escalado por mês.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min-days">Mínimo de dias entre escalas</Label>
            <Input
              id="min-days"
              type="number"
              min={0}
              max={30}
              value={minDaysBetween}
              onChange={(e) => setMinDaysBetween(parseInt(e.target.value) || 3)}
            />
            <p className="text-xs text-muted-foreground">
              Intervalo mínimo entre uma escala e outra.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Datas de Bloqueio
          </Label>
          <p className="text-xs text-muted-foreground">
            Adicione datas específicas em que você NÃO está disponível (férias, compromissos, etc.).
          </p>
          
          <div className="flex gap-2">
            <Input
              type="date"
              value={newBlackoutDate}
              onChange={(e) => setNewBlackoutDate(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddBlackoutDate}
              disabled={!newBlackoutDate}
            >
              Adicionar
            </Button>
          </div>

          {blackoutDates.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {blackoutDates.map(date => (
                <Badge
                  key={date}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {format(new Date(date + 'T12:00:00'), "dd 'de' MMM", { locale: ptBR })}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 hover:bg-destructive/20"
                    onClick={() => handleRemoveBlackoutDate(date)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </div>

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
          Salvar Preferências
        </Button>
      </CardContent>
    </Card>
  );
}
