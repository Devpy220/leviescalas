import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Footer from '@/components/Footer';
import { Eye, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function JoinCoordinator() {
  const { code } = useParams<{ code: string }>();
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyCoord, setAlreadyCoord] = useState(false);
  const [joined, setJoined] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!code) {
      setError('Link de convite inválido');
      setLoading(false);
      return;
    }
    validateCode();
  }, [code]);

  const validateCode = async () => {
    try {
      const { data, error } = await (supabase as any)
        .rpc('validate_coordinator_code_secure', { p_code: code })
        .maybeSingle();
      if (error) throw error;
      if (!data?.is_valid) {
        setError('Este link de coordenador não existe ou expirou');
      } else {
        setDepartmentName(data.department_name);
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao validar o link');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (authLoading) return;
    if (!user) {
      sessionStorage.setItem('pendingCoordInvite', code || '');
      navigate(`/auth?tab=login&redirect=/join-coordinator/${code}`);
      return;
    }
    if (!code) return;

    setJoining(true);
    try {
      const { data, error } = await (supabase as any)
        .rpc('join_department_as_coordinator', { p_code: code })
        .single();
      if (error) throw error;
      if (!data.success) {
        if (data.message === 'Already a coordinator of this department') {
          setAlreadyCoord(true);
          setDepartmentId(data.department_id);
          setDepartmentName(data.department_name);
          return;
        }
        throw new Error(data.message || 'Falha ao entrar como coordenador');
      }
      setDepartmentId(data.department_id);
      setDepartmentName(data.department_name);
      setJoined(true);
      toast({
        title: 'Você é coordenador!',
        description: `Acesso somente leitura às escalas de ${data.department_name}.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: err?.message || 'Tente novamente em alguns instantes.',
      });
    } finally {
      setJoining(false);
    }
  };

  // Auto-join after login if there is a pending invite
  useEffect(() => {
    if (user && !authLoading && departmentName && !alreadyCoord && !joined && !joining) {
      const pending = sessionStorage.getItem('pendingCoordInvite');
      if (pending === code) {
        sessionStorage.removeItem('pendingCoordInvite');
        setTimeout(() => handleJoin(), 500);
      }
    }
  }, [user, authLoading, departmentName, alreadyCoord, joined, joining, code]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Link inválido</h1>
          <p className="text-muted-foreground mb-8">{error}</p>
          <Link to="/">
            <Button className="gradient-primary text-primary-foreground">Ir para o início</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (joined || alreadyCoord) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            {joined ? 'Tudo certo!' : 'Você já é coordenador'}
          </h1>
          <p className="text-muted-foreground mb-8">
            Você tem acesso somente leitura às escalas de <strong>{departmentName}</strong>.
          </p>
          <Link to={departmentId ? `/departments/${departmentId}` : '/dashboard'}>
            <Button className="gradient-primary text-primary-foreground shadow-glow-sm hover:shadow-glow transition-all">
              Ver escalas
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute inset-0 gradient-radial opacity-40" />
        <div className="relative max-w-md w-full animate-fade-in">
          <div className="glass rounded-3xl p-8 shadow-2xl border border-border/50">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow">
                <Eye className="w-8 h-8 text-primary-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">Convite de coordenador</p>
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">{departmentName}</h1>
              <p className="text-muted-foreground text-sm">
                Acesso <strong>somente leitura</strong> às escalas. Você não recebe notificações nem aparece em escalas.
              </p>
            </div>
            <div className="space-y-3">
              {user ? (
                <Button onClick={handleJoin} className="w-full h-12 gradient-primary text-primary-foreground" disabled={joining}>
                  {joining ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Entrando...</> : <>Entrar como coordenador<ArrowRight className="w-5 h-5 ml-2" /></>}
                </Button>
              ) : (
                <Button onClick={handleJoin} className="w-full h-12 gradient-primary text-primary-foreground">
                  Fazer login e continuar
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
