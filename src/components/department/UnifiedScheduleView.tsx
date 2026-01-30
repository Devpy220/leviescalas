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
  HelpCircle,
  Sparkles,
  Calendar as CalendarIcon,
  CalendarPlus
} from 'lucide-react';
import { ASSIGNMENT_ROLES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { createExtendedMemberColorMap, getMemberColor, getMemberBackgroundStyle } from '@/lib/memberColors';
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  parseISO,
  getDay,
  isSameMonth,
  eachDayOfInterval,
  isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ConfirmationStatus = 'pending' | 'confirmed' | 'declined';

// Fixed slots for scheduling with soft/light colors
const FIXED_SLOTS = [
  { 
    dayOfWeek: 0, 
    timeStart: '09:00', 
    timeEnd: '12:00', 
    label: 'Domingo manhã', 
    shortLabel: 'DOM-M',
    bgColor: 'bg-cyan-100/80 dark:bg-cyan-900/30',
    textColor: 'text-cyan-700 dark:text-cyan-300'
  },
  { 
    dayOfWeek: 0, 
    timeStart: '18:00', 
    timeEnd: '22:00', 
    label: 'Domingo noite', 
    shortLabel: 'DOM-N',
    bgColor: 'bg-rose-100/80 dark:bg-rose-900/30',
    textColor: 'text-rose-700 dark:text-rose-300'
  },
  { 
    dayOfWeek: 1, 
    timeStart: '19:20', 
    timeEnd: '22:00', 
    label: 'Segunda à noite', 
    shortLabel: 'SEG',
    bgColor: 'bg-amber-100/80 dark:bg-amber-900/30',
    textColor: 'text-amber-700 dark:text-amber-300'
  },
  { 
    dayOfWeek: 3, 
    timeStart: '19:20', 
    timeEnd: '22:00', 
    label: 'Quarta à noite', 
    shortLabel: 'QUA',
    bgColor: 'bg-violet-100/80 dark:bg-violet-900/30',
    textColor: 'text-violet-700 dark:text-violet-300'
  },
  { 
    dayOfWeek: 5, 
    timeStart: '19:20', 
    timeEnd: '22:00', 
    label: 'Sexta à noite', 
    shortLabel: 'SEX',
    bgColor: 'bg-pink-100/80 dark:bg-pink-900/30',
    textColor: 'text-pink-700 dark:text-pink-300'
  },
  { 
    dayOfWeek: 2, 
    timeStart: '19:20', 
    timeEnd: '22:00', 
    label: 'Terça à noite', 
    shortLabel: 'TER',
    bgColor: 'bg-emerald-100/80 dark:bg-emerald-900/30',
    textColor: 'text-emerald-700 dark:text-emerald-300'
  },
  { 
    dayOfWeek: 4, 
    timeStart: '19:20', 
    timeEnd: '22:00', 
    label: 'Quinta à noite', 
    shortLabel: 'QUI',
    bgColor: 'bg-blue-100/80 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300'
  },
  { 
    dayOfWeek: 6, 
    timeStart: '19:00', 
    timeEnd: '22:00', 
    label: 'Sábado à noite', 
    shortLabel: 'SAB',
    bgColor: 'bg-orange-100/80 dark:bg-orange-900/30',
    textColor: 'text-orange-700 dark:text-orange-300'
  },
];

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
  assignment_role?: string | null;
  profile?: {
    name: string;
    avatar_url: string | null;
  };
  sector?: {
    name: string;
    color: string;
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

interface UnifiedScheduleViewProps {
  schedules: Schedule[];
  members: Member[];
  isLeader: boolean;
  departmentId: string;
  onAddSchedule: (date?: Date) => void;
  onDeleteSchedule: () => void;
  onOpenSmartSchedule: () => void;
}

export default function UnifiedScheduleView({ 
  schedules, 
  members,
  isLeader, 
  departmentId,
  onAddSchedule,
  onDeleteSchedule,
  onOpenSmartSchedule
}: UnifiedScheduleViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const { toast } = useToast();

  // Group schedules by date
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

  // Get all days in current month that have schedules, sorted
  const daysWithSchedules = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    const days: { date: Date; schedules: Schedule[] }[] = [];
    
    schedulesByDate.forEach((daySchedules, dateKey) => {
      const date = parseISO(dateKey);
      if (isSameMonth(date, currentMonth)) {
        // Sort schedules by time
        const sortedSchedules = [...daySchedules].sort((a, b) => 
          a.time_start.localeCompare(b.time_start)
        );
        days.push({ date, schedules: sortedSchedules });
      }
    });
    
    // Sort by date
    days.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return days;
  }, [schedulesByDate, currentMonth]);

  // Create extended color map
  const memberColorMap = useMemo(() => createExtendedMemberColorMap(members), [members]);
  const getMemberColorValue = (userId: string) => getMemberColor(memberColorMap, userId);
  const getMemberBgStyle = (userId: string): React.CSSProperties => {
    return getMemberBackgroundStyle(memberColorMap, userId);
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

  // Get slot info for a schedule
  const getSlotInfo = (schedule: Schedule) => {
    const date = parseISO(schedule.date);
    const dayOfWeek = getDay(date);
    
    // Find matching slot
    const slot = FIXED_SLOTS.find(s => 
      s.dayOfWeek === dayOfWeek && 
      s.timeStart === schedule.time_start
    );
    
    return slot;
  };

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

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setShowCalendarPicker(false);
      onAddSchedule(date);
    }
  };

  // Get month's schedule summary
  const monthScheduleSummary = useMemo(() => {
    let totalScheduled = 0;
    let daysCount = 0;
    
    daysWithSchedules.forEach(day => {
      daysCount++;
      totalScheduled += day.schedules.length;
    });
    
    return { totalScheduled, daysCount };
  }, [daysWithSchedules]);

  return (
    <div className="space-y-4">
      {/* Header with month navigation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 capitalize">
                <CalendarIcon className="w-5 h-5" />
                Escalas de {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardTitle>
              <CardDescription>
                {monthScheduleSummary.daysCount} dias com escalas • {monthScheduleSummary.totalScheduled} pessoas escaladas
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                Hoje
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Leader actions */}
      {isLeader && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={onOpenSmartSchedule}
                className="flex-1 gap-2"
                variant="default"
              >
                <Sparkles className="w-4 h-4" />
                Gerar Escalas com IA
              </Button>
              
              {/* Calendar picker for manual schedule */}
              <Popover open={showCalendarPicker} onOpenChange={setShowCalendarPicker}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    Adicionar Escala Manual
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={undefined}
                    onSelect={handleDateSelect}
                    initialFocus
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedules Table by Day */}
      {daysWithSchedules.length > 0 ? (
        <div className="space-y-4">
          {daysWithSchedules.map(({ date, schedules: daySchedules }) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const isCurrentDay = isToday(date);
            const dayOfWeek = getDay(date);
            
            // Get slot info for styling
            const firstSlot = FIXED_SLOTS.find(s => s.dayOfWeek === dayOfWeek);
            
            // Group schedules by time slot (morning vs night for Sunday)
            const morningSchedules = daySchedules.filter(s => s.time_start < '12:00');
            const nightSchedules = daySchedules.filter(s => s.time_start >= '12:00');
            
            return (
              <Card key={dateStr} className={cn(
                "overflow-hidden transition-all",
                isCurrentDay && "ring-2 ring-primary"
              )}>
                {/* Day Header */}
                <CardHeader className={cn(
                  "pb-2",
                  firstSlot?.bgColor || 'bg-muted/50'
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className={cn(
                        "text-lg capitalize",
                        firstSlot?.textColor
                      )}>
                        {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {daySchedules.length} {daySchedules.length === 1 ? 'pessoa escalada' : 'pessoas escaladas'}
                      </CardDescription>
                    </div>
                    {isLeader && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onAddSchedule(date)}
                        className="gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Adicionar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="pt-4">
                  {/* If Sunday with both morning and night schedules */}
                  {dayOfWeek === 0 && morningSchedules.length > 0 && nightSchedules.length > 0 ? (
                    <div className="space-y-4">
                      {/* Morning section */}
                      <div>
                        <h4 className="text-sm font-medium text-cyan-700 dark:text-cyan-300 mb-2 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-cyan-500" />
                          Manhã (09:00 - 12:00)
                        </h4>
                        <ScheduleList 
                          schedules={morningSchedules}
                          isLeader={isLeader}
                          getMemberColorValue={getMemberColorValue}
                          getMemberBgStyle={getMemberBgStyle}
                          getConfirmationIcon={getConfirmationIcon}
                          getConfirmationText={getConfirmationText}
                          onDelete={(schedule) => {
                            setSelectedSchedule(schedule);
                            setShowDeleteDialog(true);
                          }}
                        />
                      </div>
                      
                      {/* Night section */}
                      <div>
                        <h4 className="text-sm font-medium text-rose-700 dark:text-rose-300 mb-2 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-500" />
                          Noite (18:00 - 22:00)
                        </h4>
                        <ScheduleList 
                          schedules={nightSchedules}
                          isLeader={isLeader}
                          getMemberColorValue={getMemberColorValue}
                          getMemberBgStyle={getMemberBgStyle}
                          getConfirmationIcon={getConfirmationIcon}
                          getConfirmationText={getConfirmationText}
                          onDelete={(schedule) => {
                            setSelectedSchedule(schedule);
                            setShowDeleteDialog(true);
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Regular day - single list */
                    <ScheduleList 
                      schedules={daySchedules}
                      isLeader={isLeader}
                      getMemberColorValue={getMemberColorValue}
                      getMemberBgStyle={getMemberBgStyle}
                      getConfirmationIcon={getConfirmationIcon}
                      getConfirmationText={getConfirmationText}
                      onDelete={(schedule) => {
                        setSelectedSchedule(schedule);
                        setShowDeleteDialog(true);
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-2">
              Nenhuma escala para {format(currentMonth, 'MMMM', { locale: ptBR })}
            </p>
            {isLeader && (
              <p className="text-sm text-muted-foreground">
                Clique em "Adicionar Escala Manual" para começar a criar escalas
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Members legend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            Membros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => {
              const color = getMemberColorValue(member.user_id);
              return (
                <div key={member.user_id} className="flex items-center gap-1.5 text-xs">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: color.dot }}
                  />
                  <span className="text-muted-foreground">{member.profile.name}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSchedule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Schedule list component
interface ScheduleListProps {
  schedules: Schedule[];
  isLeader: boolean;
  getMemberColorValue: (userId: string) => { bg: string; dot: string };
  getMemberBgStyle: (userId: string) => React.CSSProperties;
  getConfirmationIcon: (status?: ConfirmationStatus) => React.ReactNode;
  getConfirmationText: (status?: ConfirmationStatus, declineReason?: string | null) => string;
  onDelete: (schedule: Schedule) => void;
}

function ScheduleList({
  schedules,
  isLeader,
  getMemberColorValue,
  getMemberBgStyle,
  getConfirmationIcon,
  getConfirmationText,
  onDelete
}: ScheduleListProps) {
  return (
    <div className="space-y-2">
      {schedules.map((schedule) => {
        const color = getMemberColorValue(schedule.user_id);
        const statusBg = schedule.confirmation_status === 'confirmed'
          ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
          : schedule.confirmation_status === 'declined'
          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
          : 'bg-muted/50 border-border';
          
        return (
          <div
            key={schedule.id}
            className={`flex items-center justify-between p-3 rounded-lg border-l-4 border ${statusBg}`}
            style={{ borderLeftColor: schedule.sector?.color || color.bg }}
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback 
                  className="text-sm text-white font-medium"
                  style={getMemberBgStyle(schedule.user_id)}
                >
                  {schedule.profile?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'M'}
                </AvatarFallback>
              </Avatar>
              
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{schedule.profile?.name || 'Membro'}</p>
                  
                  {/* Assignment role icon */}
                  {schedule.assignment_role && ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES] && (
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="text-base">
                          {ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].icon}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].label}</p>
                        <p className="text-xs text-muted-foreground">
                          {ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].description}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {/* Confirmation status */}
                  <Tooltip>
                    <TooltipTrigger>
                      {getConfirmationIcon(schedule.confirmation_status)}
                    </TooltipTrigger>
                    <TooltipContent>
                      {getConfirmationText(schedule.confirmation_status, schedule.decline_reason)}
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {/* Time */}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {schedule.time_start?.slice(0, 5)} - {schedule.time_end?.slice(0, 5)}
                  </span>
                  
                  {/* Sector */}
                  {schedule.sector && (
                    <span className="flex items-center gap-1">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: schedule.sector.color }}
                      />
                      {schedule.sector.name}
                    </span>
                  )}
                  
                  {/* Assignment role text */}
                  {schedule.assignment_role && ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES] && (
                    <Badge variant="outline" className={cn(
                      "text-[10px] px-1.5 py-0",
                      ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].color
                    )}>
                      {ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].label}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {isLeader && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(schedule)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
