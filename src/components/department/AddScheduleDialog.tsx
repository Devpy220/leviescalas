import { useState, useEffect, useMemo } from 'react';
import { format, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, Users, FileText, Layers, UserCog, AlertTriangle, CheckSquare, X } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

interface MemberConfig {
  sector_id: string;
  assignment_role: string;
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
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberConfigs, setMemberConfigs] = useState<Record<string, MemberConfig>>({});
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd, setTimeEnd] = useState('12:00');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [memberBlackouts, setMemberBlackouts] = useState<Record<string, string[]>>({});
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const { toast } = useToast();
  const { user } = useAuth();

  // Get available slots for selected date
  const availableSlots = date ? getAvailableSlotsForDay(getDay(date)) : [];

  // Get blocked members for selected date
  const blockedMembers = useMemo(() => {
    if (!date) return new Set<string>();
    const dateStr = format(date, 'yyyy-MM-dd');
    return new Set(
      Object.entries(memberBlackouts)
        .filter(([_, dates]) => dates.includes(dateStr))
        .map(([userId]) => userId)
    );
  }, [date, memberBlackouts]);

  // Available (non-blocked) members
  const availableMembers = useMemo(() => 
    members.filter(m => !blockedMembers.has(m.user_id)),
    [members, blockedMembers]
  );

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
      fetchSectors();
      fetchMemberBlackouts();
    } else {
      // Reset form when dialog closes
      setSelectedMembers([]);
      setMemberConfigs({});
      setSelectedSlot('');
      setTimeStart('09:00');
      setTimeEnd('12:00');
      setNotes('');
      setStep('select');
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

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev => {
      if (prev.includes(userId)) {
        // Remove from selection and config
        const newConfigs = { ...memberConfigs };
        delete newConfigs[userId];
        setMemberConfigs(newConfigs);
        return prev.filter(id => id !== userId);
      } else {
        // Add to selection with default config
        setMemberConfigs(prev => ({
          ...prev,
          [userId]: { sector_id: '', assignment_role: '' }
        }));
        return [...prev, userId];
      }
    });
  };

  const selectAllAvailable = () => {
    const allIds = availableMembers.map(m => m.user_id);
    setSelectedMembers(allIds);
    const configs: Record<string, MemberConfig> = {};
    allIds.forEach(id => {
      configs[id] = { sector_id: '', assignment_role: '' };
    });
    setMemberConfigs(configs);
  };

  const clearSelection = () => {
    setSelectedMembers([]);
    setMemberConfigs({});
  };

  const updateMemberConfig = (userId: string, field: keyof MemberConfig, value: string) => {
    setMemberConfigs(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  };

  const getMemberById = (userId: string) => 
    members.find(m => m.user_id === userId);

  const goToConfigureStep = () => {
    if (selectedMembers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Selecione ao menos um membro',
      });
      return;
    }
    setStep('configure');
  };

  const handleSubmit = async () => {
    if (!date || selectedMembers.length === 0 || !timeStart || !timeEnd) {
      toast({
        variant: 'destructive',
        title: 'Preencha todos os campos',
        description: 'Data, membros e horários são obrigatórios.',
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
      // Create schedules for all selected members
      const schedulesToInsert = selectedMembers.map(userId => {
        const config = memberConfigs[userId] || { sector_id: '', assignment_role: '' };
        return {
          department_id: departmentId,
          user_id: userId,
          sector_id: config.sector_id && config.sector_id !== 'none' ? config.sector_id : null,
          date: format(date, 'yyyy-MM-dd'),
          time_start: timeStart,
          time_end: timeEnd,
          notes: notes || null,
          assignment_role: config.assignment_role && config.assignment_role !== 'none' ? config.assignment_role : null,
          created_by: user?.id
        };
      });

      const { error } = await supabase
        .from('schedules')
        .insert(schedulesToInsert);

      if (error) throw error;

      toast({
        title: 'Escalas criadas',
        description: `${selectedMembers.length} escala${selectedMembers.length > 1 ? 's' : ''} criada${selectedMembers.length > 1 ? 's' : ''} com sucesso!`,
      });
      
      onScheduleCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating schedules:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar escalas',
        description: 'Não foi possível criar as escalas. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">
            {step === 'select' ? 'Nova Escala' : 'Configurar Membros'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' 
              ? 'Escolha a data, horário e selecione os membros.'
              : `Configure setor e função para ${selectedMembers.length} membro${selectedMembers.length > 1 ? 's' : ''}.`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="space-y-4 mt-4 flex-1 overflow-hidden flex flex-col">
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

            {/* Time Slot Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Horário
              </Label>
              
              {availableSlots.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {availableSlots.map((slot) => {
                      const slotKey = `${slot.dayOfWeek}-${slot.timeStart}`;
                      const isSelected = selectedSlot === slotKey;
                      return (
                        <Badge
                          key={slotKey}
                          variant={isSelected ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer px-3 py-2 text-sm transition-all",
                            isSelected 
                              ? 'bg-primary text-primary-foreground' 
                              : 'hover:bg-primary/10'
                          )}
                          onClick={() => setSelectedSlot(slotKey)}
                        >
                          {slot.label} ({slot.timeStart} - {slot.timeEnd})
                        </Badge>
                      );
                    })}
                    <Badge
                      variant={selectedSlot === 'custom' ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer px-3 py-2 text-sm transition-all",
                        selectedSlot === 'custom' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-primary/10'
                      )}
                      onClick={() => setSelectedSlot('custom')}
                    >
                      Personalizado
                    </Badge>
                  </div>

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

            {/* Member Selection */}
            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  Membros ({selectedMembers.length} selecionado{selectedMembers.length !== 1 ? 's' : ''})
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selectAllAvailable}
                    className="text-xs h-7"
                  >
                    <CheckSquare className="w-3 h-3 mr-1" />
                    Todos
                  </Button>
                  {selectedMembers.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      className="text-xs h-7"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
              
              <ScrollArea className="flex-1 border rounded-md">
                <div className="p-2 space-y-1">
                  {members.map((member) => {
                    const isBlocked = blockedMembers.has(member.user_id);
                    const isSelected = selectedMembers.includes(member.user_id);
                    
                    return (
                      <div
                        key={member.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                          isSelected ? "bg-primary/10" : "hover:bg-muted/50",
                          isBlocked && "opacity-60"
                        )}
                        onClick={() => toggleMember(member.user_id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleMember(member.user_id)}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.profile.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {member.profile.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            isBlocked && "text-destructive"
                          )}>
                            {member.profile.name}
                          </p>
                        </div>
                        {isBlocked && (
                          <Badge variant="destructive" className="text-xs shrink-0">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Bloqueado
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={goToConfigureStep}
                disabled={selectedMembers.length === 0}
                className="gradient-primary text-primary-foreground"
              >
                Continuar ({selectedMembers.length})
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 mt-4 flex-1 overflow-hidden flex flex-col">
            {/* Summary */}
            <div className="bg-muted/50 rounded-md p-3 text-sm">
              <p className="font-medium">
                {date && format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-muted-foreground">
                {timeStart} - {timeEnd} • {selectedMembers.length} membro{selectedMembers.length > 1 ? 's' : ''}
              </p>
            </div>

            {/* Member Configurations */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-3 pr-4">
                {selectedMembers.map((userId) => {
                  const member = getMemberById(userId);
                  if (!member) return null;
                  const config = memberConfigs[userId] || { sector_id: '', assignment_role: '' };
                  
                  return (
                    <div
                      key={userId}
                      className="border rounded-lg p-3 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.profile.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {member.profile.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{member.profile.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-6 w-6 p-0"
                          onClick={() => toggleMember(userId)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {/* Sector Select */}
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            Setor
                          </Label>
                          <Select 
                            value={config.sector_id || 'none'} 
                            onValueChange={(v) => updateMemberConfig(userId, 'sector_id', v === 'none' ? '' : v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecionar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              {sectors.map((sector) => (
                                <SelectItem key={sector.id} value={sector.id}>
                                  {sector.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Assignment Role Select */}
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            <UserCog className="w-3 h-3" />
                            Função
                          </Label>
                          <Select 
                            value={config.assignment_role || 'none'} 
                            onValueChange={(v) => updateMemberConfig(userId, 'assignment_role', v === 'none' ? '' : v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecionar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma</SelectItem>
                              <SelectItem value="on_duty">
                                {ASSIGNMENT_ROLES.on_duty.icon} {ASSIGNMENT_ROLES.on_duty.label}
                              </SelectItem>
                              <SelectItem value="participant">
                                {ASSIGNMENT_ROLES.participant.icon} {ASSIGNMENT_ROLES.participant.label}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Observações (opcional)
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observação para todas as escalas..."
                rows={2}
                className="text-sm"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('select')}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || selectedMembers.length === 0}
                className="gradient-primary text-primary-foreground"
              >
                {loading ? 'Criando...' : `Criar ${selectedMembers.length} Escala${selectedMembers.length > 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
