import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Calendar, Loader2, CheckCircle2, AlertCircle, Users, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { slugify } from '@/lib/slugify';

interface Department {
  id: string;
  name: string;
  description: string | null;
  leader_id: string;
}

export default function JoinDepartment() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [joined, setJoined] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!inviteCode) {
      setError('Link de convite inválido');
      setLoading(false);
      return;
    }
    
    fetchDepartment();
  }, [inviteCode]);

  useEffect(() => {
    if (user && department) {
      checkMembership();
    }
  }, [user, department]);

  const fetchDepartment = async () => {
    try {
      // Use secure RPC function that only returns public info (no Stripe data)
      const { data, error } = await supabase
        .rpc('get_department_by_invite_code', { code: inviteCode })
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('Este link de convite não existe ou expirou');
        setLoading(false);
        return;
      }

      // RPC returns only id, name, description - leader_id not exposed
      setDepartment({ ...data, leader_id: '' } as Department);
    } catch (err) {
      console.error('Error fetching department:', err);
      setError('Erro ao carregar informações do departamento');
    } finally {
      setLoading(false);
    }
  };

  const checkMembership = async () => {
    if (!user || !department) return;

    const { data } = await supabase
      .from('members')
      .select('id')
      .eq('department_id', department.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setAlreadyMember(true);
    }
  };

  const handleJoin = async () => {
    if (authLoading) return;

    if (!user) {
      // Save invite code and redirect to conecte-se
      sessionStorage.setItem('pendingInvite', inviteCode || '');
      navigate('/conecte-se');
      return;
    }

    if (!inviteCode) return;

    setJoining(true);

    try {
      // Use secure RPC function that validates invite code server-side
      const { data, error } = await supabase
        .rpc('join_department_by_invite', { invite_code: inviteCode })
        .single();

      if (error) throw error;

      if (!data.success) {
        if (data.message === 'Already a member of this department') {
          setAlreadyMember(true);
          // Update department info from response
          if (data.department_id && data.department_name) {
            setDepartment(prev => prev ? { ...prev, id: data.department_id, name: data.department_name } : prev);
          }
          return;
        }
        throw new Error(data.message || 'Failed to join department');
      }

      // Update department info from the secure response
      if (data.department_id && data.department_name) {
        setDepartment(prev => prev ? { ...prev, id: data.department_id, name: data.department_name } : prev);
      }

      // Update subscription quantity for new member
      try {
        await supabase.functions.invoke('update-subscription-quantity', {
          body: { departmentId: data.department_id },
        });
      } catch (subError) {
        console.error('Error updating subscription:', subError);
        // Don't fail the join if subscription update fails
      }

      setJoined(true);
      toast({
        title: 'Você entrou no departamento!',
        description: `Agora você faz parte de ${data.department_name}.`,
      });
    } catch (err) {
      console.error('Error joining department:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao entrar no departamento',
        description: 'Tente novamente em alguns instantes.',
      });
    } finally {
      setJoining(false);
    }
  };

  // Check for pending invite after login
  useEffect(() => {
    if (user && !authLoading && department && !alreadyMember && !joined) {
      const pendingInvite = sessionStorage.getItem('pendingInvite');
      if (pendingInvite === inviteCode) {
        sessionStorage.removeItem('pendingInvite');
        handleJoin();
      }
    }
  }, [user, authLoading, department, alreadyMember, joined]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
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
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            Link inválido
          </h1>
          <p className="text-muted-foreground mb-8">
            {error}
          </p>
          <Link to="/">
            <Button className="gradient-primary text-primary-foreground">
              Ir para o início
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            Você entrou! 🎉
          </h1>
          <p className="text-muted-foreground mb-8">
            Agora você faz parte de <strong>{department?.name}</strong>.
            Você pode ver as escalas e receber notificações.
          </p>
          <Link to={`/d/${department?.name ? slugify(department.name) : ''}`}>
            <Button className="gradient-primary text-primary-foreground shadow-glow-sm hover:shadow-glow transition-all">
              Ver departamento
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (alreadyMember) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            Você já é membro!
          </h1>
          <p className="text-muted-foreground mb-8">
            Você já faz parte de <strong>{department?.name}</strong>.
          </p>
          <Link to={`/d/${department?.name ? slugify(department.name) : ''}`}>
            <Button className="gradient-primary text-primary-foreground shadow-glow-sm hover:shadow-glow transition-all">
              Ir para o departamento
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute inset-0 gradient-radial opacity-40" />
      
      <div className="relative max-w-md w-full animate-fade-in">
        <div className="glass rounded-3xl p-8 shadow-2xl border border-border/50">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow">
              <Calendar className="w-8 h-8 text-primary-foreground" />
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">Você foi convidado para</p>
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">
              {department?.name}
            </h1>
            {department?.description && (
              <p className="text-muted-foreground">
                {department.description}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {user ? (
              <Button 
                onClick={handleJoin}
                className="w-full h-12 gradient-primary text-primary-foreground shadow-glow-sm hover:shadow-glow transition-all"
                disabled={joining}
              >
                {joining ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar no departamento
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button 
                  onClick={handleJoin}
                  className="w-full h-12 gradient-primary text-primary-foreground shadow-glow-sm hover:shadow-glow transition-all"
                >
                  Criar conta e entrar
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Link to={`/entrar?redirect=/join/${inviteCode}`} className="block">
                  <Button variant="ghost" className="w-full">
                    Já tenho uma conta
                  </Button>
                </Link>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Ao entrar, você poderá visualizar as escalas e receber notificações.
          </p>
        </div>
      </div>
    </div>
  );
}
