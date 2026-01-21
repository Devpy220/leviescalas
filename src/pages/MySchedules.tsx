import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  ArrowLeft,
  Clock,
  MapPin,
  Loader2,
  CalendarDays,
  Heart,
  Church,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { LeviLogo } from '@/components/LeviLogo';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { SupportNotification } from '@/components/SupportNotification';
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
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SUPPORT_PRICE_ID } from '@/lib/constants';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ConfirmationStatus = 'pending' | 'confirmed' | 'declined';

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
  confirmation_status: ConfirmationStatus;
  confirmation_token: string | null;
}

interface SupportPlan {
  isActive: boolean;
  loading: boolean;
}

export default function MySchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [supportPlan, setSupportPlan] = useState<SupportPlan>({ isActive: false, loading: false });
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [selectedScheduleForDecline, setSelectedScheduleForDecline] = useState<Schedule | null>(null);
  const { user, session, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for auth to finish loading (ProtectedRoute ensures user exists)
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
          confirmation_status,
          confirmation_token,
          sectors(name, color)
        `)
        .eq('user_id', user.id)
        .in('department_id', deptIds)
        .order('date', { ascending: true });

      if (schedulesError) throw schedulesError;

      // Fetch departments with church info
      const { data: departments } = await supabase
        .from('departments')
        .select('id, name, church_id')
        .in('id', deptIds);

      // Get unique church IDs
      const churchIds = [...new Set((departments || []).map(d => d.church_id).filter(Boolean))] as string[];
      
      // Fetch church info
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

      // Create department map with church info
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
        confirmation_status: s.confirmation_status || 'pending',
        confirmation_token: s.confirmation_token,
      }));

      setSchedules(enrichedSchedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (schedule: Schedule) => {
    if (!schedule.confirmation_token) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Token de confirmação não encontrado.',
      });
      return;
    }
    
    setConfirmingId(schedule.id);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-schedule?token=${schedule.confirmation_token}&action=confirm`,
        { method: 'GET' }
      );
      
      if (response.ok) {
        toast({
          title: 'Presença confirmada!',
          description: 'Sua presença foi registrada com sucesso.',
        });
        fetchSchedules();
      } else {
        throw new Error('Erro ao confirmar');
      }
    } catch (error) {
      console.error('Error confirming:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao confirmar',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setConfirmingId(null);
    }
  };

  const handleDecline = async () => {
    if (!selectedScheduleForDecline?.confirmation_token) return;
    
    setDecliningId(selectedScheduleForDecline.id);
    try {
      const reasonParam = declineReason ? `&reason=${encodeURIComponent(declineReason)}` : '';
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-schedule?token=${selectedScheduleForDecline.confirmation_token}&action=decline${reasonParam}`,
        { method: 'GET' }
      );
      
      if (response.ok) {
        toast({
          title: 'Ausência registrada',
          description: 'O líder será notificado.',
        });
        setShowDeclineDialog(false);
        setDeclineReason('');
        setSelectedScheduleForDecline(null);
        fetchSchedules();
      } else {
        throw new Error('Erro ao registrar ausência');
      }
    } catch (error) {
      console.error('Error declining:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setDecliningId(null);
    }
  };

  const openDeclineDialog = (schedule: Schedule) => {
    setSelectedScheduleForDecline(schedule);
    setDeclineReason('');
    setShowDeclineDialog(true);
  };

  const getStatusBadge = (status: ConfirmationStatus) => {
    switch (status) {
      case 'confirmed':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Confirmado
          </Badge>
        );
      case 'declined':
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 gap-1">
            <XCircle className="w-3 h-3" />
            Ausência registrada
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
            <HelpCircle className="w-3 h-3" />
            Aguardando confirmação
          </Badge>
        );
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
              <Card key={schedule.id} className="p-4 relative overflow-hidden">
                {/* Church logo badge */}
                {schedule.church_logo_url && (
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background border-2 border-primary/20 overflow-hidden shadow-md">
                    <img 
                      src={schedule.church_logo_url} 
                      alt={schedule.church_name || 'Igreja'} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between pr-10">
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
                      {schedule.church_name && (
                        <div className="flex items-center gap-1 text-xs text-primary/80 mt-1 justify-end">
                          <Church className="w-3 h-3" />
                          {schedule.church_name}
                        </div>
                      )}
                      {schedule.sector_name && (
                        <div className="flex items-center gap-1.5 text-xs mt-1 justify-end">
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
                  </div>
                  
                  {/* Status and Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    {getStatusBadge(schedule.confirmation_status)}
                    
                    {schedule.confirmation_status === 'pending' && schedule.confirmation_token && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => openDeclineDialog(schedule)}
                          disabled={decliningId === schedule.id}
                        >
                          {decliningId === schedule.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-1" />
                              Não poderei
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleConfirm(schedule)}
                          disabled={confirmingId === schedule.id}
                        >
                          {confirmingId === schedule.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Confirmar
                            </>
                          )}
                        </Button>
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

      {/* Decline Dialog */}
      <AlertDialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar Ausência</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedScheduleForDecline && (
                <>
                  Confirmar que você não poderá comparecer no dia{' '}
                  <strong>
                    {format(parseISO(selectedScheduleForDecline.date), "d 'de' MMMM", { locale: ptBR })}
                  </strong>
                  ?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Motivo (opcional):
            </label>
            <Textarea
              placeholder="Ex: Compromisso familiar, viagem..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={2}
            />
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDecline}
              className="bg-red-600 hover:bg-red-700"
              disabled={decliningId !== null}
            >
              {decliningId ? 'Registrando...' : 'Confirmar Ausência'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
