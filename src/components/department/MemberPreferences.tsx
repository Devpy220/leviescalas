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
  const [maxSchedules, setMaxSchedules] = useState<number | string>(4);
  const [minDaysBetween, setMinDaysBetween] = useState<number | string>(3);
  const [blackoutDates, setBlackoutDates] = useState<string[]>([]);
  const [newBlackoutDate, setNewBlackoutDate] = useState('');
  const [maxBlackoutDates, setMaxBlackoutDates] = useState(5);

  useEffect(() => {
    fetchPreferences();
  }, [departmentId, userId]);

  const fetchPreferences = async () => {
    try {
      // Fetch department blackout limit
      const { data: deptData } = await supabase
        .from('departments')
        .select('max_blackout_dates')
        .eq('id', departmentId)
        .maybeSingle();

      if (deptData?.max_blackout_dates) {
        setMaxBlackoutDates(deptData.max_blackout_dates);
      }

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
    if (blackoutDates.length >= maxBlackoutDates) {
      toast({
        variant: 'destructive',
        title: 'Limite atingido',
        description: `Você pode bloquear no máximo ${maxBlackoutDates} datas. Remova uma data antes de adicionar outra.`,
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
          max_schedules_per_month: Number(maxSchedules) || 4,
          min_days_between_schedules: Number(minDaysBetween) || 3,
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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Minhas Preferências</h3>
      </div>

      <div className="grid gap-2 grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="max-schedules" className="text-xs">Máx. escalas/mês</Label>
          <Input
            id="max-schedules"
            type="number"
            min={1}
            max={31}
            value={maxSchedules}
            onChange={(e) => setMaxSchedules(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="min-days" className="text-xs">Mín. dias entre</Label>
          <Input
            id="min-days"
            type="number"
            min={0}
            max={30}
            value={minDaysBetween}
            onChange={(e) => setMinDaysBetween(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5" />
            Datas de Bloqueio
          </Label>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {blackoutDates.length}/{maxBlackoutDates}
          </Badge>
        </div>
        
        <div className="flex gap-1.5">
          <Input
            type="date"
            value={newBlackoutDate}
            onChange={(e) => setNewBlackoutDate(e.target.value)}
            className="flex-1 h-8 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddBlackoutDate}
            disabled={!newBlackoutDate}
            className="h-8 text-xs px-2"
          >
            Adicionar
          </Button>
        </div>

        {blackoutDates.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {blackoutDates.map(date => (
              <Badge
                key={date}
                variant="secondary"
                className="gap-0.5 pr-0.5 text-[10px]"
              >
                {format(new Date(date + 'T12:00:00'), "dd 'de' MMM", { locale: ptBR })}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-3.5 w-3.5 hover:bg-destructive/20"
                  onClick={() => handleRemoveBlackoutDate(date)}
                >
                  <X className="w-2.5 h-2.5" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-center pt-1">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="gradient-vibrant text-white gap-1.5 px-6 h-8 text-xs"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
}
