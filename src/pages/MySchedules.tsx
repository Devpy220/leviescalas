import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  ArrowLeft,
  Clock,
  Loader2,
  Heart,
  Church,
  ArrowLeftRight,
  User,
  Users,
  CalendarPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeviLogo } from '@/components/LeviLogo';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { SupportNotification } from '@/components/SupportNotification';
import { SwapRequestDialog } from '@/components/schedules/SwapRequestDialog';
import { SwapResponseDialog } from '@/components/schedules/SwapResponseDialog';
import { PendingSwapBadge } from '@/components/schedules/PendingSwapBadge';
import MyAvailabilitySheet from '@/components/department/MyAvailabilitySheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/hooks/useAuth';
import { useScheduleSwaps, type ScheduleSwap } from '@/hooks/useScheduleSwaps';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SUPPORT_PRICE_ID, ASSIGNMENT_ROLES } from '@/lib/constants';
import { FIXED_SLOTS, FixedSlot, findSlotByDayAndTime, normalizeTime } from '@/lib/fixedSlots';
import { format, parseISO, getDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SlotGroup {
  date: Date;
  slotInfo: FixedSlot;
  schedules: Schedule[];
}

interface Schedule {
  id: string;
  date: string;
  time_start: string;
  time_end: string;
  notes: string | null;
  department_id: string;
  department_name: string;
  sector_name: string | null;
  sector_color: string | null;
  church_name: string | null;
  church_logo_url: string | null;
  assignment_role: string | null;
  user_id: string;
  user_name?: string;
}

interface MemberProfile {
  id: string;
  name: string;
}

interface SupportPlan {
  isActive: boolean;
  loading: boolean;
}

export default function MySchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [supportPlan, setSupportPlan] = useState<SupportPlan>({ isActive: false, loading: false });
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [selectedSwap, setSelectedSwap] = useState<ScheduleSwap | null>(null);
  const [cancellingSwapId, setCancellingSwapId] = useState<string | null>(null);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'mine' | 'team'>('mine');
  const [memberProfiles, setMemberProfiles] = useState<Record<string, MemberProfile>>({});
  const [availabilitySheetOpen, setAvailabilitySheetOpen] = useState(false);
  const [leaderDepartments, setLeaderDepartments] = useState<{ id: string; name: string }[]>([]);
  const { user, session, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // CRITICAL: Use fallback to prevent infinite loading when user state is delayed
  const currentUser = user ?? session?.user ?? null;

  // Get the first department ID for swaps (we'll need to handle multi-department later)
  const primaryDepartmentId = departmentIds[0];
  const { 
    swaps, 
    createSwapRequest, 
    respondToSwap, 
    cancelSwap,
    getSwapForSchedule,
    getPendingSwapsForUser 
  } = useScheduleSwaps(primaryDepartmentId);

  useEffect(() => {
    if (authLoading) return;

    if (!currentUser) {
      navigate('/auth', { replace: true, state: { returnUrl: '/my-schedules' } });
      return;
    }

    fetchSchedules();
    fetchLeaderDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, authLoading, viewMode]);

  const fetchLeaderDepartments = async () => {
    if (!currentUser) return;
    
    try {
      const { data: memberData, error } = await supabase
        .from('members')
        .select('department_id, role, departments(id, name)')
        .eq('user_id', currentUser.id)
        .eq('role', 'leader');

      if (error) throw error;

      const depts = (memberData || [])
        .filter(m => m.departments)
        .map(m => ({
          id: (m.departments as any).id,
          name: (m.departments as any).name
        }));
      
      setLeaderDepartments(depts);
    } catch (error) {
      console.error('Error fetching leader departments:', error);
    }
  };

  const fetchSchedules = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('department_id')
        .eq('user_id', currentUser.id);

      if (memberError) throw memberError;

      if (!memberData || memberData.length === 0) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      const deptIds = memberData.map(m => m.department_id);
      setDepartmentIds(deptIds);

      // Fetch member profiles for team view
      if (viewMode === 'team') {
        const profilesMap: Record<string, MemberProfile> = {};
        for (const deptId of deptIds) {
          const { data: profiles } = await supabase.rpc('get_department_member_profiles', { dept_id: deptId });
          if (profiles) {
            profiles.forEach((p: any) => {
              profilesMap[p.id] = { id: p.id, name: p.name };
            });
          }
        }
        setMemberProfiles(profilesMap);
      }

      // Build query - filter by user only in 'mine' mode
      let query = supabase
        .from('schedules')
        .select(`
          id,
          date,
          time_start,
          time_end,
          notes,
          department_id,
          sector_id,
          assignment_role,
          user_id,
          sectors(name, color)
        `)
        .in('department_id', deptIds)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

      // Only filter by user in 'mine' mode
      if (viewMode === 'mine') {
        query = query.eq('user_id', currentUser.id);
      }

      const { data: schedulesData, error: schedulesError } = await query;

      if (schedulesError) throw schedulesError;

      const { data: departments } = await supabase
        .from('departments')
        .select('id, name, church_id')
        .in('id', deptIds);

      const churchIds = [...new Set((departments || []).map(d => d.church_id).filter(Boolean))] as string[];
      
      const churchMap: Record<string, { name: string; logo_url: string | null }> = {};
      if (churchIds.length > 0) {
        const { data: churches } = await supabase
          .from('churches')
          .select('id, name, logo_url')
          .in('id', churchIds);
        
        if (churches) {
          churches.forEach(c => {
            churchMap[c.id] = { name: c.name, logo_url: c.logo_url };
          });
        }
      }

      const deptMap = Object.fromEntries((departments || []).map(d => [d.id, {
        name: d.name,
        church_name: d.church_id ? churchMap[d.church_id]?.name : null,
        church_logo_url: d.church_id ? churchMap[d.church_id]?.logo_url : null,
      }]));

      const enrichedSchedules: Schedule[] = (schedulesData || []).map((s: any) => ({
        id: s.id,
        date: s.date,
        time_start: s.time_start,
        time_end: s.time_end,
        notes: s.notes,
        department_id: s.department_id,
        department_name: deptMap[s.department_id]?.name || 'Departamento',
        sector_name: s.sectors?.name || null,
        sector_color: s.sectors?.color || null,
        church_name: deptMap[s.department_id]?.church_name || null,
        church_logo_url: deptMap[s.department_id]?.church_logo_url || null,
        assignment_role: s.assignment_role || null,
        user_id: s.user_id,
        user_name: memberProfiles[s.user_id]?.name || undefined,
      }));

      setSchedules(enrichedSchedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSwapDialog = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setSwapDialogOpen(true);
  };

  const handleSwapSubmit = async (targetScheduleId: string, targetUserId: string, reason?: string) => {
    if (!selectedSchedule) return false;
    return createSwapRequest(selectedSchedule.id, targetScheduleId, targetUserId, reason);
  };

  const handleRespondToSwap = (swap: ScheduleSwap) => {
    setSelectedSwap(swap);
    setResponseDialogOpen(true);
  };

  const handleAcceptSwap = async (swapId: string) => {
    const success = await respondToSwap(swapId, true);
    if (success) {
      fetchSchedules(); // Refresh schedules after swap
    }
    return success;
  };

  const handleRejectSwap = async (swapId: string) => {
    return respondToSwap(swapId, false);
  };

  const handleCancelSwap = async (swapId: string) => {
    setCancellingSwapId(swapId);
    await cancelSwap(swapId);
    setCancellingSwapId(null);
    return true;
  };

  const handleSupportLevi = async () => {
    setSupportPlan(prev => ({ ...prev, loading: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('create-support-checkout', {
        body: { priceId: SUPPORT_PRICE_ID }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating support checkout:', error);
    } finally {
      setSupportPlan(prev => ({ ...prev, loading: false }));
    }
  };

  // Get pending swaps where user is the target
  const pendingSwapsForMe = getPendingSwapsForUser();

  // Group schedules by date + slot for team view
  const slotGroups = useMemo(() => {
    if (viewMode !== 'team') return [];
    
    const groups: SlotGroup[] = [];
    
    schedules.forEach(schedule => {
      const date = parseISO(schedule.date);
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
  }, [schedules, viewMode]);

  if (authLoading || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SupportNotification />
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <LeviLogo />
              <span className="font-display text-xl font-bold text-foreground">Minhas Escalas</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1">
        {/* View Mode Toggle */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            <Button
              size="sm"
              variant={viewMode === 'mine' ? 'default' : 'ghost'}
              onClick={() => setViewMode('mine')}
              className="gap-1.5"
            >
              <User className="w-4 h-4" />
              Minhas Escalas
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'team' ? 'default' : 'ghost'}
              onClick={() => setViewMode('team')}
              className="gap-1.5"
            >
              <Users className="w-4 h-4" />
              Escala da Equipe
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Availability Button - for all users */}
            {departmentIds.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAvailabilitySheetOpen(true)}
                className="gap-1.5"
              >
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">Minha Disponibilidade</span>
                <span className="sm:hidden">Disponibilidade</span>
              </Button>
            )}

            {/* Create Schedule Button - for leaders only */}
            {leaderDepartments.length === 1 && (
              <Button
                size="sm"
                onClick={() => navigate(`/departments/${leaderDepartments[0].id}?action=add-schedule`)}
                className="gap-1.5"
              >
                <CalendarPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Criar Escala</span>
                <span className="sm:hidden">Criar</span>
              </Button>
            )}

            {leaderDepartments.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <CalendarPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Criar Escala</span>
                    <span className="sm:hidden">Criar</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {leaderDepartments.map(dept => (
                    <DropdownMenuItem
                      key={dept.id}
                      onClick={() => navigate(`/departments/${dept.id}?action=add-schedule`)}
                    >
                      {dept.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Pending swap requests for me */}
        {pendingSwapsForMe.length > 0 && (
          <Card className="mb-6 p-4 border-primary/50 bg-primary/5">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-primary" />
              Solicitações de Troca ({pendingSwapsForMe.length})
            </h4>
            <div className="space-y-2">
              {pendingSwapsForMe.map(swap => (
                <div 
                  key={swap.id}
                  className="flex items-center justify-between p-3 bg-background rounded-lg border"
                >
                  <div>
                    <p className="font-medium text-sm">{swap.requester_name} quer trocar com você</p>
                    {swap.requester_schedule && swap.target_schedule && (
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(swap.requester_schedule.date), "dd/MM", { locale: ptBR })} ↔{' '}
                        {format(parseISO(swap.target_schedule.date), "dd/MM", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => handleRespondToSwap(swap)}
                  >
                    Ver Detalhes
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <h3 className="font-display text-xl font-semibold text-foreground mb-6">
          Próximas Escalas
        </h3>
        
        {loading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <Card className="p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="font-semibold text-foreground mb-2">Nenhuma escala encontrada</h4>
            <p className="text-sm text-muted-foreground">
              Você ainda não foi escalado em nenhum departamento.
            </p>
          </Card>
        ) : viewMode === 'mine' ? (
          /* Personal schedules - individual cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedules.map((schedule) => {
              const swap = getSwapForSchedule(schedule.id);
              const dateObj = parseISO(schedule.date);
              const dayOfWeek = format(dateObj, "EEE", { locale: ptBR }).toUpperCase();
              const dayMonth = format(dateObj, "dd/MM", { locale: ptBR });
              
              return (
                <Card 
                  key={schedule.id} 
                  className="relative overflow-hidden flex flex-col"
                >
                  {/* Colored header */}
                  <div className="px-4 py-3 border-b border-border/50 bg-primary/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-primary">{dayOfWeek}</span>
                        <span className="text-foreground font-medium">{dayMonth}</span>
                      </div>
                      {schedule.church_logo_url && (
                        <div className="w-7 h-7 rounded-full bg-background border-2 border-primary/20 overflow-hidden shadow-sm">
                          <img 
                            src={schedule.church_logo_url} 
                            alt={schedule.church_name || 'Igreja'} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                      <Clock className="w-3.5 h-3.5" />
                      {schedule.time_start.slice(0, 5)} - {schedule.time_end.slice(0, 5)}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex-1 space-y-2">
                      <Badge variant="secondary" className="text-xs">
                        {schedule.department_name}
                      </Badge>
                      
                      {schedule.church_name && (
                        <div className="flex items-center gap-1 text-xs text-primary/80">
                          <Church className="w-3 h-3" />
                          {schedule.church_name}
                        </div>
                      )}
                      
                      {schedule.sector_name && (
                        <div className="flex items-center gap-1.5 text-sm">
                          {schedule.sector_color && (
                            <div 
                              className="w-2.5 h-2.5 rounded-full" 
                              style={{ backgroundColor: schedule.sector_color }}
                            />
                          )}
                          <span style={{ color: schedule.sector_color || undefined }} className="font-medium">
                            {schedule.sector_name}
                          </span>
                        </div>
                      )}
                      
                      {/* Assignment Role Badge */}
                      {schedule.assignment_role && ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES] && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <span>{ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].icon}</span>
                          <Badge 
                            variant="outline" 
                            className={ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].color}
                          >
                            {ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].label}
                          </Badge>
                        </div>
                      )}
                    </div>
                    
                    {/* Swap section */}
                    <div className="pt-3 mt-3 border-t border-border/50">
                      {swap ? (
                        <PendingSwapBadge 
                          swap={swap}
                          onCancel={handleCancelSwap}
                          onRespond={handleRespondToSwap}
                          cancelling={cancellingSwapId === swap.id}
                        />
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => handleOpenSwapDialog(schedule)}
                        >
                          <ArrowLeftRight className="w-4 h-4 mr-2" />
                          Pedir Troca
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Team schedules - grouped by slot */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {slotGroups.map((group) => {
              const { date, slotInfo, schedules: groupSchedules } = group;
              const isCurrentDay = isToday(date);
              const userScheduleInSlot = groupSchedules.find(s => s.user_id === user?.id);
              const swap = userScheduleInSlot ? getSwapForSchedule(userScheduleInSlot.id) : null;
              
              return (
                <Card 
                  key={`${format(date, 'yyyy-MM-dd')}-${slotInfo.timeStart}`}
                  className={cn(
                    "overflow-hidden h-fit",
                    isCurrentDay && "ring-2 ring-primary"
                  )}
                >
                  {/* Slot Header */}
                  <CardHeader className={cn("p-3 pb-2", slotInfo.bgColor)}>
                    <div className="space-y-0.5">
                      <p className="font-bold text-sm uppercase tracking-wide">
                        {slotInfo.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(date, "d 'de' MMMM", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {slotInfo.timeStart} - {slotInfo.timeEnd}
                      </p>
                    </div>
                  </CardHeader>
                  
                  {/* Members List */}
                  <CardContent className="p-3 pt-2">
                    <div className="space-y-2">
                      {groupSchedules.map((schedule) => {
                        const isCurrentUser = schedule.user_id === user?.id;
                        const memberName = memberProfiles[schedule.user_id]?.name || 'Voluntário';
                        
                        return (
                          <div
                            key={schedule.id}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-md border-l-4",
                              isCurrentUser 
                                ? "bg-green-100 dark:bg-green-900/40 border-l-green-500" 
                                : "border-l-transparent"
                            )}
                            style={!isCurrentUser && schedule.sector_color ? { borderLeftColor: schedule.sector_color } : undefined}
                          >
                            {/* Avatar */}
                            <Avatar className="h-8 w-8">
                              <AvatarFallback 
                                className={cn(
                                  "text-xs font-medium",
                                  isCurrentUser 
                                    ? "bg-green-500 text-white" 
                                    : "bg-primary/20 text-primary"
                                )}
                              >
                                {(isCurrentUser ? 'V' : memberName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase())}
                              </AvatarFallback>
                            </Avatar>
                            
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={cn(
                                  "font-medium text-sm truncate",
                                  isCurrentUser && "text-green-700 dark:text-green-400"
                                )}>
                                  {isCurrentUser ? 'Você' : memberName}
                                  {isCurrentUser && <span className="ml-1">⭐</span>}
                                </p>
                                
                                {/* Assignment role icon */}
                                {schedule.assignment_role && ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES] && (
                                  <span className="text-sm">
                                    {ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].icon}
                                  </span>
                                )}
                              </div>
                              
                              {/* Sector and Role */}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {schedule.sector_name && (
                                  <span className="flex items-center gap-1 truncate">
                                    <div 
                                      className="w-2 h-2 rounded-full shrink-0" 
                                      style={{ backgroundColor: schedule.sector_color || undefined }}
                                    />
                                    {schedule.sector_name}
                                  </span>
                                )}
                                
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
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Swap button - only if user is in this slot */}
                    {userScheduleInSlot && (
                      <div className="pt-3 mt-3 border-t border-border/50">
                        {swap ? (
                          <PendingSwapBadge 
                            swap={swap}
                            onCancel={handleCancelSwap}
                            onRespond={handleRespondToSwap}
                            cancelling={cancellingSwapId === swap.id}
                          />
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => handleOpenSwapDialog(userScheduleInSlot)}
                          >
                            <ArrowLeftRight className="w-4 h-4 mr-2" />
                            Pedir Troca
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Support LEVI Card */}
        <Card className="mt-12 p-6 gradient-vibrant text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                <Heart className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold">Apoie o LEVI</h3>
                <p className="text-white/80">
                  Contribua com R$10/mês para manter a plataforma funcionando
                </p>
              </div>
            </div>
            <Button 
              onClick={handleSupportLevi}
              disabled={supportPlan.loading}
              className="bg-white text-primary hover:bg-white/90 font-semibold"
            >
              {supportPlan.loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Heart className="w-4 h-4 mr-2" />
              )}
              Apoiar Agora
            </Button>
          </div>
          <p className="text-xs text-white/60 mt-4 text-center md:text-left">
            * Esta contribuição é opcional e ajuda no desenvolvimento contínuo da plataforma.
          </p>
        </Card>
      </main>
      
      <Footer />

      {/* Swap Request Dialog */}
      <SwapRequestDialog
        open={swapDialogOpen}
        onOpenChange={setSwapDialogOpen}
        schedule={selectedSchedule ? {
          id: selectedSchedule.id,
          date: selectedSchedule.date,
          time_start: selectedSchedule.time_start,
          time_end: selectedSchedule.time_end,
          department_id: selectedSchedule.department_id,
        } : null}
        onSubmit={handleSwapSubmit}
      />

      {/* Swap Response Dialog */}
      <SwapResponseDialog
        open={responseDialogOpen}
        onOpenChange={setResponseDialogOpen}
        swap={selectedSwap}
        onAccept={handleAcceptSwap}
        onReject={handleRejectSwap}
      />

      {/* My Availability Sheet */}
      {departmentIds.length > 0 && currentUser && (
        <MyAvailabilitySheet
          departmentId={departmentIds[0]}
          userId={currentUser.id}
          open={availabilitySheetOpen}
          onOpenChange={setAvailabilitySheetOpen}
        />
      )}
    </div>
  );
}
