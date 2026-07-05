import { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Clock,
  Trash2,
  Pencil,
  Users,
  Sparkles,
  Calendar as CalendarIcon,
  CalendarPlus,
  GripVertical,
} from 'lucide-react';
import { DraggableFloating } from '@/components/ui/draggable-floating';
import { ASSIGNMENT_ROLES } from '@/lib/constants';
import { FIXED_SLOTS, FixedSlot, findSlotByDayAndTime, normalizeTime } from '@/lib/fixedSlots';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
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
import EditScheduleDialog from '@/components/department/EditScheduleDialog';
import SlotRepertoireEditor from '@/components/department/SlotRepertoireEditor';
import { REPERTOIRE_EDIT_ROLES } from '@/lib/constants';
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
  isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  sector?: {
    name: string;
    color: string;
  } | null;
}

interface Member {
  id: string;
  user_id: string;
  role: 'leader' | 'coleader' | 'member';
  profile: {
    name: string;
    email: string;
    whatsapp: string;
    avatar_url: string | null;
  };
}

interface SlotGroup {
  date: Date;
  slotInfo: FixedSlot;
  schedules: Schedule[];
}

interface UnifiedScheduleViewProps {
  schedules: Schedule[];
  members: Member[];
  isLeader: boolean;
  currentUserId: string;
  departmentId: string;
  onAddSchedule: (date?: Date) => void;
  onDeleteSchedule: () => void;
  onOpenSmartSchedule: () => void;
  
  readOnly?: boolean;
}

export default function UnifiedScheduleView({ 
  schedules, 
  members,
  isLeader, 
  currentUserId,
  departmentId,
  onAddSchedule,
  onDeleteSchedule,
  onOpenSmartSchedule,
  
  readOnly = false
}: UnifiedScheduleViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const { toast } = useToast();

  // Create extended color map
  const memberColorMap = useMemo(() => createExtendedMemberColorMap(members), [members]);
  const getMemberColorValue = (userId: string) => getMemberColor(memberColorMap, userId);
  const getMemberBgStyle = (userId: string): React.CSSProperties => {
    return getMemberBackgroundStyle(memberColorMap, userId);
  };
  const visibleSchedules = useMemo(() => {
    if (isLeader || readOnly) return schedules;
    return schedules.filter(s => s.user_id === currentUserId);
  }, [schedules, isLeader, currentUserId, readOnly]);

  // Group schedules by date + slot - use visibleSchedules instead of schedules
  const slotGroups = useMemo(() => {
    const groups: SlotGroup[] = [];
    
    visibleSchedules.forEach(schedule => {
      const date = parseISO(schedule.date);
      
      if (!isSameMonth(date, currentMonth)) return;
      
      const dayOfWeek = getDay(date);
      
      // Find matching slot by day of week and time (using normalized comparison)
      const slotInfo = findSlotByDayAndTime(dayOfWeek, schedule.time_start);
      
      if (!slotInfo) {
        // Create a generic slot for custom times
        const genericSlot: FixedSlot = {
          dayOfWeek,
          timeStart: normalizeTime(schedule.time_start),
          timeEnd: normalizeTime(schedule.time_end),
          label: format(date, 'EEEE', { locale: ptBR }),
          icon: FIXED_SLOTS[0].icon,
          bgColor: 'bg-muted/50',
          borderColor: 'border-border',
          activeColor: 'bg-primary'
        };
        
        // Check if group already exists
        const existingGroup = groups.find(g => 
          g.date.getTime() === date.getTime() && 
          g.slotInfo.timeStart === normalizeTime(schedule.time_start)
        );
        
        if (existingGroup) {
          existingGroup.schedules.push(schedule);
        } else {
          groups.push({
            date,
            slotInfo: genericSlot,
            schedules: [schedule]
          });
        }
      } else {
        // Check if group already exists for this date + slot
        const existingGroup = groups.find(g => 
          g.date.getTime() === date.getTime() && 
          g.slotInfo.dayOfWeek === slotInfo.dayOfWeek &&
          g.slotInfo.timeStart === slotInfo.timeStart
        );
        
        if (existingGroup) {
          existingGroup.schedules.push(schedule);
        } else {
          groups.push({
            date,
            slotInfo,
            schedules: [schedule]
          });
        }
      }
    });
    
    // Sort groups by date, then by time
    groups.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.slotInfo.timeStart.localeCompare(b.slotInfo.timeStart);
    });
    
    return groups;
  }, [visibleSchedules, currentMonth]);

  // Get month's schedule summary
  const monthScheduleSummary = useMemo(() => {
    let totalScheduled = 0;
    const uniqueDates = new Set<string>();
    
    slotGroups.forEach(group => {
      uniqueDates.add(format(group.date, 'yyyy-MM-dd'));
      totalScheduled += group.schedules.length;
    });
    
    return { totalScheduled, daysCount: uniqueDates.size, slotsCount: slotGroups.length };
  }, [slotGroups]);

  // Confirmation status functions removed - now using swap system instead

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

  return (
    <div className="space-y-4">
      {/* Header with month navigation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 capitalize">
                <CalendarIcon className="w-5 h-5" />
                {isLeader ? 'Escalas de' : 'Minhas Escalas de'} {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardTitle>
              <CardDescription>
                {monthScheduleSummary.daysCount} {monthScheduleSummary.daysCount === 1 ? 'dia' : 'dias'} • {monthScheduleSummary.slotsCount} {monthScheduleSummary.slotsCount === 1 ? 'escala' : 'escalas'}{isLeader ? ` • ${monthScheduleSummary.totalScheduled} pessoas` : ''}
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
      {/* Individually draggable floating buttons — drag anywhere on the button */}
      {isLeader && !readOnly && (
        <>
          <DraggableFloating
            storageKey="dept-fab-smart"
            defaultPosition={{ right: 24, bottom: 96 }}
            onClick={onOpenSmartSchedule}
            title="Gerar escalas rápido (IA)"
            aria-label="Gerar escalas rápido"
            className="h-14 w-14 rounded-2xl shadow-lg bg-primary hover:bg-primary/90 hover:shadow-glow-sm transition-all flex items-center justify-center text-primary-foreground"
          >
            <Sparkles className="w-6 h-6 pointer-events-none" />
          </DraggableFloating>

          <DraggableFloating
            storageKey="dept-fab-manual"
            defaultPosition={{ right: 24, bottom: 24 }}
            onClick={() => onAddSchedule()}
            title="Adicionar escala manual"
            aria-label="Adicionar escala manual"
            className="h-14 w-14 rounded-2xl shadow-lg bg-background hover:bg-accent border border-border flex items-center justify-center"
          >
            <CalendarPlus className="w-6 h-6 pointer-events-none" />
          </DraggableFloating>
        </>
      )}

      {/* Horizontal Grid of Slot Cards */}
      {slotGroups.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {slotGroups.map((group) => (
            <SlotCard
              group={group}
              isLeader={isLeader && !readOnly}
              currentUserId={currentUserId}
              departmentId={departmentId}
              getMemberColorValue={getMemberColorValue}
              getMemberBgStyle={getMemberBgStyle}
              onAddSchedule={onAddSchedule}
              onEdit={(schedule) => {
                setSelectedSchedule(schedule);
                setShowEditDialog(true);
              }}
              onDelete={(schedule) => {
                setSelectedSchedule(schedule);
                setShowDeleteDialog(true);
              }}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-2">
              {isLeader 
                ? `Nenhuma escala para ${format(currentMonth, 'MMMM', { locale: ptBR })}`
                : `Você não tem escalas para ${format(currentMonth, 'MMMM', { locale: ptBR })}`}
            </p>
            {isLeader && (
              <p className="text-sm text-muted-foreground">
                Clique em "Adicionar Escala Manual" para começar a criar escalas
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Members legend - only visible for leaders */}
      {isLeader && (
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
      )}

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

      {/* Edit Schedule Dialog */}
      <EditScheduleDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        schedule={selectedSchedule}
        members={members}
        departmentId={departmentId}
        onScheduleUpdated={() => {
          setShowEditDialog(false);
          setSelectedSchedule(null);
          onDeleteSchedule(); // reuse the refresh callback
        }}
      />
    </div>
  );
}

// Slot Card Component
interface SlotCardProps {
  group: SlotGroup;
  isLeader: boolean;
  currentUserId: string;
  departmentId: string;
  getMemberColorValue: (userId: string) => { bg: string; dot: string };
  getMemberBgStyle: (userId: string) => React.CSSProperties;
  onAddSchedule: (date?: Date) => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
}

function SlotCard({
  group,
  isLeader,
  currentUserId,
  departmentId,
  getMemberColorValue,
  getMemberBgStyle,
  onAddSchedule,
  onEdit,
  onDelete
}: SlotCardProps) {
  const { date, slotInfo, schedules } = group;
  const isCurrentDay = isToday(date);
  const userScheduleInSlot = schedules.find(s => s.user_id === currentUserId);
  const userIsScheduled = !!userScheduleInSlot;
  const userIsWorshipMinister = !!userScheduleInSlot?.assignment_role
    && REPERTOIRE_EDIT_ROLES.includes(userScheduleInSlot.assignment_role as any);
  const canEditRepertoire = isLeader || userIsWorshipMinister;
  const dateStr = format(date, 'yyyy-MM-dd');

  return (
    <Card className={cn(
      "overflow-hidden transition-all h-fit bg-card/60 backdrop-blur-md border-border/40 shadow-sm",
      isCurrentDay && "ring-2 ring-primary"
    )}>
      {/* Slot Header */}
      <CardHeader className={cn(
        "p-2 pb-1.5 backdrop-blur-sm",
        slotInfo.bgColor
      )}>
        <div className="flex items-center justify-between">
          <div className="space-y-0">
            <p className="font-bold text-[11px] uppercase tracking-wide">
              {slotInfo.label}
            </p>
            <p className="text-xs font-semibold text-foreground">
              {format(date, "d 'de' MMMM", { locale: ptBR })}
            </p>
            <p className="text-[10px] font-medium text-foreground/70 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {slotInfo.timeStart} - {slotInfo.timeEnd}
            </p>
          </div>
          {isLeader && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => onAddSchedule(date)}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      
      {/* Members List */}
      <CardContent className="p-2 pt-1.5">
        <div className="space-y-1.5">

          {schedules.map((schedule) => (
            <MemberRow
              key={schedule.id}
              schedule={schedule}
              isLeader={isLeader}
              getMemberColorValue={getMemberColorValue}
              getMemberBgStyle={getMemberBgStyle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>

        {/* Repertório de Hoje (setlist + anexos + observações) */}
        <div className="pt-3 mt-3 border-t border-border/50">
          <SlotRepertoireEditor
            departmentId={departmentId}
            date={dateStr}
            timeStart={slotInfo.timeStart}
            timeEnd={slotInfo.timeEnd}
            canEdit={canEditRepertoire}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Member Row Component (compact version for grid)
interface MemberRowProps {
  schedule: Schedule;
  isLeader: boolean;
  getMemberColorValue: (userId: string) => { bg: string; dot: string };
  getMemberBgStyle: (userId: string) => React.CSSProperties;
  onEdit: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
}

function MemberRow({
  schedule,
  isLeader,
  getMemberColorValue,
  getMemberBgStyle,
  onEdit,
  onDelete
}: MemberRowProps) {
  const color = getMemberColorValue(schedule.user_id);

  return (
    <div
      className="flex items-center gap-1.5 p-1.5 rounded-md border-l-4"
      style={{ borderLeftColor: schedule.sector?.color || color.bg }}
    >
      {/* Compact Avatar */}
      <Avatar className="h-6 w-6">
        <AvatarFallback 
          className="text-[10px] text-white font-medium"
          style={getMemberBgStyle(schedule.user_id)}
        >
          {schedule.profile?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'M'}
        </AvatarFallback>
      </Avatar>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="font-medium text-xs truncate">{schedule.profile?.name || 'Membro'}</p>

          
          {/* Assignment role icon */}
          {schedule.assignment_role && ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES] && (
            <Tooltip>
              <TooltipTrigger>
                <span className="text-sm">
                  {ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].icon}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].label}</p>
              </TooltipContent>
            </Tooltip>
          )}
          
        </div>
        
        {/* Sector */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {schedule.sector && (
            <span className="flex items-center gap-1 truncate">
              <div 
                className="w-2 h-2 rounded-full shrink-0" 
                style={{ backgroundColor: schedule.sector.color }}
              />
              {schedule.sector.name}
            </span>
          )}
          
          {/* Assignment role badge */}
          {schedule.assignment_role && ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES] && (
            <Badge variant="outline" className={cn(
              "text-[10px] px-1 py-0 shrink-0",
              ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].color
            )}>
              {ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].label}
            </Badge>
          )}
        </div>
      </div>
      
      {/* Edit & Delete buttons */}
      {isLeader && (
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={() => onEdit(schedule)}
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(schedule)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
