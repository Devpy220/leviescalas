import { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Clock,
  Trash2,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

type ConfirmationStatus = 'pending' | 'confirmed' | 'declined';

interface Schedule {
  id: string;
  user_id: string;
  date: string;
  time_start: string;
  time_end: string;
  notes: string | null;
  sector_id: string | null;
  confirmation_status?: ConfirmationStatus;
  decline_reason?: string | null;
  profile?: {
    name: string;
    avatar_url: string | null;
  };
  sector?: {
    name: string;
  } | null;
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
  fixedMonth?: Date;
  title?: string;
  compact?: boolean;
}

export default function ScheduleCalendar({ 
  schedules, 
  members,
  isLeader, 
  departmentId,
  onAddSchedule,
  onDeleteSchedule,
  fixedMonth,
  title,
  compact = false
}: ScheduleCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(fixedMonth || new Date());
  const isNavigationEnabled = !fixedMonth;
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

  // Color palette for members - vibrant colors
  const memberColors = [
    { bg: '#6366F1', dot: '#6366F1', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/50', name: 'Índigo' },
    { bg: '#22C55E', dot: '#22C55E', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/50', name: 'Verde' },
    { bg: '#F97316', dot: '#F97316', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/50', name: 'Laranja' },
    { bg: '#EC4899', dot: '#EC4899', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/50', name: 'Rosa' },
    { bg: '#14B8A6', dot: '#14B8A6', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/50', name: 'Turquesa' },
    { bg: '#A855F7', dot: '#A855F7', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/50', name: 'Roxo' },
    { bg: '#EF4444', dot: '#EF4444', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/50', name: 'Vermelho' },
    { bg: '#3B82F6', dot: '#3B82F6', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/50', name: 'Azul' },
    { bg: '#FACC15', dot: '#FACC15', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500/50', name: 'Amarelo' },
    { bg: '#06B6D4', dot: '#06B6D4', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/50', name: 'Ciano' },
  ];

  // Create a map of member user_id to color index (consistent within department)
  const memberColorMap = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((member, index) => {
      map.set(member.user_id, index % memberColors.length);
    });
    return map;
  }, [members]);

  // Get color for a specific member by user_id
  const getMemberColor = (userId: string) => {
    const colorIndex = memberColorMap.get(userId) ?? 0;
    return memberColors[colorIndex];
  };

  const getConfirmationIcon = (status?: ConfirmationStatus) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 className="w-3 h-3 text-green-500" />;
      case 'declined':
        return <XCircle className="w-3 h-3 text-red-500" />;
      default:
        return <HelpCircle className="w-3 h-3 text-amber-500" />;
    }
  };

  const getConfirmationText = (status?: ConfirmationStatus, declineReason?: string | null) => {
    switch (status) {
      case 'confirmed':
        return 'Presença confirmada';
      case 'declined':
        return `Não poderá comparecer${declineReason ? `: ${declineReason}` : ''}`;
      default:
        return 'Aguardando confirmação';
    }
  };

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
    <div className="space-y-1">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h2 className={`font-display font-bold text-foreground capitalize ${compact ? 'text-xs' : 'text-sm'}`}>
          {title || format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        {isNavigationEnabled && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[9px] px-1"
              onClick={() => setCurrentMonth(new Date())}
            >
              Hoje
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
      <div className="bg-card border-[3px] border-primary rounded-lg overflow-hidden">
        {/* Week Days Header */}
        <div className="grid grid-cols-7 border-b border-border bg-primary">
          {weekDays.map((day, i) => (
            <div
              key={i}
              className={`text-center font-medium text-white ${compact ? 'py-0.5 text-[8px]' : 'py-1 text-[10px]'}`}
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
                className={`relative border-b border-r border-border transition-colors overflow-hidden ${
                  compact ? 'h-6' : 'h-8'
                } ${
                  !isCurrentMonth ? 'bg-muted/20 text-muted-foreground/40' : 'bg-card hover:bg-muted/30'
                } ${index % 7 === 6 ? 'border-r-0' : ''} ${
                  Math.floor(index / 7) === Math.floor((calendarDays.length - 1) / 7) ? 'border-b-0' : ''
                }`}
              >
                {/* Background color strips for schedules based on member color */}
                {hasSchedules && (
                  <div className="absolute inset-0 flex">
                    {daySchedules.map((schedule, i) => (
                      <div 
                        key={i} 
                        className="h-full opacity-50"
                        style={{ 
                          backgroundColor: getMemberColor(schedule.user_id).bg,
                          width: `${100 / daySchedules.length}%`
                        }}
                      />
                    ))}
                  </div>
                )}
                {/* Day number */}
                <span
                  className={`relative z-10 font-medium flex items-center justify-center mx-auto rounded-full ${
                    compact ? 'text-[8px] w-4 h-4 mt-0.5' : 'text-[10px] w-5 h-5 mt-0.5'
                  } ${
                    isCurrentDay
                      ? 'bg-primary text-primary-foreground'
                      : hasSchedules ? 'text-foreground font-semibold' : ''
                  }`}
                >
                  {format(day, 'd')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend - Hide in compact mode */}
      {!compact && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
          {members.slice(0, 4).map((member) => {
            const color = getMemberColor(member.user_id);
            return (
              <div key={member.user_id} className="flex items-center gap-1">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: color.dot }}
                />
                <span className="truncate max-w-[50px]">{member.profile.name.split(' ')[0]}</span>
              </div>
            );
          })}
          {members.length > 4 && (
            <span className="text-muted-foreground">+{members.length - 4}</span>
          )}
        </div>
      )}

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
                {selectedDaySchedules.map((schedule) => {
                  const color = getMemberColor(schedule.user_id);
                  const statusBg = schedule.confirmation_status === 'confirmed' 
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                    : schedule.confirmation_status === 'declined'
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                    : 'bg-muted/50';
                  return (
                    <div
                      key={schedule.id}
                      className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${color.border} border ${statusBg}`}
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
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{schedule.profile?.name || 'Membro'}</p>
                            <Tooltip>
                              <TooltipTrigger>
                                {getConfirmationIcon(schedule.confirmation_status)}
                              </TooltipTrigger>
                              <TooltipContent>
                                {getConfirmationText(schedule.confirmation_status, schedule.decline_reason)}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          {schedule.sector && (
                            <p className="text-xs text-primary font-medium">{schedule.sector.name}</p>
                          )}
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
