import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CalendarOff, AlertTriangle } from 'lucide-react';
import { format, parseISO, isFuture, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createExtendedMemberColorMap, getMemberBackgroundStyle } from '@/lib/memberColors';

interface LeaderBlackoutDatesViewProps {
  departmentId: string;
}

interface MemberProfile {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface MemberPreference {
  user_id: string;
  blackout_dates: string[] | null;
}

export default function LeaderBlackoutDatesView({ departmentId }: LeaderBlackoutDatesViewProps) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [preferences, setPreferences] = useState<MemberPreference[]>([]);

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

      // Fetch member preferences with blackout dates
      const { data: prefsData, error: prefsError } = await supabase
        .from('member_preferences')
        .select('user_id, blackout_dates')
        .eq('department_id', departmentId);

      if (prefsError) throw prefsError;

      setMembers(profilesData || []);
      setPreferences(prefsData || []);
    } catch (error) {
      console.error('Error fetching blackout dates:', error);
    } finally {
      setLoading(false);
    }
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

  // Get members with future blackout dates
  const membersWithBlackouts = useMemo(() => {
    return members
      .map(member => {
        const pref = preferences.find(p => p.user_id === member.id);
        const blackoutDates = (pref?.blackout_dates || [])
          .filter(dateStr => {
            const date = parseISO(dateStr);
            return isFuture(date) || isToday(date);
          })
          .sort();
        
        return {
          ...member,
          blackoutDates
        };
      })
      .filter(m => m.blackoutDates.length > 0);
  }, [members, preferences]);

  // Aggregate all blackout dates with member counts
  const dateAggregation = useMemo(() => {
    const dateMap = new Map<string, string[]>();
    
    membersWithBlackouts.forEach(member => {
      member.blackoutDates.forEach(dateStr => {
        const existing = dateMap.get(dateStr) || [];
        existing.push(member.id);
        dateMap.set(dateStr, existing);
      });
    });

    return Array.from(dateMap.entries())
      .map(([date, memberIds]) => ({
        date,
        memberIds,
        count: memberIds.length
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [membersWithBlackouts]);

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
          <CalendarOff className="w-5 h-5 text-destructive" />
          Dias Bloqueados pelos Membros
        </CardTitle>
        <CardDescription>
          Veja as datas em que membros não podem ser escalados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {dateAggregation.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum membro tem datas bloqueadas futuras.</p>
          </div>
        ) : (
          <>
            {/* Alert for multiple members blocked on same date */}
            {dateAggregation.some(d => d.count >= 2) && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Atenção: Algumas datas têm múltiplos membros indisponíveis
                  </p>
                </div>
              </div>
            )}

            {/* Dates list with members */}
            <div className="space-y-2">
              {dateAggregation.map(({ date, memberIds, count }) => {
                const dateObj = parseISO(date);
                const membersOnDate = members.filter(m => memberIds.includes(m.id));
                
                return (
                  <div 
                    key={date}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[50px]">
                        <p className="text-xs text-muted-foreground uppercase">
                          {format(dateObj, 'EEE', { locale: ptBR })}
                        </p>
                        <p className="text-lg font-bold">
                          {format(dateObj, 'dd')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(dateObj, 'MMM', { locale: ptBR })}
                        </p>
                      </div>
                      
                      <div className="flex -space-x-2">
                        {membersOnDate.slice(0, 5).map(member => (
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
                        {membersOnDate.length > 5 && (
                          <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                            <span className="text-xs font-medium text-muted-foreground">
                              +{membersOnDate.length - 5}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Badge 
                      variant={count >= 2 ? "destructive" : "secondary"}
                      className="shrink-0"
                    >
                      {count} {count === 1 ? 'indisponível' : 'indisponíveis'}
                    </Badge>
                  </div>
                );
              })}
            </div>

            {/* Members summary */}
            <div className="pt-4 border-t border-border/50">
              <h4 className="text-sm font-medium mb-3">Resumo por Membro</h4>
              <div className="space-y-2">
                {membersWithBlackouts.map(member => (
                  <div 
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                  >
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={member.avatar_url || undefined} alt={member.name} />
                      <AvatarFallback 
                        className="text-xs font-bold text-white"
                        style={getMemberBgStyle(member.id)}
                      >
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium flex-1">{member.name}</span>
                    <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                      {member.blackoutDates.slice(0, 3).map(dateStr => (
                        <Badge key={dateStr} variant="outline" className="text-xs">
                          {format(parseISO(dateStr), 'dd/MM')}
                        </Badge>
                      ))}
                      {member.blackoutDates.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{member.blackoutDates.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Info */}
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm text-muted-foreground">
            <strong>Dica:</strong> Membros podem adicionar datas de bloqueio em "Minha Disponibilidade" → "Minhas Preferências". 
            Use esta informação ao criar escalas para evitar conflitos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
