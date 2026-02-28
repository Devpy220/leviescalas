import { useState, useEffect, useMemo } from 'react';
import { format, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, User, Pencil, AlertTriangle } from 'lucide-react';
import { SIMPLE_SLOTS, getAvailableSlotsForDay, normalizeTime } from '@/lib/fixedSlots';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
interface Schedule {
  id: string;
  user_id: string;
  date: string;
  time_start: string;
  time_end: string;
  notes: string | null;
  sector_id: string | null;
  assignment_role?: string | null;
  profile?: {
    name: string;
    avatar_url: string | null;
  };
}

interface Member {
  id: string;
  user_id: string;
  role: 'leader' | 'member';
  profile: {
    name: string;
    avatar_url: string | null;
  };
}

interface EditScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Schedule | null;
  members: Member[];
  departmentId: string;
  onScheduleUpdated: () => void;
}

export default function EditScheduleDialog({
  open,
  onOpenChange,
  schedule,
  members,
  departmentId,
  onScheduleUpdated,
}: EditScheduleDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({});
  const [blackoutMap, setBlackoutMap] = useState<Record<string, string[]>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Fetch availability for all members in this department
  useEffect(() => {
    if (!open || !departmentId) return;
    
    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      try {
        const [availRes, prefsRes, dateAvailRes] = await Promise.all([
          supabase
            .from('member_availability')
            .select('user_id, day_of_week, time_start, time_end, is_available')
            .eq('department_id', departmentId)
            .eq('is_available', true),
          supabase
            .from('member_preferences')
            .select('user_id, blackout_dates')
            .eq('department_id', departmentId),
          supabase
            .from('member_date_availability')
            .select('user_id, date, is_available')
            .eq('department_id', departmentId)
            .eq('is_available', false),
        ]);

        // Build availability map: "userId-dayOfWeek-timeStart" -> true
        const aMap: Record<string, boolean> = {};
        if (availRes.data) {
          for (const row of availRes.data) {
            const key = `${row.user_id}-${row.day_of_week}-${normalizeTime(row.time_start)}`;
            aMap[key] = true;
          }
        }
        setAvailabilityMap(aMap);

        // Build blackout map: userId -> [date strings]
        const bMap: Record<string, string[]> = {};
        if (prefsRes.data) {
          for (const row of prefsRes.data) {
            if (row.blackout_dates?.length) {
              bMap[row.user_id] = row.blackout_dates;
            }
          }
        }
        // Also add date-specific unavailability
        if (dateAvailRes.data) {
          for (const row of dateAvailRes.data) {
            if (!bMap[row.user_id]) bMap[row.user_id] = [];
            bMap[row.user_id].push(row.date);
          }
        }
        setBlackoutMap(bMap);
      } catch (err) {
        console.error('Error fetching availability:', err);
      } finally {
        setLoadingAvailability(false);
      }
    };

    fetchAvailability();
  }, [open, departmentId]);

  // Initialize form when schedule changes
  useEffect(() => {
    if (schedule && open) {
      setSelectedDate(new Date(schedule.date + 'T12:00:00'));
      setTimeStart(schedule.time_start.slice(0, 5));
      setTimeEnd(schedule.time_end.slice(0, 5));
      setSelectedMemberId(schedule.user_id);
    }
  }, [schedule, open]);

  // Get available slots for the selected day
  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    return getAvailableSlotsForDay(getDay(selectedDate));
  }, [selectedDate]);

  // Check if a member is available for the selected day/time
  const isMemberAvailable = (userId: string): boolean => {
    if (!selectedDate || !timeStart) return true; // no filter if no date/time selected
    const dayOfWeek = getDay(selectedDate);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Check blackout dates
    if (blackoutMap[userId]?.includes(dateStr)) return false;
    
    // Member must have explicitly marked this slot as available
    const key = `${userId}-${dayOfWeek}-${normalizeTime(timeStart)}`;
    return !!availabilityMap[key];
  };

  const availableMembers = useMemo(() => {
    return members.filter(m => isMemberAvailable(m.user_id));
  }, [members, selectedDate, timeStart, availabilityMap, blackoutMap]);

  const unavailableMembers = useMemo(() => {
    return members.filter(m => !isMemberAvailable(m.user_id));
  }, [members, selectedDate, timeStart, availabilityMap, blackoutMap]);

  const handleSlotSelect = (slotLabel: string) => {
    const slot = availableSlots.find(s => s.label === slotLabel);
    if (slot) {
      setTimeStart(slot.timeStart);
      setTimeEnd(slot.timeEnd);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setShowCalendar(false);
      // Auto-select first available slot for the new day
      const slots = getAvailableSlotsForDay(getDay(date));
      if (slots.length > 0) {
        setTimeStart(slots[0].timeStart);
        setTimeEnd(slots[0].timeEnd);
      }
    }
  };

  const handleSave = async () => {
    if (!schedule || !selectedDate || !timeStart || !timeEnd || !selectedMemberId) return;

    setSaving(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const { error } = await supabase
        .from('schedules')
        .update({
          date: dateStr,
          time_start: timeStart,
          time_end: timeEnd,
          user_id: selectedMemberId,
        })
        .eq('id', schedule.id);

      if (error) throw error;

      toast({
        title: 'Escala atualizada',
        description: 'As alterações foram salvas com sucesso.',
      });

      onScheduleUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating schedule:', error);
      const isConflict = error?.message?.includes('Conflito') || error?.message?.includes('já escalado');
      toast({
        variant: 'destructive',
        title: isConflict ? 'Conflito de horário' : 'Erro ao atualizar',
        description: isConflict ? error.message : 'Não foi possível salvar as alterações.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Find the current slot label
  const currentSlotLabel = useMemo(() => {
    const slot = availableSlots.find(s => s.timeStart === timeStart && s.timeEnd === timeEnd);
    return slot?.label || 'Horário personalizado';
  }, [availableSlots, timeStart, timeEnd]);

  if (!schedule) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            Editar Escala
          </DialogTitle>
          <DialogDescription>
            Altere a data, horário ou membro desta escala.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Data</Label>
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate
                    ? format(selectedDate, "d 'de' MMMM, yyyy", { locale: ptBR })
                    : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Slot */}
          <div className="space-y-2">
            <Label>Horário</Label>
            {availableSlots.length > 0 ? (
              <Select value={currentSlotLabel} onValueChange={handleSlotSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar horário" />
                </SelectTrigger>
                <SelectContent>
                  {availableSlots.map(slot => (
                    <SelectItem key={slot.label} value={slot.label}>
                      {slot.label} ({slot.timeStart} - {slot.timeEnd})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Início</Label>
                  <Input
                    type="time"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fim</Label>
                  <Input
                    type="time"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{timeStart} - {timeEnd}</span>
            </div>
          </div>

          {/* Member Select */}
          <div className="space-y-2">
            <Label>Membro</Label>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar membro" />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="max-h-[200px]">
                  {availableMembers.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Disponíveis ({availableMembers.length})
                      </div>
                      {availableMembers.map(member => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {member.profile.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.profile.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {unavailableMembers.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" />
                        Indisponíveis ({unavailableMembers.length})
                      </div>
                      {unavailableMembers.map(member => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          <div className="flex items-center gap-2 opacity-50">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[10px] bg-destructive/10 text-destructive">
                                {member.profile.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.profile.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {availableMembers.length === 0 && unavailableMembers.length === 0 && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      Nenhum membro encontrado
                    </div>
                  )}
                </ScrollArea>
              </SelectContent>
            </Select>
            {selectedMemberId && !isMemberAvailable(selectedMemberId) && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="w-3 h-3" />
                <span>Este membro está indisponível para este dia/horário</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !selectedDate || !timeStart || !timeEnd || !selectedMemberId}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
