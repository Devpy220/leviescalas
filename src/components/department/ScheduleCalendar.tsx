import { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Clock,
  Trash2,
  Users
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showDayDialog, setShowDayDialog] = useState(false);
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

  // Color palette for multiple schedules on the same day - using inline styles for reliability
  const scheduleColors = [
    { bg: '#8B5CF6', dot: '#8B5CF6', text: 'text-primary', border: 'border-primary/30' },
    { bg: '#10B981', dot: '#10B981', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
    { bg: '#F59E0B', dot: '#F59E0B', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
    { bg: '#F43F5E', dot: '#F43F5E', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30' },
    { bg: '#06B6D4', dot: '#06B6D4', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/30' },
    { bg: '#7C3AED', dot: '#7C3AED', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/30' },
  ];

  const getScheduleColor = (index: number) => scheduleColors[index % scheduleColors.length];

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

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
      
      // Update the day dialog if still open
      const dateKey = selectedSchedule.date;
      const remainingSchedules = (schedulesByDate.get(dateKey) || []).filter(s => s.id !== selectedSchedule.id);
      if (remainingSchedules.length === 0) {
        setShowDayDialog(false);
      }
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

  const handleDayClick = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const daySchedules = schedulesByDate.get(dateKey) || [];
    
    if (daySchedules.length > 0 || isLeader) {
      setSelectedDay(day);
      setShowDayDialog(true);
    }
  };

  const selectedDaySchedules = useMemo(() => {
    if (!selectedDay) return [];
    const dateKey = format(selectedDay, 'yyyy-MM-dd');
    return schedulesByDate.get(dateKey) || [];
  }, [selectedDay, schedulesByDate]);

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground capitalize">
          {format(currentMonth, 'MMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setCurrentMonth(new Date())}
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Compact Calendar Grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Week Days Header */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((day, i) => (
            <div
              key={i}
              className="py-2 text-center text-xs font-medium text-muted-foreground"
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
            const hasSchedules = daySchedules.length > 0;

            return (
              <button
                key={index}
                onClick={() => handleDayClick(day)}
                className={`relative h-10 border-b border-r border-border transition-colors ${
                  !isCurrentMonth ? 'bg-muted/20 text-muted-foreground/40' : 'bg-card hover:bg-muted/30'
                } ${index % 7 === 6 ? 'border-r-0' : ''} ${
                  Math.floor(index / 7) === Math.floor((calendarDays.length - 1) / 7) ? 'border-b-0' : ''
                }`}
              >
                <span
                  className={`text-xs font-medium flex items-center justify-center w-6 h-6 mx-auto rounded-full ${
                    isCurrentDay
                      ? 'bg-primary text-primary-foreground'
                      : ''
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {hasSchedules && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {daySchedules.slice(0, 4).map((_, i) => (
                      <div 
                        key={i} 
                        className="w-1.5 h-1.5 rounded-full" 
                        style={{ backgroundColor: getScheduleColor(i).dot }}
                      />
                    ))}
                    {daySchedules.length > 4 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="font-medium">Escalas:</span>
        {scheduleColors.slice(0, 4).map((color, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: color.dot }}
            />
            <span>Pessoa {i + 1}</span>
          </div>
        ))}
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {selectedDay && format(selectedDay, "d 'de' MMMM", { locale: ptBR })}
            </DialogTitle>
            <DialogDescription>
              Gerencie as escalas deste dia
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedDaySchedules.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Escalados neste dia:</p>
                {selectedDaySchedules.map((schedule, index) => {
                  const color = getScheduleColor(index);
                  return (
                    <div
                      key={schedule.id}
                      className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 border-l-4 ${color.border} border border-border`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback 
                            className="text-xs text-white"
                            style={{ backgroundColor: color.bg }}
                          >
                            {schedule.profile?.name?.charAt(0) || 'M'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{schedule.profile?.name || 'Membro'}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{schedule.time_start.slice(0, 5)} - {schedule.time_end.slice(0, 5)}</span>
                          </div>
                        </div>
                      </div>
                      {isLeader && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setSelectedSchedule(schedule);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma escala neste dia
              </p>
            )}

            {isLeader && (
              <Button
                className="w-full"
                onClick={() => {
                  setShowDayDialog(false);
                  onAddSchedule(selectedDay || undefined);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar pessoa à escala
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da Escala</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover{' '}
              <strong>{selectedSchedule?.profile?.name}</strong> da escala do dia{' '}
              <strong>
                {selectedSchedule && format(parseISO(selectedSchedule.date), "d 'de' MMMM", { locale: ptBR })}
              </strong>
              ?
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
