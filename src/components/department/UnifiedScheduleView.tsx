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
  Calendar as CalendarIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  parseISO,
  getDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ConfirmationStatus = 'pending' | 'confirmed' | 'declined';

// Fixed slots for scheduling with soft/light colors
const FIXED_SLOTS = [
  { 
    dayOfWeek: 3, 
    timeStart: '19:20', 
    timeEnd: '22:00', 
    label: 'Quarta à noite', 
    shortLabel: 'QUA',
    bgColor: 'bg-violet-100/80 dark:bg-violet-900/30',
    glow: 'shadow-violet-200/30 dark:shadow-violet-800/20',
    borderColor: 'border-violet-300 dark:border-violet-700/50'
  },
  { 
    dayOfWeek: 0, 
    timeStart: '09:00', 
    timeEnd: '12:00', 
    label: 'Domingo manhã', 
    shortLabel: 'DOM-M',
    bgColor: 'bg-cyan-100/80 dark:bg-cyan-900/30',
    glow: 'shadow-cyan-200/30 dark:shadow-cyan-800/20',
    borderColor: 'border-cyan-300 dark:border-cyan-700/50'
  },
  { 
    dayOfWeek: 0, 
    timeStart: '18:00', 
    timeEnd: '22:00', 
    label: 'Domingo noite', 
    shortLabel: 'DOM-N',
    bgColor: 'bg-rose-100/80 dark:bg-rose-900/30',
    glow: 'shadow-rose-200/30 dark:shadow-rose-800/20',
    borderColor: 'border-rose-300 dark:border-rose-700/50'
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
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [creatingSlot, setCreatingSlot] = useState(false);
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

  // Calendar days for current month
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

  // Calendar days for next month
  const nextMonth = addMonths(currentMonth, 1);
  const nextMonthCalendarDays = useMemo(() => {
    const monthStart = startOfMonth(nextMonth);
    const monthEnd = endOfMonth(nextMonth);
    const startDate = startOfWeek(monthStart, { locale: ptBR });
    const endDate = endOfWeek(monthEnd, { locale: ptBR });

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [nextMonth]);

  // Check if a day is a fixed slot day (Wednesday or Sunday)
  const isFixedSlotDay = (day: Date) => {
    const dayOfWeek = getDay(day);
    return FIXED_SLOTS.some(slot => slot.dayOfWeek === dayOfWeek);
  };

  // Get fixed slots for a specific day
  const getFixedSlotsForDay = (day: Date) => {
    const dayOfWeek = getDay(day);
    return FIXED_SLOTS.filter(slot => slot.dayOfWeek === dayOfWeek);
  };

  // Get subtle background color for each day of the week
  const getDayBackgroundColor = (day: Date) => {
    const dayOfWeek = getDay(day);
    const colors = [
      'bg-rose-50/50 dark:bg-rose-950/20',      // Sunday - 0
      'bg-amber-50/50 dark:bg-amber-950/20',     // Monday - 1
      'bg-emerald-50/50 dark:bg-emerald-950/20', // Tuesday - 2
      'bg-cyan-50/50 dark:bg-cyan-950/20',       // Wednesday - 3
      'bg-violet-50/50 dark:bg-violet-950/20',   // Thursday - 4
      'bg-pink-50/50 dark:bg-pink-950/20',       // Friday - 5
      'bg-blue-50/50 dark:bg-blue-950/20',       // Saturday - 6
    ];
    return colors[dayOfWeek];
  };

  // Get the slot styling for a day (for background)
  // For Sunday, returns both slots for split view
  const getDaySlotStyle = (day: Date) => {
    const slots = getFixedSlotsForDay(day);
    if (slots.length === 0) return null;
    
    // Check if it's Sunday (has 2 slots)
    const isSunday = slots.length === 2;
    
    if (isSunday) {
      return {
        isSplit: true,
        morningBgColor: slots[0].bgColor,
        nightBgColor: slots[1].bgColor,
        borderColor: 'border-white/30'
      };
    }
    
    // For Wednesday, single color
    const primarySlot = slots[0];
    return {
      isSplit: false,
      bgColor: primarySlot.bgColor,
      glow: primarySlot.glow,
      borderColor: primarySlot.borderColor
    };
  };

  // Color palette for members
  const memberColors = [
    { bg: '#6366F1', dot: '#6366F1', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/50', name: 'Índigo' },
    { bg: '#22C55E', dot: '#22C55E', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/50', name: 'Verde' },
    { bg: '#F97316', dot: '#F97316', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/50', name: 'Laranja' },
    { bg: '#EC4899', dot: '#EC4899', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/50', name: 'Rosa' },
    { bg: '#14B8A6', dot: '#14B8A6', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/50', name: 'Turquesa' },
    { bg: '#A855F7', dot: '#A855F7', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/50', name: 'Roxo' },
    { bg: '#EF4444', dot: '#EF4444', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/50', name: 'Vermelho' },
    { bg: '#3B82F6', dot: '#3B82F6', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/50', name: 'Azul' },
  ];

  const memberColorMap = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((member, index) => {
      map.set(member.user_id, index % memberColors.length);
    });
    return map;
  }, [members]);

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
      setShowDayDialog(false);
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

  // Create empty schedule slots for a specific day (without assigning members)
  const handleCreateEmptySlots = async (day: Date) => {
    if (!isLeader) return;
    
    setCreatingSlot(true);
    try {
      const dateStr = format(day, 'yyyy-MM-dd');
      const slots = getFixedSlotsForDay(day);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      // Create empty schedules for each slot (using the leader as a placeholder)
      for (const slot of slots) {
        // Check if slot already has schedules
        const existingSchedules = schedules.filter(s => 
          s.date === dateStr && 
          s.time_start === slot.timeStart
        );
        
        if (existingSchedules.length === 0) {
          // Create a "placeholder" schedule to mark the day as active
          // We'll skip this for now and just trigger the add dialog
        }
      }
      
      toast({
        title: 'Dia marcado',
        description: `Escalas para ${format(day, "d 'de' MMMM", { locale: ptBR })} estão prontas para adicionar membros.`,
      });
      
      // Open the add schedule dialog for this day
      onAddSchedule(day);
      setShowDayDialog(false);
    } catch (error) {
      console.error('Error creating slots:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível criar as escalas.',
      });
    } finally {
      setCreatingSlot(false);
    }
  };

  const handleDayClick = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const daySchedules = schedulesByDate.get(dateKey) || [];
    const isFixed = isFixedSlotDay(day);
    
    // Leaders can click any day, members can only click days with schedules or fixed days
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

  // Get month's schedule summary
  const monthScheduleSummary = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    let totalScheduled = 0;
    let fixedSlotDays = 0;
    let daysWithSchedules = 0;
    
    let day = monthStart;
    while (day <= monthEnd) {
      if (isFixedSlotDay(day)) {
        fixedSlotDays++;
        const dateKey = format(day, 'yyyy-MM-dd');
        const daySchedules = schedulesByDate.get(dateKey) || [];
        if (daySchedules.length > 0) {
          daysWithSchedules++;
          totalScheduled += daySchedules.length;
        }
      }
      day = addDays(day, 1);
    }
    
    return { totalScheduled, fixedSlotDays, daysWithSchedules };
  }, [currentMonth, schedulesByDate]);

  return (
    <div className="space-y-4">
      {/* Header with month navigation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Escalas de {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardTitle>
              <CardDescription>
                {monthScheduleSummary.daysWithSchedules} de {monthScheduleSummary.fixedSlotDays} dias com escalas • {monthScheduleSummary.totalScheduled} escalados
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
        <CardContent className="pt-0">
          {/* Fixed slots legend */}
          <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-violet-500 shadow-sm" />
              <span className="text-muted-foreground">Quarta</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-cyan-500 shadow-sm" />
              <span className="text-muted-foreground">Dom. manhã</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-red-500 shadow-sm" />
              <span className="text-muted-foreground">Dom. noite</span>
            </div>
          </div>

          {/* Current Month Calendar Grid */}
          <div className="bg-card border-2 border-primary rounded-lg overflow-hidden">
            {/* Week Days Header */}
            <div className="grid grid-cols-7 border-b border-border bg-primary">
              {weekDays.map((day, i) => (
                <div
                  key={i}
                  className="text-center font-medium text-white py-2 text-xs"
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
                const isCurrentMonthDay = isSameMonth(day, currentMonth);
                const isCurrentDay = isToday(day);
                const hasSchedules = daySchedules.length > 0;
                const isFixed = isFixedSlotDay(day);
                const fixedSlots = getFixedSlotsForDay(day);

                const slotStyle = getDaySlotStyle(day);

                return (
                  <button
                    key={index}
                    onClick={() => handleDayClick(day)}
                    disabled={!isCurrentMonthDay || (!isFixed && !hasSchedules && !isLeader)}
                    className={`relative border-r border-b transition-all duration-300 min-h-[60px] sm:min-h-[80px] p-1 overflow-hidden group ${
                      !isCurrentMonthDay 
                        ? 'bg-muted/20 text-muted-foreground/40 border-border' 
                        : isFixed 
                          ? `cursor-pointer hover:scale-[1.02] hover:z-10 border-2 ${slotStyle?.borderColor || 'border-border'}` 
                          : hasSchedules
                            ? 'bg-primary/10 cursor-pointer hover:bg-primary/20 border-primary/30'
                            : isLeader 
                              ? `cursor-pointer hover:bg-muted/50 border-border ${getDayBackgroundColor(day)}`
                              : `border-border ${getDayBackgroundColor(day)}`
                    } ${index % 7 === 6 ? 'border-r-0' : ''} ${
                      Math.floor(index / 7) === Math.floor((calendarDays.length - 1) / 7) ? 'border-b-0' : ''
                    }`}
                  >
                    {/* Background for fixed slot days */}
                    {isFixed && isCurrentMonthDay && slotStyle && (
                      <>
                        {slotStyle.isSplit ? (
                          /* Split background for Sunday - half morning, half night with divider */
                          <div className="absolute inset-0 flex overflow-hidden">
                            <div className={`w-1/2 ${slotStyle.morningBgColor} backdrop-blur-sm`} />
                            <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-white/40 z-10" />
                            <div className={`w-1/2 ${slotStyle.nightBgColor} backdrop-blur-sm`} />
                          </div>
                        ) : (
                          /* Solid background for Wednesday */
                          <div className={`absolute inset-0 ${slotStyle.bgColor} backdrop-blur-sm`} />
                        )}
                        <div 
                          className={`absolute inset-0 shadow-lg ${slotStyle.glow || ''} group-hover:opacity-100 opacity-80 transition-opacity`}
                        />
                      </>
                    )}

                    {/* Content wrapper */}
                    <div className="relative z-10">
                      {/* Day number */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-bold flex items-center justify-center w-5 h-5 rounded-full ${
                            isCurrentDay
                              ? 'bg-primary text-primary-foreground shadow-md'
                              : isFixed && isCurrentMonthDay
                                ? 'text-foreground font-semibold'
                                : ''
                          }`}
                        >
                          {format(day, 'd')}
                        </span>
                        {isFixed && isCurrentMonthDay && (
                          <div className="flex gap-0.5">
                            {fixedSlots.map((slot, i) => (
                              <Badge 
                                key={i} 
                                variant="secondary" 
                                className="text-[8px] px-1 py-0 h-4 bg-foreground/10 text-foreground/80 border-0 hidden sm:inline-flex"
                              >
                                {slot.shortLabel}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Scheduled members */}
                      {hasSchedules && isCurrentMonthDay && (
                        <div className="flex flex-wrap gap-0.5">
                          {daySchedules.slice(0, 4).map((schedule, i) => {
                            const color = getMemberColor(schedule.user_id);
                            return (
                              <Tooltip key={i}>
                                <TooltipTrigger asChild>
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold shadow-md border-2 border-white/50"
                                    style={{ backgroundColor: color.bg }}
                                  >
                                    {schedule.profile?.name?.charAt(0) || 'M'}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{schedule.profile?.name || 'Membro'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {schedule.time_start?.slice(0, 5)} - {schedule.time_end?.slice(0, 5)}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                          {daySchedules.length > 4 && (
                            <div className="w-5 h-5 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-[9px] font-bold text-white shadow-md">
                              +{daySchedules.length - 4}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Empty slot indicator for fixed days without schedules */}
                      {isFixed && isCurrentMonthDay && !hasSchedules && (
                        <div className="flex items-center justify-center mt-1">
                          <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Plus className="w-3 h-3 text-white/80" />
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Next Month Calendar Grid */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 capitalize">
              {format(nextMonth, 'MMMM yyyy', { locale: ptBR })}
            </h3>
            <div className="bg-card border-2 border-border rounded-lg overflow-hidden">
              {/* Week Days Header */}
              <div className="grid grid-cols-7 border-b border-border bg-muted">
                {weekDays.map((day, i) => (
                  <div
                    key={i}
                    className="text-center font-medium text-muted-foreground py-2 text-xs"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {nextMonthCalendarDays.map((day, index) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const daySchedules = schedulesByDate.get(dateKey) || [];
                  const isNextMonthDay = isSameMonth(day, nextMonth);
                  const isCurrentDay = isToday(day);
                  const hasSchedules = daySchedules.length > 0;
                  const isFixed = isFixedSlotDay(day);
                  const fixedSlots = getFixedSlotsForDay(day);

                  const slotStyle = getDaySlotStyle(day);

                  return (
                    <button
                      key={index}
                      onClick={() => handleDayClick(day)}
                      disabled={!isNextMonthDay || (!isFixed && !hasSchedules && !isLeader)}
                      className={`relative border-r border-b transition-all duration-300 min-h-[60px] sm:min-h-[80px] p-1 overflow-hidden group ${
                        !isNextMonthDay 
                          ? 'bg-muted/20 text-muted-foreground/40 border-border' 
                          : isFixed 
                            ? `cursor-pointer hover:scale-[1.02] hover:z-10 border-2 ${slotStyle?.borderColor || 'border-border'}` 
                            : hasSchedules
                              ? 'bg-primary/10 cursor-pointer hover:bg-primary/20 border-primary/30'
                              : isLeader 
                                ? `cursor-pointer hover:bg-muted/50 border-border ${getDayBackgroundColor(day)}`
                                : `border-border ${getDayBackgroundColor(day)}`
                      } ${index % 7 === 6 ? 'border-r-0' : ''} ${
                        Math.floor(index / 7) === Math.floor((nextMonthCalendarDays.length - 1) / 7) ? 'border-b-0' : ''
                      }`}
                    >
                      {/* Background for fixed slot days */}
                      {isFixed && isNextMonthDay && slotStyle && (
                        <>
                          {slotStyle.isSplit ? (
                            /* Split background for Sunday - half morning, half night with divider */
                            <div className="absolute inset-0 flex overflow-hidden">
                              <div className={`w-1/2 ${slotStyle.morningBgColor} backdrop-blur-sm`} />
                              <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-white/40 z-10" />
                              <div className={`w-1/2 ${slotStyle.nightBgColor} backdrop-blur-sm`} />
                            </div>
                          ) : (
                            /* Solid background for Wednesday */
                            <div className={`absolute inset-0 ${slotStyle.bgColor} backdrop-blur-sm`} />
                          )}
                          <div 
                            className={`absolute inset-0 shadow-lg ${slotStyle.glow || ''} group-hover:opacity-100 opacity-80 transition-opacity`}
                          />
                        </>
                      )}

                      {/* Content wrapper */}
                      <div className="relative z-10">
                        {/* Day number */}
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs font-bold flex items-center justify-center w-5 h-5 rounded-full ${
                              isCurrentDay
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : isFixed && isNextMonthDay
                                  ? 'text-foreground font-semibold'
                                  : ''
                            }`}
                          >
                            {format(day, 'd')}
                          </span>
                          {isFixed && isNextMonthDay && (
                            <div className="flex gap-0.5">
                              {fixedSlots.map((slot, i) => (
                                <Badge 
                                  key={i} 
                                  variant="secondary" 
                                  className="text-[8px] px-1 py-0 h-4 bg-foreground/10 text-foreground/80 border-0 hidden sm:inline-flex"
                                >
                                  {slot.shortLabel}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Scheduled members */}
                        {hasSchedules && isNextMonthDay && (
                          <div className="flex flex-wrap gap-0.5">
                            {daySchedules.slice(0, 4).map((schedule, i) => {
                              const color = getMemberColor(schedule.user_id);
                              return (
                                <Tooltip key={i}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold shadow-md border-2 border-white/50"
                                      style={{ backgroundColor: color.bg }}
                                    >
                                      {schedule.profile?.name?.charAt(0) || 'M'}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{schedule.profile?.name || 'Membro'}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {schedule.time_start?.slice(0, 5)} - {schedule.time_end?.slice(0, 5)}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                            {daySchedules.length > 4 && (
                              <div className="w-5 h-5 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-[9px] font-bold text-white shadow-md">
                                +{daySchedules.length - 4}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Empty slot indicator for fixed days without schedules */}
                        {isFixed && isNextMonthDay && !hasSchedules && (
                          <div className="flex items-center justify-center mt-1">
                            <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                              <Plus className="w-3 h-3 text-white/80" />
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
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
              <Button 
                onClick={() => onAddSchedule()}
                variant="outline"
                className="flex-1 gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Escala Manual
              </Button>
            </div>
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
              const color = getMemberColor(member.user_id);
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

      {/* Day Detail Dialog */}
      <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {selectedDay && format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </DialogTitle>
            <DialogDescription>
              {selectedDay && getFixedSlotsForDay(selectedDay).map(slot => slot.label).join(' • ')}
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
                            <span>{schedule.time_start?.slice(0, 5)} - {schedule.time_end?.slice(0, 5)}</span>
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
              <div className="text-center py-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Nenhuma escala neste dia
                </p>
                {isLeader && selectedDay && (
                  <div className="flex flex-col gap-2">
                    {/* Fixed slot buttons for Wednesday/Sunday */}
                    {getFixedSlotsForDay(selectedDay).length > 0 ? (
                      getFixedSlotsForDay(selectedDay).map((slot, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          className="w-full justify-start gap-2"
                          onClick={() => {
                            setShowDayDialog(false);
                            onAddSchedule(selectedDay);
                          }}
                        >
                          <div 
                            className={`w-3 h-3 rounded ${slot.bgColor.replace('/80', '')}`} 
                          />
                          <span>Criar escala: {slot.label}</span>
                          <Clock className="w-3 h-3 ml-auto text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {slot.timeStart} - {slot.timeEnd}
                          </span>
                        </Button>
                      ))
                    ) : (
                      /* Manual schedule button for other days */
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => {
                          setShowDayDialog(false);
                          onAddSchedule(selectedDay);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        <span>Criar escala manual</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {isLeader && selectedDaySchedules.length > 0 && (
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
