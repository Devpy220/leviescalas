import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, Check, X, ChevronLeft, ChevronRight, Sparkles, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, getDay, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface LeaderAvailabilityViewProps {
  departmentId: string;
  onOpenSmartSchedule: () => void;
}

interface MemberDateAvailability {
  user_id: string;
  date: string;
  is_available: boolean;
}

interface MemberWithAvailability {
  id: string;
  name: string;
  avatar_url: string | null;
  availableDates: string[];
}

export default function LeaderAvailabilityView({ departmentId, onOpenSmartSchedule }: LeaderAvailabilityViewProps) {
  const [currentMonth, setCurrentMonth] = useState(addMonths(new Date(), 1));
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberWithAvailability[]>([]);
  const [allAvailability, setAllAvailability] = useState<MemberDateAvailability[]>([]);

  const today = startOfDay(new Date());

  // Get all days for the month
  const getMonthDates = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };

  const allDates = getMonthDates();
  const firstDayOfMonth = getDay(startOfMonth(currentMonth));

  useEffect(() => {
    fetchMembersAvailability();
  }, [departmentId, currentMonth]);

  const fetchMembersAvailability = async () => {
    try {
      setLoading(true);
      
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      // Fetch all members
      const { data: membersData, error: membersError } = await supabase
        .rpc('get_department_member_profiles', { dept_id: departmentId });

      if (membersError) throw membersError;

      // Fetch all date availability records for this month
      const { data: availabilityData, error: availError } = await supabase
        .from('member_date_availability')
        .select('user_id, date, is_available')
        .eq('department_id', departmentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('is_available', true);

      if (availError) throw availError;

      setAllAvailability(availabilityData || []);

      // Combine data
      const membersWithAvail = (membersData || []).map((member: { id: string; name: string; avatar_url: string | null }) => {
        const memberDates = (availabilityData || [])
          .filter(a => a.user_id === member.id)
          .map(a => a.date);

        return {
          id: member.id,
          name: member.name,
          avatar_url: member.avatar_url,
          availableDates: memberDates
        };
      });

      setMembers(membersWithAvail);
    } catch (error) {
      console.error('Error fetching members availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: number) => {
    setCurrentMonth(prev => addMonths(prev, direction));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getAvailableCountForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return members.filter(m => m.availableDates.includes(dateStr)).length;
  };

  const isMemberAvailableOnDate = (memberId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const member = members.find(m => m.id === memberId);
    return member?.availableDates.includes(dateStr) ?? false;
  };

  // Get top available dates
  const dateAvailabilityCounts = allDates
    .filter(date => !isBefore(date, today))
    .map(date => ({
      date,
      count: getAvailableCountForDate(date)
    }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

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
              Veja quem está disponível em cada dia do mês.
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
        {/* Top Available Dates */}
        {dateAvailabilityCounts.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-5">
            {dateAvailabilityCounts.map(({ date, count }) => (
              <Card key={format(date, 'yyyy-MM-dd')} className="p-3 bg-muted/30 border-border/50">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground capitalize">
                    {format(date, 'EEE', { locale: ptBR })}
                  </p>
                  <p className="text-lg font-bold">{format(date, 'dd/MM')}</p>
                  <p className="text-xl font-bold text-primary mt-1">{count}</p>
                  <p className="text-xs text-muted-foreground">disponíveis</p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Generate Button */}
        <Button 
          onClick={onOpenSmartSchedule}
          className="w-full gradient-vibrant text-white shadow-glow-sm hover:shadow-glow gap-2"
          size="lg"
        >
          <Sparkles className="w-5 h-5" />
          Gerar Escalas Automáticas com IA
        </Button>

        {/* Calendar View with Availability Count */}
        <div className="bg-muted/30 rounded-lg border border-border/50 p-4">
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Calendário de Disponibilidade
          </h4>
          
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells */}
            {Array.from({ length: firstDayOfMonth }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}

            {/* Actual days */}
            {allDates.map(date => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const count = getAvailableCountForDate(date);
              const isPast = isBefore(date, today);
              const hasAvailability = count > 0;

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "aspect-square rounded-md flex flex-col items-center justify-center text-sm",
                    hasAvailability && !isPast && "bg-primary/20 border border-primary/30",
                    !hasAvailability && !isPast && "bg-card border border-border/50",
                    isPast && "opacity-40 bg-muted/20"
                  )}
                >
                  <span className="font-medium text-xs">{format(date, 'd')}</span>
                  {!isPast && (
                    <span className={cn(
                      "text-xs font-bold",
                      hasAvailability ? "text-primary" : "text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Members Availability Table */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Membros e Disponibilidades</h4>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {members.map(member => (
              <div 
                key={member.id} 
                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card"
              >
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-primary/20 text-primary">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.availableDates.length} dias disponíveis
                  </p>
                </div>
                <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                  {member.availableDates.slice(0, 5).map(dateStr => (
                    <Badge key={dateStr} variant="secondary" className="text-xs">
                      {format(new Date(dateStr + 'T12:00:00'), 'dd/MM')}
                    </Badge>
                  ))}
                  {member.availableDates.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{member.availableDates.length - 5}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {members.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum membro encontrado.</p>
            </div>
          )}

          {members.length > 0 && members.every(m => m.availableDates.length === 0) && (
            <div className="text-center py-6 px-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                Nenhum membro marcou disponibilidade ainda.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Peça para os membros acessarem a aba "Disponibilidade" e marcarem os dias em que podem servir.
              </p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <p className="text-sm text-muted-foreground">
            <strong>Como funciona:</strong> Cada membro marca os dias em que está disponível no calendário. 
            Quando você clica em "Gerar Escalas Automáticas", a IA cria escalas balanceadas 
            considerando a disponibilidade de todos para as datas selecionadas.
          </p>
        </Card>
      </CardContent>
    </Card>
  );
}
