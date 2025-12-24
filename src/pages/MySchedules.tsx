import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  ArrowLeft,
  Clock,
  MapPin,
  Loader2,
  CalendarDays,
  Heart
} from 'lucide-react';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { SupportNotification } from '@/components/SupportNotification';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Schedule {
  id: string;
  date: string;
  time_start: string;
  time_end: string;
  notes: string | null;
  department_id: string;
  department_name: string;
  sector_name: string | null;
}

interface SupportPlan {
  isActive: boolean;
  loading: boolean;
}

const SUPPORT_PRICE_ID = 'price_1SfMwvK0EKnRdptQbNDmg4CU';

export default function MySchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [supportPlan, setSupportPlan] = useState<SupportPlan>({ isActive: false, loading: false });
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;

    // Redirect only if there is truly no session
    if (!session) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchSchedules();
    }
  }, [user?.id, authLoading, session, navigate]);

  const fetchSchedules = async () => {
    if (!user) return;
    
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('department_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      if (!memberData || memberData.length === 0) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      const deptIds = memberData.map(m => m.department_id);

      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select(`
          id,
          date,
          time_start,
          time_end,
          notes,
          department_id,
          sector_id
        `)
        .eq('user_id', user.id)
        .in('department_id', deptIds)
        .order('date', { ascending: true });

      if (schedulesError) throw schedulesError;

      const { data: deptNames } = await supabase
        .from('departments')
        .select('id, name')
        .in('id', deptIds);

      const sectorIds = (schedulesData || []).filter(s => s.sector_id).map(s => s.sector_id);
      let sectorNames: Record<string, string> = {};
      if (sectorIds.length > 0) {
        const { data: sectors } = await supabase
          .from('sectors')
          .select('id, name')
          .in('id', sectorIds);
        
        if (sectors) {
          sectorNames = Object.fromEntries(sectors.map(s => [s.id, s.name]));
        }
      }

      const deptNameMap = Object.fromEntries((deptNames || []).map(d => [d.id, d.name]));

      const enrichedSchedules: Schedule[] = (schedulesData || []).map(s => ({
        id: s.id,
        date: s.date,
        time_start: s.time_start,
        time_end: s.time_end,
        notes: s.notes,
        department_id: s.department_id,
        department_name: deptNameMap[s.department_id] || 'Departamento',
        sector_name: s.sector_id ? sectorNames[s.sector_id] : null,
      }));

      setSchedules(enrichedSchedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SupportNotification />
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
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
        <h3 className="font-display text-xl font-semibold text-foreground mb-6">
          Todas as Escalas
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
        ) : (
          <div className="grid gap-3">
            {schedules.map((schedule) => (
              <Card key={schedule.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {format(parseISO(schedule.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {schedule.time_start.slice(0, 5)} - {schedule.time_end.slice(0, 5)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{schedule.department_name}</Badge>
                    {schedule.sector_name && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 justify-end">
                        <MapPin className="w-3 h-3" />
                        {schedule.sector_name}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
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
    </div>
  );
}
