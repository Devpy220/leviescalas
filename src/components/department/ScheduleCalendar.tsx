import { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Clock,
  User,
  Trash2,
  GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Schedule {
  id: string;
  user_id: string;
  date: string;
  time_start: string;
  time_end: string;
  notes: string | null;
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
    email: string;
    whatsapp: string;
    avatar_url: string | null;
  };
}

interface ScheduleCalendarProps {
  schedules: Schedule[];
  members: Member[];
  isLeader: boolean;
  departmentId: string;
  onAddSchedule: (date?: Date) => void;
  onDeleteSchedule: () => void;
}

export default function ScheduleCalendar({ 
  schedules, 
  members,
  isLeader, 
  departmentId,
  onAddSchedule,
  onDeleteSchedule 
}: ScheduleCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    schedules.forEach(schedule => {
      const dateKey = schedule.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(schedule);
    });
    return map;
  }, [schedules]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { locale: ptBR });
    const endDate = endOfWeek(monthEnd, { locale: ptBR });

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const handleDeleteSchedule = async () => {
    if (!selectedSchedule) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', selectedSchedule.id);

      if (error) throw error;

      toast({
        title: 'Escala removida',
        description: 'A escala foi removida com sucesso.',
      });
      
      onDeleteSchedule();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao remover',
        description: 'Não foi possível remover a escala.',
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
      setSelectedSchedule(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, schedule: Schedule) => {
    e.dataTransfer.setData('scheduleId', schedule.id);
    e.dataTransfer.setData('scheduleDate', schedule.date);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    const scheduleId = e.dataTransfer.getData('scheduleId');
    const originalDate = e.dataTransfer.getData('scheduleDate');
    const newDate = format(targetDate, 'yyyy-MM-dd');

    if (originalDate === newDate || !isLeader) return;

    // Find the schedule being moved
    const movedSchedule = schedules.find(s => s.id === scheduleId);
    if (!movedSchedule) return;

    try {
      const { error } = await supabase
        .from('schedules')
        .update({ date: newDate })
        .eq('id', scheduleId);

      if (error) throw error;

      // Get department info for notification
      const { data: department } = await supabase
        .from('departments')
        .select('name')
        .eq('id', departmentId)
        .single();

      // Send notification about schedule change
      try {
        await supabase.functions.invoke('send-schedule-notification', {
          body: {
            schedule_id: scheduleId,
            user_id: movedSchedule.user_id,
            department_id: departmentId,
            department_name: department?.name || 'Departamento',
            date: newDate,
            time_start: movedSchedule.time_start,
            time_end: movedSchedule.time_end,
            type: 'schedule_moved',
            old_date: originalDate
          }
        });
      } catch (notifError) {
        console.error('Error sending move notification:', notifError);
      }

      toast({
        title: 'Escala movida',
        description: `Escala movida e membro notificado!`,
      });
      
      onDeleteSchedule(); // Refresh schedules
    } catch (error) {
      console.error('Error moving schedule:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao mover',
        description: 'Não foi possível mover a escala.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-foreground capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Week Days Header */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((day) => (
            <div
              key={day}
              className="px-2 py-3 text-center text-sm font-medium text-muted-foreground bg-muted/30"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const daySchedules = schedulesByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={index}
                className={`min-h-[120px] border-b border-r border-border p-2 transition-colors ${
                  !isCurrentMonth ? 'bg-muted/20' : 'bg-card hover:bg-muted/10'
                } ${index % 7 === 6 ? 'border-r-0' : ''}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                      isCurrentDay
                        ? 'bg-primary text-primary-foreground'
                        : isCurrentMonth
                        ? 'text-foreground'
                        : 'text-muted-foreground/50'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {isLeader && isCurrentMonth && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                      onClick={() => onAddSchedule(day)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  {daySchedules.slice(0, 3).map((schedule) => (
                    <div
                      key={schedule.id}
                      draggable={isLeader}
                      onDragStart={(e) => handleDragStart(e, schedule)}
                      className={`group relative px-2 py-1 rounded-md text-xs bg-primary/10 border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors ${
                        isLeader ? 'cursor-grab active:cursor-grabbing' : ''
                      }`}
                      onClick={() => {
                        setSelectedSchedule(schedule);
                        if (isLeader) setShowDeleteDialog(true);
                      }}
                    >
                      <div className="flex items-center gap-1">
                        {isLeader && (
                          <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        )}
                        <span className="font-medium text-primary truncate">
                          {schedule.profile?.name?.split(' ')[0] || 'Membro'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{schedule.time_start.slice(0, 5)}</span>
                      </div>
                    </div>
                  ))}
                  {daySchedules.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-2">
                      +{daySchedules.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span>Escala agendada</span>
        </div>
        {isLeader && (
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4" />
            <span>Arraste para mover</span>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Escala</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta escala de{' '}
              <strong>{selectedSchedule?.profile?.name}</strong> no dia{' '}
              <strong>
                {selectedSchedule && format(parseISO(selectedSchedule.date), "d 'de' MMMM", { locale: ptBR })}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSchedule}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
