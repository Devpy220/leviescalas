import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, User, FileText } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Member {
  id: string;
  user_id: string;
  role: 'leader' | 'member';
  profile: {
    name: string;
    email: string;
    whatsapp: string;
    avatar_url: string | null;
  };
}

interface AddScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  members: Member[];
  selectedDate: Date | null;
  onScheduleCreated: () => void;
}

export default function AddScheduleDialog({
  open,
  onOpenChange,
  departmentId,
  members,
  selectedDate,
  onScheduleCreated
}: AddScheduleDialogProps) {
  const [date, setDate] = useState<Date | undefined>(selectedDate || new Date());
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd, setTimeEnd] = useState('17:00');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (selectedDate) {
      setDate(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!open) {
      // Reset form when dialog closes
      setSelectedMember('');
      setTimeStart('09:00');
      setTimeEnd('17:00');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !selectedMember || !timeStart || !timeEnd) {
      toast({
        variant: 'destructive',
        title: 'Preencha todos os campos',
        description: 'Data, membro e horários são obrigatórios.',
      });
      return;
    }

    if (timeEnd <= timeStart) {
      toast({
        variant: 'destructive',
        title: 'Horário inválido',
        description: 'O horário de término deve ser após o horário de início.',
      });
      return;
    }

    setLoading(true);
    try {
      // Get department name for notification using secure function
      const { data: department } = await supabase
        .rpc('get_department_secure', { dept_id: departmentId })
        .single();

      const { data: scheduleData, error } = await supabase.from('schedules').insert({
        department_id: departmentId,
        user_id: selectedMember,
        date: format(date, 'yyyy-MM-dd'),
        time_start: timeStart,
        time_end: timeEnd,
        notes: notes || null,
        created_by: user?.id
      }).select().single();

      if (error) throw error;

      // Send notification email
      try {
        await supabase.functions.invoke('send-schedule-notification', {
          body: {
            schedule_id: scheduleData.id,
            user_id: selectedMember,
            department_id: departmentId,
            department_name: department?.name || 'Departamento',
            date: format(date, 'yyyy-MM-dd'),
            time_start: timeStart,
            time_end: timeEnd,
            notes: notes || undefined,
            type: 'new_schedule'
          }
        });
        
        toast({
          title: 'Escala criada',
          description: 'Escala adicionada e notificação enviada!',
        });
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
        toast({
          title: 'Escala criada',
          description: 'Escala adicionada, mas não foi possível enviar notificação.',
        });
      }
      
      onScheduleCreated();
    } catch (error) {
      console.error('Error creating schedule:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar escala',
        description: 'Não foi possível criar a escala. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-display">Nova Escala</DialogTitle>
          <DialogDescription>
            Adicione uma nova escala para um membro do departamento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              Data
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  {date ? (
                    format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                  ) : (
                    <span className="text-muted-foreground">Selecione uma data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Member Select */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Membro
            </Label>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um membro" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.user_id}>
                    {member.profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Início
              </Label>
              <Input
                type="time"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Término
              </Label>
              <Input
                type="time"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Observações (opcional)
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações sobre esta escala..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="gradient-primary text-primary-foreground"
            >
              {loading ? 'Criando...' : 'Criar Escala'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
