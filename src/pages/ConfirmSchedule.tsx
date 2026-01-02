import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertCircle, Loader2, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ConfirmationStatus = 'pending' | 'confirmed' | 'declined';

interface ScheduleInfo {
  id: string;
  date: string;
  time_start: string;
  time_end: string;
  confirmation_status: ConfirmationStatus;
  department_name: string;
  user_name: string;
}

export default function ConfirmSchedule() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ action: 'confirm' | 'decline' } | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token inválido');
      setLoading(false);
      return;
    }

    fetchScheduleInfo();
  }, [token]);

  const fetchScheduleInfo = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('schedules')
        .select(`
          id,
          date,
          time_start,
          time_end,
          confirmation_status,
          departments:department_id (name)
        `)
        .eq('confirmation_token', token)
        .single();

      if (fetchError || !data) {
        setError('Este link de confirmação não é válido ou já expirou.');
        return;
      }

      const deptData = data.departments as { name: string } | { name: string }[] | null;

      setSchedule({
        id: data.id,
        date: data.date,
        time_start: data.time_start,
        time_end: data.time_end,
        confirmation_status: data.confirmation_status as ConfirmationStatus,
        department_name: Array.isArray(deptData) ? deptData[0]?.name : deptData?.name || 'Departamento',
        user_name: 'Voluntário',
      });

      // Auto-process if action is in URL
      if (action === 'confirm' || action === 'decline') {
        if (data.confirmation_status !== 'pending') {
          // Already processed
        } else if (action === 'confirm') {
          await handleConfirm();
        } else if (action === 'decline') {
          setShowDeclineForm(true);
        }
      }
    } catch (err) {
      console.error('Error fetching schedule:', err);
      setError('Erro ao carregar informações da escala.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!token) return;
    
    setSubmitting(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-schedule?token=${token}&action=confirm`
      );
      
      if (response.ok) {
        setSuccess({ action: 'confirm' });
        if (schedule) {
          setSchedule({ ...schedule, confirmation_status: 'confirmed' });
        }
      } else {
        setError('Erro ao confirmar presença. Tente novamente.');
      }
    } catch (err) {
      console.error('Error confirming:', err);
      setError('Erro ao confirmar presença.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    
    setSubmitting(true);
    try {
      const reasonParam = declineReason ? `&reason=${encodeURIComponent(declineReason)}` : '';
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-schedule?token=${token}&action=decline${reasonParam}`
      );
      
      if (response.ok) {
        setSuccess({ action: 'decline' });
        if (schedule) {
          setSchedule({ ...schedule, confirmation_status: 'declined' });
        }
      } else {
        setError('Erro ao registrar ausência. Tente novamente.');
      }
    } catch (err) {
      console.error('Error declining:', err);
      setError('Erro ao registrar ausência.');
    } finally {
      setSubmitting(false);
      setShowDeclineForm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/10 to-secondary/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>Link Inválido</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              success.action === 'confirm' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
            }`}>
              {success.action === 'confirm' ? (
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              ) : (
                <XCircle className="w-8 h-8 text-amber-600" />
              )}
            </div>
            <CardTitle>
              {success.action === 'confirm' ? 'Presença Confirmada!' : 'Ausência Registrada'}
            </CardTitle>
            <CardDescription>
              {success.action === 'confirm' 
                ? `Obrigado! Sua presença foi confirmada para ${schedule?.department_name}.`
                : `O líder do ${schedule?.department_name} foi notificado sobre sua indisponibilidade.`
              }
            </CardDescription>
          </CardHeader>
          {schedule && (
            <CardContent className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{format(parseISO(schedule.date), "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{schedule.time_start.slice(0, 5)} às {schedule.time_end.slice(0, 5)}</span>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  if (!schedule) {
    return null;
  }

  // Already processed
  if (schedule.confirmation_status !== 'pending') {
    const isConfirmed = schedule.confirmation_status === 'confirmed';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              isConfirmed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
            }`}>
              {isConfirmed ? (
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              ) : (
                <XCircle className="w-8 h-8 text-amber-600" />
              )}
            </div>
            <CardTitle>Já Processado</CardTitle>
            <CardDescription>
              Esta escala já foi {isConfirmed ? 'confirmada' : 'recusada'} anteriormente.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>Confirme sua Presença</CardTitle>
          <CardDescription>
            {schedule.department_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="font-medium text-center">{schedule.user_name}</p>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{format(parseISO(schedule.date), "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{schedule.time_start.slice(0, 5)} às {schedule.time_end.slice(0, 5)}</span>
            </div>
          </div>

          {showDeclineForm ? (
            <div className="space-y-4">
              <Textarea
                placeholder="Motivo (opcional)"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDeclineForm(false)}
                  disabled={submitting}
                >
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDecline}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirmar Ausência
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Confirmar
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                onClick={() => setShowDeclineForm(true)}
                disabled={submitting}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Não Poderei
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
