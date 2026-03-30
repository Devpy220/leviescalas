import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Calendar, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createExtendedMemberColorMap, getMemberBackgroundStyle } from '@/lib/memberColors';
import { FIXED_SLOTS } from '@/lib/fixedSlots';

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
}

export default function LeaderSlotAvailabilityView({ departmentId }: LeaderSlotAvailabilityViewProps) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [availability, setAvailability] = useState<SlotAvailabilityRecord[]>([]);
  
  

  const normalizeTime = (time: string) => time?.slice(0, 5);

  useEffect(() => {
    if (!departmentId) return;
    fetchData();
  }, [departmentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: profilesData, error: profilesError } = await supabase
        .rpc('get_department_member_profiles', { dept_id: departmentId });

      if (profilesError) throw profilesError;

      const { data: availabilityData, error: availabilityError } = await supabase
        .from('member_availability')
        .select('user_id, day_of_week, time_start, time_end, is_available')
        .eq('department_id', departmentId)
        .eq('is_available', true);

      if (availabilityError) throw availabilityError;

      setMembers(profilesData || []);
      setAvailability(availabilityData || []);
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
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const memberColorMap = useMemo(() => {
    const membersForColor = members.map(m => ({
      id: m.id, user_id: m.id, profile: { name: m.name }
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
                      <p className="font-medium text-foreground">{slot.label}</p>
                      <p className="text-sm text-muted-foreground">{slot.timeStart} - {slot.timeEnd}</p>
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
                          <Avatar key={member.id} className="w-8 h-8 border-2 border-background" title={member.name}>
                            <AvatarImage src={member.avatar_url || undefined} alt={member.name} />
                            <AvatarFallback className="text-xs font-bold text-white" style={getMemberBgStyle(member.id)}>
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {slotMembers.length > 6 && (
                          <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                            <span className="text-xs font-medium text-muted-foreground">+{slotMembers.length - 6}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Nenhum membro disponível</span>
                    )}
                  </div>
                </div>

                {hasMembers && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-sm text-muted-foreground">{slotMembers.map(m => m.name).join(', ')}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm text-muted-foreground">
            <strong>Dica:</strong> Estes são os horários fixos que os membros marcaram como disponíveis. 
            Use esta informação para planejar escalas ou gerar automaticamente com a IA.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
