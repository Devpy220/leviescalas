import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, Check, X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, isWednesday, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeaderAvailabilityViewProps {
  departmentId: string;
  onOpenSmartSchedule: () => void;
}

interface FixedSlot {
  id: string;
  dayOfWeek: number;
  timeStart: string;
  timeEnd: string;
  label: string;
  shortLabel: string;
}

// Horários fixos pré-definidos
const FIXED_SLOTS: FixedSlot[] = [
  { id: 'wed-night', dayOfWeek: 3, timeStart: '19:20', timeEnd: '22:00', label: 'Quarta 19:20-22:00', shortLabel: 'Qua 19:20' },
  { id: 'sun-morning', dayOfWeek: 0, timeStart: '08:00', timeEnd: '11:30', label: 'Domingo Manhã 8:00-11:30', shortLabel: 'Dom Manhã' },
  { id: 'sun-night', dayOfWeek: 0, timeStart: '18:00', timeEnd: '22:00', label: 'Domingo Noite 18:00-22:00', shortLabel: 'Dom Noite' },
];

interface MemberWithAvailability {
  id: string;
  name: string;
  avatar_url: string | null;
  availability: {
    dayOfWeek: number;
    timeStart: string;
    timeEnd: string;
    isAvailable: boolean;
  }[];
}

export default function LeaderAvailabilityView({ departmentId, onOpenSmartSchedule }: LeaderAvailabilityViewProps) {
  const [currentMonth, setCurrentMonth] = useState(addMonths(new Date(), 1));
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberWithAvailability[]>([]);

  // Get all valid dates for the month (Wednesdays and Sundays)
  const getMonthDates = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start, end });
    return allDays.filter(day => isSunday(day) || isWednesday(day));
  };

  const validDates = getMonthDates();

  useEffect(() => {
    fetchMembersAvailability();
  }, [departmentId]);

  const fetchMembersAvailability = async () => {
    try {
      setLoading(true);
      
      // Fetch all members
      const { data: membersData, error: membersError } = await supabase
        .rpc('get_department_member_profiles', { dept_id: departmentId });

      if (membersError) throw membersError;

      // Fetch all availability records
      const { data: availabilityData, error: availError } = await supabase
        .from('member_availability')
        .select('user_id, day_of_week, time_start, time_end, is_available')
        .eq('department_id', departmentId);

      if (availError) throw availError;

      // Combine data
      const membersWithAvail = (membersData || []).map((member: { id: string; name: string; avatar_url: string | null }) => {
        const memberAvail = (availabilityData || [])
          .filter(a => a.user_id === member.id)
          .map(a => ({
            dayOfWeek: a.day_of_week,
            timeStart: a.time_start.slice(0, 5),
            timeEnd: a.time_end.slice(0, 5),
            isAvailable: a.is_available
          }));

        return {
          id: member.id,
          name: member.name,
          avatar_url: member.avatar_url,
          availability: memberAvail
        };
      });

      setMembers(membersWithAvail);
    } catch (error) {
      console.error('Error fetching members availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const isSlotAvailable = (member: MemberWithAvailability, slot: FixedSlot) => {
    return member.availability.some(a => 
      a.dayOfWeek === slot.dayOfWeek && 
      a.timeStart === slot.timeStart &&
      a.timeEnd === slot.timeEnd &&
      a.isAvailable
    );
  };

  const navigateMonth = (direction: number) => {
    setCurrentMonth(prev => addMonths(prev, direction));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getSlotsForDate = (date: Date) => {
    const dayOfWeek = date.getDay();
    return FIXED_SLOTS.filter(slot => slot.dayOfWeek === dayOfWeek);
  };

  const getAvailableCountForSlot = (slot: FixedSlot) => {
    return members.filter(m => isSlotAvailable(m, slot)).length;
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Disponibilidade dos Membros
            </CardTitle>
            <CardDescription className="mt-1">
              Veja quem está disponível em cada horário fixo.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[140px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fixed Slots Summary */}
        <div className="grid gap-3 sm:grid-cols-3">
          {FIXED_SLOTS.map(slot => {
            const availableCount = getAvailableCountForSlot(slot);
            return (
              <Card key={slot.id} className="p-4 bg-muted/30 border-border/50">
                <div className="text-center">
                  <p className="text-sm font-medium">{slot.label}</p>
                  <p className="text-2xl font-bold text-primary mt-1">{availableCount}</p>
                  <p className="text-xs text-muted-foreground">membros disponíveis</p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Generate Button */}
        <Button 
          onClick={onOpenSmartSchedule}
          className="w-full gradient-vibrant text-white shadow-glow-sm hover:shadow-glow gap-2"
          size="lg"
        >
          <Sparkles className="w-5 h-5" />
          Gerar Escalas Automáticas com IA
        </Button>

        {/* Members Availability Table */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Membros e Disponibilidades</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-2">Membro</th>
                  {FIXED_SLOTS.map(slot => (
                    <th key={slot.id} className="text-center p-2 min-w-[100px]">
                      <div className="text-xs">{slot.shortLabel}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(member => (
                  <tr key={member.id} className="border-b border-border/30 hover:bg-accent/30">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="text-xs bg-primary/20 text-primary">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[120px]">{member.name}</span>
                      </div>
                    </td>
                    {FIXED_SLOTS.map(slot => {
                      const available = isSlotAvailable(member, slot);
                      return (
                        <td key={slot.id} className="text-center p-2">
                          {available ? (
                            <Badge variant="default" className="gap-1">
                              <Check className="w-3 h-3" />
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="opacity-50">
                              <X className="w-3 h-3" />
                            </Badge>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {members.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum membro encontrado.</p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <p className="text-sm text-muted-foreground">
            <strong>Como funciona:</strong> Cada membro marca sua disponibilidade nos horários fixos. 
            Quando você clica em "Gerar Escalas Automáticas", a IA cria escalas balanceadas 
            considerando a disponibilidade de todos.
          </p>
        </Card>
      </CardContent>
    </Card>
  );
}
