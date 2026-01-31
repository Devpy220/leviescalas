import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeftRight, Calendar, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Schedule {
  id: string;
  date: string;
  time_start: string;
  time_end: string;
  user_id: string;
  user_name?: string;
  sector_name?: string;
  sector_color?: string;
}

interface SwapRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: {
    id: string;
    date: string;
    time_start: string;
    time_end: string;
    department_id: string;
  } | null;
  onSubmit: (targetScheduleId: string, targetUserId: string, reason?: string) => Promise<boolean>;
}

export function SwapRequestDialog({
  open,
  onOpenChange,
  schedule,
  onSubmit,
}: SwapRequestDialogProps) {
  const [availableSchedules, setAvailableSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!open || !schedule || !user) {
      setAvailableSchedules([]);
      setSelectedScheduleId('');
      setReason('');
      return;
    }

    const fetchAvailableSchedules = async () => {
      setFetching(true);
      try {
        // Fetch all schedules from the department that are not the user's
        const { data: schedules, error } = await supabase
          .from('schedules')
          .select('id, date, time_start, time_end, user_id, sector_id, sectors(name, color)')
          .eq('department_id', schedule.department_id)
          .neq('user_id', user.id)
          .gte('date', new Date().toISOString().split('T')[0])
          .order('date', { ascending: true });

        if (error) throw error;

        // Fetch member profiles
        const userIds = [...new Set((schedules || []).map(s => s.user_id))];
        const enrichedSchedules: Schedule[] = [];

        for (const s of schedules || []) {
          const { data: profile } = await supabase
            .rpc('get_member_profile', { member_user_id: s.user_id });

          enrichedSchedules.push({
            id: s.id,
            date: s.date,
            time_start: s.time_start,
            time_end: s.time_end,
            user_id: s.user_id,
            user_name: profile?.[0]?.name || 'Desconhecido',
            sector_name: (s.sectors as any)?.name,
            sector_color: (s.sectors as any)?.color,
          });
        }

        setAvailableSchedules(enrichedSchedules);
      } catch (error) {
        console.error('Error fetching available schedules:', error);
      } finally {
        setFetching(false);
      }
    };

    fetchAvailableSchedules();
  }, [open, schedule, user]);

  const handleSubmit = async () => {
    if (!selectedScheduleId) return;

    const selectedSchedule = availableSchedules.find(s => s.id === selectedScheduleId);
    if (!selectedSchedule) return;

    setLoading(true);
    const success = await onSubmit(selectedScheduleId, selectedSchedule.user_id, reason || undefined);
    setLoading(false);

    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            Pedir Troca de Escala
          </DialogTitle>
          <DialogDescription>
            Selecione a escala que você deseja em troca. O membro será notificado e precisará aceitar.
          </DialogDescription>
        </DialogHeader>

        {schedule && (
          <div className="bg-muted/50 rounded-lg p-3 mb-4">
            <p className="text-sm text-muted-foreground mb-1">Sua escala:</p>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="w-4 h-4 text-primary" />
              {format(parseISO(schedule.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Clock className="w-4 h-4" />
              {schedule.time_start.slice(0, 5)} - {schedule.time_end.slice(0, 5)}
            </div>
          </div>
        )}

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : availableSchedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>Nenhuma escala disponível para troca.</p>
            <p className="text-sm">Não há outras escalas futuras no departamento.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Escolha a escala para trocar:</Label>
              <RadioGroup
                value={selectedScheduleId}
                onValueChange={setSelectedScheduleId}
                className="space-y-2 max-h-48 overflow-y-auto"
              >
                {availableSchedules.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedScheduleId === s.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedScheduleId(s.id)}
                  >
                    <RadioGroupItem value={s.id} id={s.id} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-medium text-sm">
                          {format(parseISO(s.date), "EEE, dd/MM", { locale: ptBR })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {s.time_start.slice(0, 5)} - {s.time_end.slice(0, 5)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground truncate">
                          {s.user_name}
                        </span>
                        {s.sector_name && (
                          <span 
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ 
                              backgroundColor: `${s.sector_color}20`,
                              color: s.sector_color 
                            }}
                          >
                            {s.sector_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo (opcional):</Label>
              <Textarea
                id="reason"
                placeholder="Ex: Compromisso familiar, viagem..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedScheduleId || loading}
            className="bg-primary"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ArrowLeftRight className="w-4 h-4 mr-2" />
            )}
            Solicitar Troca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
