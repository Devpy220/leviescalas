import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Calendar, 
  Users, 
  LogOut, 
  Shield, 
  ChevronRight,
  Crown,
  User,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Department {
  id: string;
  name: string;
  description: string | null;
  leader_id: string;
  invite_code?: string | null; // Only available for leaders
  subscription_status?: string | null; // Only available for leaders
  created_at: string;
  member_count?: number;
}

interface DepartmentWithRole extends Department {
  role: 'leader' | 'member';
}

const cardColors = [
  'from-violet-500/10 to-violet-600/5 border-violet-500/20',
  'from-rose-500/10 to-rose-600/5 border-rose-500/20',
  'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
  'from-amber-500/10 to-amber-600/5 border-amber-500/20',
  'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20',
];

const iconColors = [
  'icon-violet',
  'icon-rose',
  'icon-emerald',
  'icon-amber',
  'icon-cyan',
];

export default function Dashboard() {
  const [departments, setDepartments] = useState<DepartmentWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchDepartments();
  }, [user, navigate]);

  const fetchDepartments = async () => {
    if (!user) return;
    
    try {
      // Fetch departments where user is leader (leaders have direct SELECT access)
      const { data: leaderDepts, error: leaderError } = await supabase
        .from('departments')
        .select('id, name, description, leader_id, invite_code, subscription_status, created_at')
        .eq('leader_id', user.id);

      if (leaderError) throw leaderError;

      // Fetch member relationships
      const { data: memberRelations, error: memberError } = await supabase
        .from('members')
        .select('department_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      // For member departments, use secure function to get basic info
      const memberDepartments: DepartmentWithRole[] = [];
      
      if (memberRelations) {
        for (const relation of memberRelations) {
          // Skip if user is also leader of this department
          if (leaderDepts?.some(d => d.id === relation.department_id)) continue;
          
          const { data: deptData, error: deptError } = await supabase
            .rpc('get_department_basic', { dept_id: relation.department_id });
          
          if (!deptError && deptData && deptData.length > 0) {
            memberDepartments.push({
              ...deptData[0],
              role: 'member' as const
            });
          }
        }
      }

      // Combine leader and member departments
      const leaderDepartments: DepartmentWithRole[] = (leaderDepts || []).map(d => ({
        ...d,
        role: 'leader' as const
      }));

      setDepartments([...leaderDepartments, ...memberDepartments]);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar departamentos',
        description: 'Tente recarregar a página.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const leaderDepartments = departments.filter(d => d.role === 'leader');
  const memberDepartments = departments.filter(d => d.role === 'member');

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">LEVI</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground"
              onClick={() => navigate('/security')}
              title="Segurança"
            >
              <Shield className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="w-5 h-5" />
            </Button>
            <Avatar className="w-9 h-9 border-2 border-primary/20">
              <AvatarFallback className="gradient-vibrant text-white text-sm font-medium">
                {user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome section */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            <span>Dashboard</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Olá, bem-vindo! 👋
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus departamentos e escalas em um só lugar.
          </p>
        </div>

        {/* Create department CTA */}
        <Link 
          to="/departments/new"
          className="block mb-10"
        >
          <div className="relative group">
            <div className="absolute inset-0 gradient-vibrant rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className="relative glass rounded-2xl p-6 border-2 border-dashed border-primary/30 hover:border-primary/50 transition-all hover-lift">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all">
                  <Plus className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-xl font-semibold text-foreground mb-1">
                    Criar Novo Departamento
                  </h3>
                  <p className="text-muted-foreground">
                    R$ 10,00/mês • 7 dias grátis
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          </div>
        </Link>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Leader departments */}
            {leaderDepartments.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg icon-violet flex items-center justify-center">
                    <Crown className="w-4 h-4" />
                  </div>
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    Meus Departamentos
                  </h2>
                  <span className="px-2 py-0.5 rounded-full gradient-vibrant text-white text-sm font-medium">
                    {leaderDepartments.length}
                  </span>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {leaderDepartments.map((dept, index) => (
                    <DepartmentCard key={dept.id} department={dept} colorIndex={index} />
                  ))}
                </div>
              </section>
            )}

            {/* Member departments */}
            {memberDepartments.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    Participo Como Membro
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-sm font-medium">
                    {memberDepartments.length}
                  </span>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {memberDepartments.map((dept, index) => (
                    <DepartmentCard key={dept.id} department={dept} colorIndex={index + leaderDepartments.length} />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {departments.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl gradient-vibrant flex items-center justify-center mx-auto mb-6 opacity-50">
                  <Calendar className="w-10 h-10 text-white" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                  Nenhum departamento ainda
                </h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Crie seu primeiro departamento ou peça um convite para participar de um existente.
                </p>
                <Link to="/departments/new">
                  <Button className="gradient-vibrant text-white shadow-glow-sm hover:shadow-glow transition-all">
                    <Plus className="w-5 h-5 mr-2" />
                    Criar Departamento
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function DepartmentCard({ department, colorIndex }: { department: DepartmentWithRole; colorIndex: number }) {
  const statusConfig = {
    active: { bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Ativo' },
    trial: { bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Teste' },
    pending: { bg: 'bg-muted text-muted-foreground', label: 'Pendente' },
    expired: { bg: 'bg-destructive/10 text-destructive', label: 'Expirado' },
    cancelled: { bg: 'bg-destructive/10 text-destructive', label: 'Cancelado' },
  };

  const status = department.subscription_status 
    ? (statusConfig[department.subscription_status as keyof typeof statusConfig] || statusConfig.pending)
    : null;
  const cardColor = cardColors[colorIndex % cardColors.length];
  const iconColor = iconColors[colorIndex % iconColors.length];

  return (
    <Link to={`/departments/${department.id}`}>
      <div className={`group bg-gradient-to-br ${cardColor} border rounded-2xl p-6 hover-lift cursor-pointer animate-fade-in`}>
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl ${iconColor} flex items-center justify-center transition-transform group-hover:scale-110`}>
            <Calendar className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2">
            {department.role === 'leader' && (
              <div className="w-6 h-6 rounded-full gradient-vibrant flex items-center justify-center">
                <Crown className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            {status && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bg}`}>
                {status.label}
              </span>
            )}
          </div>
        </div>
        
        <h3 className="font-display text-lg font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
          {department.name}
        </h3>
        
        {department.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {department.description}
          </p>
        )}
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>{department.member_count || 0} membros</span>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Criado em {new Date(department.created_at).toLocaleDateString('pt-BR')}
          </span>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </Link>
  );
}