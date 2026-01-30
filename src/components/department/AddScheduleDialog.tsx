import { useState, useEffect } from 'react';
import { format, getDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, User, FileText, Layers, UserCog, AlertTriangle } from 'lucide-react';
import { ASSIGNMENT_ROLES, AssignmentRole } from '@/lib/constants';
import { SIMPLE_SLOTS, getAvailableSlotsForDay } from '@/lib/fixedSlots';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

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

interface Sector {
  id: string;
  name: string;
  description: string | null;
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
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd, setTimeEnd] = useState('12:00');
  const [notes, setNotes] = useState('');
  const [assignmentRole, setAssignmentRole] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [memberBlackouts, setMemberBlackouts] = useState<Record<string, string[]>>({});
  const { toast } = useToast();
  const { user } = useAuth();

  // Check if selected member has this date blocked
  const isMemberBlocked = selectedMember && date 
    ? memberBlackouts[selectedMember]?.includes(format(date, 'yyyy-MM-dd'))
    : false;

  // Get available slots for selected date
  const availableSlots = date ? getAvailableSlotsForDay(getDay(date)) : [];

  useEffect(() => {
    if (selectedDate) {
      setDate(selectedDate);
    }
  }, [selectedDate]);

  // Update times when slot is selected
  useEffect(() => {
    if (selectedSlot && selectedSlot !== 'custom') {
      const slot = SIMPLE_SLOTS.find(s => `${s.dayOfWeek}-${s.timeStart}` === selectedSlot);
      if (slot) {
        setTimeStart(slot.timeStart);
        setTimeEnd(slot.timeEnd);
      }
    }
  }, [selectedSlot]);

  // Auto-select first slot when date changes and slots are available
  useEffect(() => {
    if (availableSlots.length > 0) {
      const firstSlot = availableSlots[0];
      setSelectedSlot(`${firstSlot.dayOfWeek}-${firstSlot.timeStart}`);
      setTimeStart(firstSlot.timeStart);
      setTimeEnd(firstSlot.timeEnd);
    } else {
      setSelectedSlot('custom');
      setTimeStart('19:00');
      setTimeEnd('22:00');
    }
  }, [date]);

  useEffect(() => {
    if (open) {
      // Fetch sectors and member blackouts when dialog opens
      fetchSectors();
      fetchMemberBlackouts();
    } else {
      // Reset form when dialog closes
      setSelectedMember('');
      setSelectedSector('');
      setSelectedSlot('');
      setTimeStart('09:00');
      setTimeEnd('12:00');
      setNotes('');
      setAssignmentRole('');
    }
  }, [open]);

  const fetchSectors = async () => {
    try {
      const { data, error } = await supabase
        .from('sectors')
        .select('id, name, description')
        .eq('department_id', departmentId)
        .order('name');

      if (error) throw error;
      setSectors(data || []);
    } catch (error) {
      console.error('Error fetching sectors:', error);
    }
  };

  const fetchMemberBlackouts = async () => {
    try {
      const { data, error } = await supabase
        .from('member_preferences')
        .select('user_id, blackout_dates')
        .eq('department_id', departmentId);

      if (error) throw error;
      
      const blackouts: Record<string, string[]> = {};
      (data || []).forEach(pref => {
        if (pref.blackout_dates && pref.blackout_dates.length > 0) {
          blackouts[pref.user_id] = pref.blackout_dates;
        }
      });
      setMemberBlackouts(blackouts);
    } catch (error) {
      console.error('Error fetching member blackouts:', error);
    }
  };

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
        sector_id: selectedSector || null,
        date: format(date, 'yyyy-MM-dd'),
        time_start: timeStart,
        time_end: timeEnd,
        notes: notes || null,
        assignment_role: assignmentRole && assignmentRole !== 'none' ? assignmentRole : null,
        created_by: user?.id
      }).select().single();

      if (error) throw error;

      // Notification is sent automatically by database trigger (notify_on_schedule_insert)
      // No need to call send-schedule-notification manually - this prevents duplicate notifications
      toast({
        title: 'Escala criada',
        description: 'Escala adicionada e notificação enviada!',
      });
      
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
                {members.map((member) => {
                  const isBlocked = date && memberBlackouts[member.user_id]?.includes(format(date, 'yyyy-MM-dd'));
                  return (
                    <SelectItem key={member.id} value={member.user_id}>
                      <span className={isBlocked ? 'text-destructive' : ''}>
                        {member.profile.name}
                        {isBlocked && ' ⚠️ Bloqueado'}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Blackout Warning */}
          {isMemberBlocked && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Este membro marcou este dia como indisponível! A escala pode ser criada, mas considere escolher outra data ou membro.
              </AlertDescription>
            </Alert>
          )}

          {/* Sector Select */}
          {sectors.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                Setor (opcional)
              </Label>
              <Select value={selectedSector} onValueChange={(value) => setSelectedSector(value === 'none' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum setor</SelectItem>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Time Slot Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Horário
            </Label>
            
            {availableSlots.length > 0 ? (
              <div className="space-y-3">
                {/* Predefined slots */}
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map((slot) => {
                    const slotKey = `${slot.dayOfWeek}-${slot.timeStart}`;
                    const isSelected = selectedSlot === slotKey;
                    return (
                      <Badge
                        key={slotKey}
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer px-3 py-2 text-sm transition-all ${
                          isSelected 
                            ? 'bg-primary text-primary-foreground' 
                            : 'hover:bg-primary/10'
                        }`}
                        onClick={() => setSelectedSlot(slotKey)}
                      >
                        {slot.label} ({slot.timeStart} - {slot.timeEnd})
                      </Badge>
                    );
                  })}
                  <Badge
                    variant={selectedSlot === 'custom' ? "default" : "outline"}
                    className={`cursor-pointer px-3 py-2 text-sm transition-all ${
                      selectedSlot === 'custom' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-primary/10'
                    }`}
                    onClick={() => setSelectedSlot('custom')}
                  >
                    Horário personalizado
                  </Badge>
                </div>

                {/* Custom time inputs - only show when custom is selected */}
                {selectedSlot === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Início</Label>
                      <Input
                        type="time"
                        value={timeStart}
                        onChange={(e) => setTimeStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Término</Label>
                      <Input
                        type="time"
                        value={timeEnd}
                        onChange={(e) => setTimeEnd(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* No predefined slots - show time inputs directly */
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Nenhum horário pré-definido para este dia
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Início</Label>
                    <Input
                      type="time"
                      value={timeStart}
                      onChange={(e) => setTimeStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Término</Label>
                    <Input
                      type="time"
                      value={timeEnd}
                      onChange={(e) => setTimeEnd(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Assignment Role */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <UserCog className="w-4 h-4 text-muted-foreground" />
              Função (opcional)
            </Label>
            <Select value={assignmentRole} onValueChange={setAssignmentRole}>
              <SelectTrigger>
                <SelectValue placeholder="Sem função específica" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem função específica</SelectItem>
                <SelectItem value="on_duty">
                  {ASSIGNMENT_ROLES.on_duty.icon} {ASSIGNMENT_ROLES.on_duty.label} - {ASSIGNMENT_ROLES.on_duty.description}
                </SelectItem>
                <SelectItem value="participant">
                  {ASSIGNMENT_ROLES.participant.icon} {ASSIGNMENT_ROLES.participant.label} - {ASSIGNMENT_ROLES.participant.description}
                </SelectItem>
              </SelectContent>
            </Select>
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
