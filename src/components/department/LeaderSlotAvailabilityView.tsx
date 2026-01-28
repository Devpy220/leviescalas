import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Calendar, Sun, Moon, Users, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCurrentPeriodInfo, getNextPeriodInfo, formatPeriodEnd, type PeriodInfo } from '@/lib/periodUtils';
import { createExtendedMemberColorMap, getMemberBackgroundStyle } from '@/lib/memberColors';

// Fixed slots configuration - matches SlotAvailability
const FIXED_SLOTS = [
  { 
    dayOfWeek: 0, 
    timeStart: '09:00', 
    timeEnd: '12:00', 
    label: 'Domingo Manhã', 
    icon: Sun,
    bgColor: 'bg-cyan-100/80 dark:bg-cyan-900/30',
    borderColor: 'border-cyan-300 dark:border-cyan-700/50',
    activeColor: 'bg-cyan-500'
  },
  { 
    dayOfWeek: 0, 
    timeStart: '18:00', 
    timeEnd: '22:00', 
    label: 'Domingo Noite', 
    icon: Moon,
    bgColor: 'bg-rose-100/80 dark:bg-rose-900/30',
    borderColor: 'border-rose-300 dark:border-rose-700/50',
    activeColor: 'bg-rose-500'
  },
  { 
    dayOfWeek: 1, 
    timeStart: '19:20', 
    timeEnd: '22:00', 
    label: 'Segunda', 
    icon: Moon,
    bgColor: 'bg-amber-100/80 dark:bg-amber-900/30',
    borderColor: 'border-amber-300 dark:border-amber-700/50',
    activeColor: 'bg-amber-500'
  },
  { 
    dayOfWeek: 3, 
    timeStart: '19:20', 
    timeEnd: '22:00', 
    label: 'Quarta', 
    icon: Moon,
    bgColor: 'bg-violet-100/80 dark:bg-violet-900/30',
    borderColor: 'border-violet-300 dark:border-violet-700/50',
    activeColor: 'bg-violet-500'
  },
  { 
    dayOfWeek: 5, 
    timeStart: '19:20', 
    timeEnd: '22:00', 
    label: 'Sexta', 
    icon: Moon,
    bgColor: 'bg-pink-100/80 dark:bg-pink-900/30',
    borderColor: 'border-pink-300 dark:border-pink-700/50',
    activeColor: 'bg-pink-500'
  },
];

interface LeaderSlotAvailabilityViewProps {
  departmentId: string;
}

interface MemberProfile {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface SlotAvailabilityRecord {
  user_id: string;
  day_of_week: number;
  time_start: string;
  time_end: string;
  is_available: boolean;
  period_start: string;
}

export default function LeaderSlotAvailabilityView({ departmentId }: LeaderSlotAvailabilityViewProps) {
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'current' | 'next'>('current');
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [currentAvailability, setCurrentAvailability] = useState<SlotAvailabilityRecord[]>([]);
  const [nextAvailability, setNextAvailability] = useState<SlotAvailabilityRecord[]>([]);
  
  const currentPeriod = useMemo(() => getCurrentPeriodInfo(), []);
  const nextPeriod = useMemo(() => getNextPeriodInfo(), []);
  
  const activePeriod = selectedPeriod === 'current' ? currentPeriod : nextPeriod;
  const availability = selectedPeriod === 'current' ? currentAvailability : nextAvailability;

  // Normalize time to HH:mm format (database returns HH:mm:ss)
  const normalizeTime = (time: string) => time?.slice(0, 5);

  useEffect(() => {
    if (!departmentId) return;
    fetchData();
  }, [departmentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch member profiles
      const { data: profilesData, error: profilesError } = await supabase
        .rpc('get_department_member_profiles', { dept_id: departmentId });

      if (profilesError) throw profilesError;

      // Fetch all member availability for this department (both periods)
      const { data: availabilityData, error: availabilityError } = await supabase
        .from('member_availability')
        .select('user_id, day_of_week, time_start, time_end, is_available, period_start')
        .eq('department_id', departmentId)
        .eq('is_available', true)
        .gte('period_start', currentPeriod.periodStartStr);

      if (availabilityError) throw availabilityError;

      // Separate into current and next period
      const current: SlotAvailabilityRecord[] = [];
      const next: SlotAvailabilityRecord[] = [];
      
      (availabilityData || []).forEach(record => {
        if (record.period_start === currentPeriod.periodStartStr) {
          current.push(record);
        } else if (record.period_start === nextPeriod.periodStartStr) {
          next.push(record);
        }
      });

      setMembers(profilesData || []);
      setCurrentAvailability(current);
      setNextAvailability(next);
    } catch (error) {
      console.error('Error fetching slot availability data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMembersForSlot = (slot: typeof FIXED_SLOTS[0]) => {
    const availableUserIds = availability
      .filter(a => 
        a.day_of_week === slot.dayOfWeek &&
        normalizeTime(a.time_start) === normalizeTime(slot.timeStart) &&
        normalizeTime(a.time_end) === normalizeTime(slot.timeEnd) &&
        a.is_available
      )
      .map(a => a.user_id);

    return members.filter(m => availableUserIds.includes(m.id));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Create color map for members
  const memberColorMap = useMemo(() => {
    const membersForColor = members.map(m => ({
      id: m.id,
      user_id: m.id,
      profile: { name: m.name }
    }));
    return createExtendedMemberColorMap(membersForColor);
  }, [members]);

  const getMemberBgStyle = (userId: string): React.CSSProperties => {
    return getMemberBackgroundStyle(memberColorMap, userId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const periodEndFormatted = formatPeriodEnd(activePeriod.periodEnd);

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Disponibilidade por Horários
        </CardTitle>
        <CardDescription>
          Veja quem pode servir em cada horário fixo da semana
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Tabs */}
        <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as 'current' | 'next')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current" className="text-xs sm:text-sm">
              {currentPeriod.label}
              <span className="hidden sm:inline ml-1 text-muted-foreground">(atual)</span>
            </TabsTrigger>
            <TabsTrigger value="next" className="text-xs sm:text-sm">
              {nextPeriod.label}
              <span className="hidden sm:inline ml-1 text-muted-foreground">(próximo)</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedPeriod} className="mt-4 space-y-4">
            {/* Period validity notice */}
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Período válido até {periodEndFormatted}
                </p>
                <p className="text-amber-700 dark:text-amber-300/80">
                  {selectedPeriod === 'next' 
                    ? 'Veja quem já marcou disponibilidade para o próximo período.'
                    : 'Após essa data, membros precisarão remarcar sua disponibilidade.'}
                </p>
              </div>
            </div>

            {/* Slots Grid */}
            <div className="space-y-3">
              {FIXED_SLOTS.map(slot => {
                const slotMembers = getMembersForSlot(slot);
                const Icon = slot.icon;
                const hasMembers = slotMembers.length > 0;

                return (
                  <div 
                    key={`${slot.dayOfWeek}-${slot.timeStart}`}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-all",
                      slot.bgColor,
                      hasMembers ? slot.borderColor : "border-transparent opacity-60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          hasMembers ? slot.activeColor : "bg-muted"
                        )}>
                          <Icon className={cn(
                            "w-5 h-5",
                            hasMembers ? "text-white" : "text-muted-foreground"
                          )} />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {slot.label}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {slot.timeStart} - {slot.timeEnd}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mr-2">
                          <Users className="w-4 h-4" />
                          <span>{slotMembers.length}</span>
                        </div>
                        
                        {hasMembers ? (
                          <div className="flex -space-x-2">
                            {slotMembers.slice(0, 6).map(member => (
                              <Avatar 
                                key={member.id} 
                                className="w-8 h-8 border-2 border-background"
                                title={member.name}
                              >
                              <AvatarImage src={member.avatar_url || undefined} alt={member.name} />
                                <AvatarFallback 
                                  className="text-xs font-bold text-white"
                                  style={getMemberBgStyle(member.id)}
                                >
                                  {getInitials(member.name)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {slotMembers.length > 6 && (
                              <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                <span className="text-xs font-medium text-muted-foreground">
                                  +{slotMembers.length - 6}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">
                            Nenhum membro disponível
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Member names expanded view */}
                    {hasMembers && (
                      <div className="mt-3 pt-3 border-t border-border/30">
                        <p className="text-sm text-muted-foreground">
                          {slotMembers.map(m => m.name).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Info */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground">
                <strong>Dica:</strong> Estes são os horários fixos que os membros marcaram como disponíveis. 
                Use esta informação para planejar escalas ou gerar automaticamente com a IA.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
