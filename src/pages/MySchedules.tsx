import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  ArrowLeft,
  Clock,
  Loader2,
  Heart,
  Church,
  ArrowLeftRight
} from 'lucide-react';
import { LeviLogo } from '@/components/LeviLogo';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { SupportNotification } from '@/components/SupportNotification';
import { SwapRequestDialog } from '@/components/schedules/SwapRequestDialog';
import { SwapResponseDialog } from '@/components/schedules/SwapResponseDialog';
import { PendingSwapBadge } from '@/components/schedules/PendingSwapBadge';
import { useAuth } from '@/hooks/useAuth';
import { useScheduleSwaps, type ScheduleSwap } from '@/hooks/useScheduleSwaps';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SUPPORT_PRICE_ID } from '@/lib/constants';
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
  sector_color: string | null;
  church_name: string | null;
  church_logo_url: string | null;
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
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

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
    if (user) {
      fetchSchedules();
    }
  }, [user?.id, authLoading]);

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
      setDepartmentIds(deptIds);

      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select(`
          id,
          date,
          time_start,
          time_end,
          notes,
          department_id,
          sector_id,
          sectors(name, color)
        `)
        .eq('user_id', user.id)
        .in('department_id', deptIds)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedules.map((schedule) => {
              const swap = getSwapForSchedule(schedule.id);
              const dateObj = parseISO(schedule.date);
              const dayOfWeek = format(dateObj, "EEE", { locale: ptBR }).toUpperCase();
              const dayMonth = format(dateObj, "dd/MM", { locale: ptBR });
              
              return (
                <Card key={schedule.id} className="relative overflow-hidden flex flex-col">
                  {/* Colored header */}
                  <div className="bg-primary/10 px-4 py-3 border-b border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary text-lg">{dayOfWeek}</span>
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
    </div>
  );
}
