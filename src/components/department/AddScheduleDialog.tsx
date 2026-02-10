import { useState, useEffect, useMemo } from 'react';
import { format, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, Users, FileText, Layers, UserCog, AlertTriangle, CheckSquare, X, Pencil } from 'lucide-react';
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
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  
  // NEW: State for member edit dialog
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [localSectorId, setLocalSectorId] = useState<string>('');
  const [localRole, setLocalRole] = useState<string>('');
  const [crossDeptConflicts, setCrossDeptConflicts] = useState<Record<string, string>>({});
  
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

  // Available (non-blocked and non-conflicting) members
  const availableMembers = useMemo(() => 
    members.filter(m => !blockedMembers.has(m.user_id) && !crossDeptConflicts[m.user_id]),
    [members, blockedMembers, crossDeptConflicts]
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
      setCrossDeptConflicts({});
    }
  }, [open]);

  // Fetch cross-department conflicts when date/time changes
  useEffect(() => {
    if (!date || !timeStart || !timeEnd || !open) return;
    const fetchConflicts = async () => {
      const userIds = members.map(m => m.user_id);
      if (userIds.length === 0) return;
      const { data, error } = await supabase.rpc('check_cross_department_conflicts', {
        p_user_ids: userIds,
        p_date: format(date, 'yyyy-MM-dd'),
        p_time_start: timeStart,
        p_time_end: timeEnd,
        p_exclude_department_id: departmentId
      });
      if (error) {
        console.error('Error checking conflicts:', error);
        return;
      }
      const conflicts: Record<string, string> = {};
      (data || []).forEach((c: any) => {
        conflicts[c.user_id] = c.conflict_department_name;
      });
      setCrossDeptConflicts(conflicts);
      // Remove conflicting members from selection
      setSelectedMembers(prev => prev.filter(id => !conflicts[id]));
    };
    fetchConflicts();
  }, [date, timeStart, timeEnd, open, departmentId, members]);

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
    // Prevent selecting blocked or conflicting members
    if (blockedMembers.has(userId) || crossDeptConflicts[userId]) return;
    
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
    } catch (error: any) {
      console.error('Error creating schedules:', error);
      const isConflict = error?.message?.includes('Conflito de horário');
      toast({
        variant: 'destructive',
        title: isConflict ? 'Conflito de horário' : 'Erro ao criar escalas',
        description: isConflict 
          ? error.message 
          : 'Não foi possível criar as escalas. Tente novamente.',
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

            {/* Action Buttons Row */}
            <div className="grid grid-cols-2 gap-3 py-3 border-t border-b">
              {/* Schedule All Button */}
              <Button
                type="button"
                className="h-14 flex-col gap-1"
                variant="default"
                onClick={() => {
                  selectAllAvailable();
                  setStep('configure');
                }}
                disabled={availableMembers.length === 0}
              >
                <Users className="w-5 h-5" />
                <span className="text-xs">Escalar Todos ({availableMembers.length})</span>
              </Button>
              
              {/* Select Individually Button */}
              <Button
                type="button"
                variant="outline"
                className="h-14 flex-col gap-1"
                onClick={() => setShowMemberPicker(true)}
              >
                <CheckSquare className="w-5 h-5" />
                <span className="text-xs">Selecionar Individual</span>
              </Button>
            </div>

            {/* Selected Members Preview */}
            {selectedMembers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">
                    {selectedMembers.length} membro{selectedMembers.length > 1 ? 's' : ''} selecionado{selectedMembers.length > 1 ? 's' : ''}
                  </Label>
                  <Button variant="link" size="sm" onClick={() => setShowMemberPicker(true)} className="h-auto p-0">
                    Editar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.slice(0, 8).map((userId) => {
                    const member = getMemberById(userId);
                    if (!member) return null;
                    return (
                      <Avatar key={userId} className="h-8 w-8 border-2 border-primary/20">
                        <AvatarImage src={member.profile.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {member.profile.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    );
                  })}
                  {selectedMembers.length > 8 && (
                    <span className="text-sm text-muted-foreground self-center">+{selectedMembers.length - 8}</span>
                  )}
                </div>
              </div>
            )}

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

            {/* Member Configurations - READ-ONLY display with Edit button */}
            <div className="flex-1 min-h-0 overflow-y-auto border rounded-md">
              <div className="p-3 space-y-2">
                {selectedMembers.map((userId) => {
                  const member = getMemberById(userId);
                  if (!member) return null;
                  const config = memberConfigs[userId] || { sector_id: '', assignment_role: '' };
                  const sectorName = sectors.find(s => s.id === config.sector_id)?.name || 'Nenhum';
                  const roleName = config.assignment_role && config.assignment_role !== 'none' 
                    ? `${ASSIGNMENT_ROLES[config.assignment_role as AssignmentRole]?.icon || ''} ${ASSIGNMENT_ROLES[config.assignment_role as AssignmentRole]?.label || 'Nenhuma'}`
                    : 'Nenhuma';
                  
                  return (
                    <div
                      key={userId}
                      className="flex items-center gap-3 p-3 border rounded-lg bg-background hover:bg-muted/30 transition-colors"
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={member.profile.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {member.profile.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{member.profile.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Setor: {sectorName} • Função: {roleName}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => {
                            setEditingMemberId(userId);
                            setLocalSectorId(config.sector_id || '');
                            setLocalRole(config.assignment_role || '');
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => toggleMember(userId)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

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

      {/* Member Selection Dialog */}
      <Dialog open={showMemberPicker} onOpenChange={setShowMemberPicker}>
        <DialogContent className="sm:max-w-[400px] h-[80vh] max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Selecionar Membros</DialogTitle>
            <DialogDescription>
              {availableMembers.length} disponíveis, {blockedMembers.size} bloqueados
            </DialogDescription>
          </DialogHeader>
          
          {/* Native overflow scroll - more reliable than ScrollArea in nested dialogs */}
          <div className="flex-1 min-h-0 overflow-y-auto border rounded-md">
            <div className="p-2 space-y-1">
              {members.map((member) => {
                const isBlocked = blockedMembers.has(member.user_id);
                const conflictDept = crossDeptConflicts[member.user_id];
                const isDisabled = isBlocked || !!conflictDept;
                const isSelected = selectedMembers.includes(member.user_id);
                
                return (
                  <div
                    key={member.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-md transition-colors",
                      isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                      isSelected ? "bg-primary/10" : !isDisabled && "hover:bg-muted/50",
                    )}
                    onClick={() => !isDisabled && toggleMember(member.user_id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      className="pointer-events-none"
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
                        isDisabled && "text-destructive"
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
                    {conflictDept && (
                      <Badge variant="destructive" className="text-xs shrink-0">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Conflito: {conflictDept}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="flex justify-between pt-4 flex-shrink-0">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAllAvailable}>
                Selecionar Todos
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Limpar
              </Button>
            </div>
            <Button onClick={() => setShowMemberPicker(false)}>
              Confirmar ({selectedMembers.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Config Edit Dialog - opens when editing a specific member */}
      <Dialog 
        open={editingMemberId !== null} 
        onOpenChange={(open) => !open && setEditingMemberId(null)}
      >
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingMemberId && (() => {
                const member = getMemberById(editingMemberId);
                if (!member) return 'Editar Configuração';
                return (
                  <>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.profile.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {member.profile.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{member.profile.name}</span>
                  </>
                );
              })()}
            </DialogTitle>
            <DialogDescription>
              Configure o setor e função para este membro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Sector Select */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                Setor
              </Label>
              <Select 
                value={localSectorId || 'none'} 
                onValueChange={(v) => setLocalSectorId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar setor" />
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

            {/* Role Select */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <UserCog className="w-4 h-4 text-muted-foreground" />
                Função
              </Label>
              <Select 
                value={localRole || 'none'} 
                onValueChange={(v) => setLocalRole(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar função" />
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

            {/* Quick Apply Buttons */}
            <div className="border-t pt-4 space-y-2">
              <p className="text-xs text-muted-foreground">Ações rápidas:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Apply current sector to all selected members
                    selectedMembers.forEach(userId => {
                      updateMemberConfig(userId, 'sector_id', localSectorId);
                    });
                    toast({
                      title: 'Setor aplicado',
                      description: `Setor aplicado para ${selectedMembers.length} membro(s).`,
                    });
                  }}
                  disabled={!localSectorId}
                >
                  Aplicar Setor a Todos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Apply current role to all selected members
                    selectedMembers.forEach(userId => {
                      updateMemberConfig(userId, 'assignment_role', localRole);
                    });
                    toast({
                      title: 'Função aplicada',
                      description: `Função aplicada para ${selectedMembers.length} membro(s).`,
                    });
                  }}
                  disabled={!localRole}
                >
                  Aplicar Função a Todos
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingMemberId(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (editingMemberId) {
                  updateMemberConfig(editingMemberId, 'sector_id', localSectorId);
                  updateMemberConfig(editingMemberId, 'assignment_role', localRole);
                  setEditingMemberId(null);
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
