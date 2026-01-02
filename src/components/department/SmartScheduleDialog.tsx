import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Calendar, Users, Check, X, AlertCircle } from 'lucide-react';
import { format, addDays, addWeeks, addMonths, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SmartScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  onSchedulesCreated: () => void;
}

interface SuggestedSchedule {
  date: string;
  user_id: string;
  name: string;
  time_start: string;
  time_end: string;
  sector_id?: string;
  selected: boolean;
}

interface Sector {
  id: string;
  name: string;
}

export default function SmartScheduleDialog({
  open,
  onOpenChange,
  departmentId,
  onSchedulesCreated
}: SmartScheduleDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'config' | 'preview'>('config');
  
  // Configuration
  const [period, setPeriod] = useState<'week' | 'two_weeks' | 'month'>('week');
  const [timeStart, setTimeStart] = useState('19:00');
  const [timeEnd, setTimeEnd] = useState('22:00');
  const [membersPerDay, setMembersPerDay] = useState(2);
  const [sectorId, setSectorId] = useState<string>('');
  const [sectors, setSectors] = useState<Sector[]>([]);
  
  // Results
  const [suggestions, setSuggestions] = useState<SuggestedSchedule[]>([]);
  const [reasoning, setReasoning] = useState('');

  useEffect(() => {
    if (open) {
      fetchSectors();
      setStep('config');
      setSuggestions([]);
      setReasoning('');
    }
  }, [open, departmentId]);

  const fetchSectors = async () => {
    const { data } = await supabase
      .from('sectors')
      .select('id, name')
      .eq('department_id', departmentId)
      .order('name');
    
    setSectors(data || []);
  };

  const getDateRange = () => {
    const start = startOfDay(new Date());
    let end: Date;
    
    switch (period) {
      case 'week':
        end = addWeeks(start, 1);
        break;
      case 'two_weeks':
        end = addWeeks(start, 2);
        break;
      case 'month':
        end = addMonths(start, 1);
        break;
      default:
        end = addWeeks(start, 1);
    }
    
    return {
      start_date: format(start, 'yyyy-MM-dd'),
      end_date: format(end, 'yyyy-MM-dd')
    };
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { start_date, end_date } = getDateRange();
      
      const { data, error } = await supabase.functions.invoke('generate-smart-schedule', {
        body: {
          department_id: departmentId,
          start_date,
          end_date,
          time_start: timeStart,
          time_end: timeEnd,
          members_per_day: membersPerDay,
          sector_id: sectorId || undefined
        }
      });

      if (error) throw error;
      
      if (data.error) {
        toast({
          variant: 'destructive',
          title: 'Erro ao gerar escalas',
          description: data.error,
        });
        return;
      }

      const schedulesWithSelection = (data.schedules || []).map((s: SuggestedSchedule) => ({
        ...s,
        selected: true
      }));

      setSuggestions(schedulesWithSelection);
      setReasoning(data.reasoning || '');
      setStep('preview');
    } catch (error) {
      console.error('Error generating schedules:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar escalas',
        description: 'Não foi possível gerar as escalas automáticas.',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleScheduleSelection = (index: number) => {
    setSuggestions(prev =>
      prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s)
    );
  };

  const handleConfirm = async () => {
    const selectedSchedules = suggestions.filter(s => s.selected);
    
    if (selectedSchedules.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhuma escala selecionada',
        description: 'Selecione pelo menos uma escala para criar.',
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const schedulesToInsert = selectedSchedules.map(s => ({
        department_id: departmentId,
        user_id: s.user_id,
        date: s.date,
        time_start: s.time_start,
        time_end: s.time_end,
        sector_id: s.sector_id || null,
        created_by: user.id
      }));

      const { error } = await supabase
        .from('schedules')
        .insert(schedulesToInsert);

      if (error) throw error;

      toast({
        title: 'Escalas criadas!',
        description: `${selectedSchedules.length} escalas foram criadas com sucesso.`,
      });

      onSchedulesCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating schedules:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar escalas',
        description: 'Não foi possível salvar as escalas.',
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Escalas Automáticas Inteligentes
          </DialogTitle>
          <DialogDescription>
            {step === 'config' 
              ? 'Configure os parâmetros e deixe a IA gerar as escalas.'
              : 'Revise e ajuste as escalas sugeridas antes de confirmar.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'config' ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Próxima semana</SelectItem>
                  <SelectItem value="two_weeks">Próximas 2 semanas</SelectItem>
                  <SelectItem value="month">Próximo mês</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário início</Label>
                <Input
                  type="time"
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Horário fim</Label>
                <Input
                  type="time"
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Membros por dia</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={membersPerDay}
                onChange={(e) => setMembersPerDay(parseInt(e.target.value) || 2)}
              />
            </div>

            {sectors.length > 0 && (
              <div className="space-y-2">
                <Label>Setor (opcional)</Label>
                <Select value={sectorId} onValueChange={setSectorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os setores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os setores</SelectItem>
                    {sectors.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Card className="p-4 bg-muted/30 border-border/50">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Como funciona?</p>
                  <ul className="space-y-1 list-disc pl-4">
                    <li>A IA analisa a disponibilidade dos membros</li>
                    <li>Considera o histórico de escalas anteriores</li>
                    <li>Respeita as preferências individuais</li>
                    <li>Distribui de forma justa e equilibrada</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col py-4">
            {reasoning && (
              <Card className="p-3 mb-4 bg-primary/5 border-primary/20">
                <p className="text-sm text-muted-foreground">{reasoning}</p>
              </Card>
            )}
            
            <div className="text-sm text-muted-foreground mb-2">
              {suggestions.filter(s => s.selected).length} de {suggestions.length} escalas selecionadas
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-2">
                {suggestions.map((schedule, index) => (
                  <Card
                    key={`${schedule.date}-${schedule.user_id}`}
                    className={`p-3 cursor-pointer transition-all ${
                      schedule.selected
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border/50 opacity-60'
                    }`}
                    onClick={() => toggleScheduleSelection(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          schedule.selected ? 'bg-primary text-white' : 'bg-muted'
                        }`}>
                          {schedule.selected ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </div>
                        
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-primary/20 text-primary">
                            {getInitials(schedule.name)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div>
                          <p className="font-medium text-sm">{schedule.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {schedule.time_start} - {schedule.time_end}
                          </p>
                        </div>
                      </div>
                      
                      <Badge variant="secondary">
                        {format(new Date(schedule.date + 'T12:00:00'), "dd/MM (EEE)", { locale: ptBR })}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'preview' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('config')}
              disabled={saving}
            >
              Voltar
            </Button>
          )}
          
          {step === 'config' ? (
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="gradient-vibrant text-white gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Gerar Escalas
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={saving || suggestions.filter(s => s.selected).length === 0}
              className="gradient-vibrant text-white gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Confirmar ({suggestions.filter(s => s.selected).length})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
