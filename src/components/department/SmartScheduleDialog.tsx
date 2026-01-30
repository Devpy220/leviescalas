import { useState, useEffect, useMemo } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Calendar, Users, Check, X, AlertCircle, Send, Bell } from 'lucide-react';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createExtendedMemberColorMap, getMemberBackgroundStyle } from '@/lib/memberColors';
import { SMART_SLOTS as FIXED_SLOTS } from '@/lib/fixedSlots';

// Período especial pré-definido
const SPECIAL_PERIOD = {
  id: 'jan-5-15',
  label: 'Semana Especial (5-15 Jan)',
  startDate: '2026-01-05',
  endDate: '2026-01-15'
};

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
  slotLabel?: string;
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
  const [periodType, setPeriodType] = useState<'month' | 'special'>('special');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const next = addMonths(new Date(), 1);
    return format(next, 'yyyy-MM');
  });
  const [slotMembers, setSlotMembers] = useState<Record<string, number>>(() => 
    FIXED_SLOTS.reduce((acc, slot) => ({ ...acc, [slot.id]: slot.defaultMembers }), {})
  );
  const [sectorId, setSectorId] = useState<string>('all');
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sendNotificationsOnConfirm, setSendNotificationsOnConfirm] = useState(true);
  
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

  const getMonthDates = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    const allDays = eachDayOfInterval({ start, end });
    // Filter days that match any of our fixed slots
    const validDays = FIXED_SLOTS.map(s => s.dayOfWeek);
    return allDays.filter(day => validDays.includes(day.getDay()));
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      let startDate: string;
      let endDate: string;
      
      if (periodType === 'special') {
        startDate = SPECIAL_PERIOD.startDate;
        endDate = SPECIAL_PERIOD.endDate;
      } else {
        const [year, month] = selectedMonth.split('-').map(Number);
        const start = startOfMonth(new Date(year, month - 1));
        const end = endOfMonth(new Date(year, month - 1));
        startDate = format(start, 'yyyy-MM-dd');
        endDate = format(end, 'yyyy-MM-dd');
      }
      
      // Build fixed slots with configured member counts
      const configuredSlots = FIXED_SLOTS.map(slot => ({
        ...slot,
        membersCount: slotMembers[slot.id] || slot.defaultMembers
      }));
      
      const { data, error } = await supabase.functions.invoke('generate-smart-schedule', {
        body: {
          department_id: departmentId,
          start_date: startDate,
          end_date: endDate,
          sector_id: sectorId === 'all' ? undefined : sectorId,
          fixed_slots: configuredSlots
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

      const schedulesWithSelection = (data.schedules || []).map((s: SuggestedSchedule) => {
        // Find matching slot label
        const slot = FIXED_SLOTS.find(fs => 
          fs.timeStart === s.time_start && fs.timeEnd === s.time_end
        );
        return {
          ...s,
          selected: true,
          slotLabel: slot?.label || `${s.time_start}-${s.time_end}`
        };
      });

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

      const { data: insertedSchedules, error } = await supabase
        .from('schedules')
        .insert(schedulesToInsert)
        .select();

      if (error) throw error;

      // Create notifications for each scheduled member (only if checkbox is checked)
      if (sendNotificationsOnConfirm && insertedSchedules) {
        const notifications = insertedSchedules.map(schedule => {
          const scheduleInfo = selectedSchedules.find(
            s => s.user_id === schedule.user_id && s.date === schedule.date
          );
          return {
            user_id: schedule.user_id,
            department_id: departmentId,
            schedule_id: schedule.id,
            type: 'schedule_assigned',
            message: `Você foi escalado para ${format(new Date(schedule.date + 'T12:00:00'), "dd/MM (EEEE)", { locale: ptBR })} das ${schedule.time_start.slice(0, 5)} às ${schedule.time_end.slice(0, 5)}`,
            status: 'pending' as const
          };
        });

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notifications);

        if (notifError) {
          console.error('Error creating notifications:', notifError);
        }
      }

      toast({
        title: 'Escalas criadas!',
        description: `${selectedSchedules.length} escalas foram criadas com sucesso.${sendNotificationsOnConfirm ? ' Notificações enviadas.' : ''}`,
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

  // Create color map for members in suggestions
  const memberColorMap = useMemo(() => {
    const uniqueMembers = suggestions.reduce((acc, s) => {
      if (!acc.find(m => m.user_id === s.user_id)) {
        acc.push({ id: s.user_id, user_id: s.user_id, profile: { name: s.name } });
      }
      return acc;
    }, [] as Array<{ id: string; user_id: string; profile: { name: string } }>);
    return createExtendedMemberColorMap(uniqueMembers);
  }, [suggestions]);

  const getMemberBgStyle = (userId: string): React.CSSProperties => {
    return getMemberBackgroundStyle(memberColorMap, userId);
  };

  // Generate month options (current + next 3 months)
  const monthOptions = Array.from({ length: 4 }, (_, i) => {
    const date = addMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR })
    };
  });

  // Group suggestions by date for preview
  const groupedByDate = suggestions.reduce((acc, schedule) => {
    if (!acc[schedule.date]) {
      acc[schedule.date] = [];
    }
    acc[schedule.date].push(schedule);
    return acc;
  }, {} as Record<string, SuggestedSchedule[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Escalas Automáticas - Horários Fixos
          </DialogTitle>
          <DialogDescription>
            {step === 'config' 
              ? 'Gere escalas para os horários fixos: Quarta (19:20-22:00), Domingo Manhã (8:00-11:30) e Noite (18:00-22:00).'
              : 'Revise e ajuste as escalas sugeridas antes de confirmar.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'config' ? (
          <div className="space-y-4 py-4">
            {/* Period Type Selection */}
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={periodType} onValueChange={(v) => setPeriodType(v as 'month' | 'special')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="special">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      {SPECIAL_PERIOD.label}
                    </div>
                  </SelectItem>
                  <SelectItem value="month">Escolher mês completo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodType === 'month' && (
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="capitalize">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {periodType === 'special' && (
              <Card className="p-3 bg-amber-500/10 border-amber-500/30">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    5 a 15 de Janeiro de 2026
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Período especial com horários fixos 19:20-22:00
                </p>
              </Card>
            )}

            {/* Members per slot configuration */}
            <div className="space-y-3">
              <Label>Membros por horário</Label>
              <div className="space-y-2">
                {FIXED_SLOTS.map(slot => (
                  <div key={slot.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                    <div className="flex-1">
                      <span className="text-sm font-medium">{slot.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={slotMembers[slot.id] || slot.defaultMembers}
                        onChange={(e) => setSlotMembers(prev => ({
                          ...prev,
                          [slot.id]: parseInt(e.target.value) || slot.defaultMembers
                        }))}
                        className="w-16 text-center"
                      />
                      <Users className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Domingo Manhã e Quarta: 3 pessoas | Domingo Noite: 5 pessoas (padrão)
              </p>
            </div>

            {sectors.length > 0 && (
              <div className="space-y-2">
                <Label>Setor (opcional)</Label>
                <Select value={sectorId} onValueChange={setSectorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os setores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os setores</SelectItem>
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
                    <li>A IA analisa a disponibilidade dos membros nos horários fixos</li>
                    <li>Considera o histórico de escalas anteriores</li>
                    <li>Distribui de forma justa e equilibrada</li>
                    <li>Você pode revisar e ajustar antes de confirmar</li>
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
              <div className="space-y-4">
                {Object.entries(groupedByDate).map(([date, schedules]) => (
                  <div key={date} className="space-y-2">
                    <div className="font-medium text-sm capitalize sticky top-0 bg-background py-1">
                      {format(new Date(date + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </div>
                    {schedules.map((schedule, idx) => {
                      const globalIndex = suggestions.findIndex(
                        s => s.date === schedule.date && s.user_id === schedule.user_id && s.time_start === schedule.time_start
                      );
                      return (
                        <Card
                          key={`${schedule.date}-${schedule.user_id}-${schedule.time_start}`}
                          className={`p-3 cursor-pointer transition-all ${
                            schedule.selected
                              ? 'border-primary/50 bg-primary/5'
                              : 'border-border/50 opacity-60'
                          }`}
                          onClick={() => toggleScheduleSelection(globalIndex)}
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
                                <AvatarFallback 
                                  className="text-xs font-bold text-white"
                                  style={getMemberBgStyle(schedule.user_id)}
                                >
                                  {getInitials(schedule.name)}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div>
                                <p className="font-medium text-sm">{schedule.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {schedule.slotLabel}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Card className="p-3 mt-4 border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Enviar notificações ao confirmar</span>
                </div>
                <Switch
                  checked={sendNotificationsOnConfirm}
                  onCheckedChange={setSendNotificationsOnConfirm}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Os membros escalados receberão uma notificação.
              </p>
            </Card>
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
              ) : sendNotificationsOnConfirm ? (
                <Send className="w-4 h-4" />
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
