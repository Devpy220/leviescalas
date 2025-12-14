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
  Sparkles,
  CreditCard,
  Settings2,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { slugify } from '@/lib/slugify';

interface Department {
  id: string;
  name: string;
  description: string | null;
  leader_id: string;
  invite_code?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  created_at: string;
  member_count?: number;
  avatar_url?: string | null;
}

interface DepartmentWithRole extends Department {
  role: 'leader' | 'member';
}

// Check if a date is within X days from now
const isExpiringWithinDays = (dateStr: string | null | undefined, days: number): boolean => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= days;
};


export default function Dashboard() {
  const [departments, setDepartments] = useState<DepartmentWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [canCreateDepartment, setCanCreateDepartment] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const { user, authEvent, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { isInstallable, install, isIOS, shouldShowInstallPrompt } = usePWAInstall();
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if this is first login
  useEffect(() => {
    if (authEvent === 'SIGNED_IN') {
      const hasLoggedBefore = localStorage.getItem('has-logged-before');
      if (!hasLoggedBefore) {
        setIsFirstLogin(true);
        localStorage.setItem('has-logged-before', 'true');
      }
    }
  }, [authEvent]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchDepartments();
    checkCanCreateDepartment();
    fetchUserName();
  }, [user, navigate]);

  const fetchUserName = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();
    
    if (!error && data) {
      setUserName(data.name);
    }
  };

  const checkCanCreateDepartment = async () => {
    if (!user) return;
    
    // Check if user has any member entries (joined via invite)
    const { data: memberEntries, error } = await supabase
      .from('members')
      .select('role')
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Error checking member status:', error);
      return;
    }

    // User can only create department if they have NO member entries
    // OR if they already have at least one department as leader
    const hasLeaderRole = memberEntries?.some(m => m.role === 'leader');
    const hasOnlyMemberRole = memberEntries?.length > 0 && !hasLeaderRole;
    
    // If user joined via invite (only has member role), they can't create departments
    setCanCreateDepartment(!hasOnlyMemberRole);
  };

  const fetchDepartments = async () => {
    if (!user) return;
    
    try {
      // Fetch departments where user is leader (leaders have direct SELECT access)
      // Using 'as any' because avatar_url column was just added and types aren't regenerated yet
      const { data: leaderDepts, error: leaderError } = await supabase
        .from('departments')
        .select('*')
        .eq('leader_id', user.id) as any;

      if (leaderError) throw leaderError;

      // Fetch member relationships
      const { data: memberRelations, error: memberError } = await supabase
        .from('members')
        .select('department_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      // Get all department IDs to fetch member counts
      const allDeptIds = [
        ...(leaderDepts || []).map((d: any) => d.id),
        ...(memberRelations || []).map(r => r.department_id)
      ];

      // Fetch member counts for all departments (count all members including leader)
      const memberCounts: Record<string, number> = {};
      for (const deptId of allDeptIds) {
        const { count, error: countError } = await supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('department_id', deptId);
        
        if (!countError) {
          memberCounts[deptId] = count || 0;
        }
      }

      // For member departments, use secure function to get basic info
      const memberDepartments: DepartmentWithRole[] = [];
      
      if (memberRelations) {
        for (const relation of memberRelations) {
          // Skip if user is also leader of this department
          if (leaderDepts?.some((d: any) => d.id === relation.department_id)) continue;
          
          const { data: deptData, error: deptError } = await supabase
            .rpc('get_department_basic', { dept_id: relation.department_id });
          
          if (!deptError && deptData && deptData.length > 0) {
            const dept = deptData[0] as any;
            memberDepartments.push({
              id: dept.id,
              name: dept.name,
              description: dept.description,
              leader_id: dept.leader_id,
              created_at: dept.created_at,
              avatar_url: dept.avatar_url || null,
              member_count: memberCounts[dept.id] || 0,
              role: 'member' as const
            });
          }
        }
      }

      // Combine leader and member departments
      const leaderDepartments: DepartmentWithRole[] = (leaderDepts || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        leader_id: d.leader_id,
        invite_code: d.invite_code,
        subscription_status: d.subscription_status,
        trial_ends_at: d.trial_ends_at,
        created_at: d.created_at,
        avatar_url: d.avatar_url || null,
        member_count: memberCounts[d.id] || 0,
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

  // Check if any department has expiring trial or subscription (within 3 days)
  const hasPaymentWarning = departments.some(dept => {
    if (dept.role !== 'leader') return false;
    
    // Trial expiring soon
    if (dept.subscription_status === 'trial' && isExpiringWithinDays(dept.trial_ends_at, 3)) {
      return true;
    }
    
    // Expired or cancelled subscription
    if (dept.subscription_status === 'expired' || dept.subscription_status === 'cancelled') {
      return true;
    }
    
    return false;
  });

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
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-primary"
                onClick={() => navigate('/admin')}
                title="Painel Admin"
              >
                <Settings2 className="w-5 h-5" />
              </Button>
            )}
            {shouldShowInstallPrompt() && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-primary relative"
                onClick={() => setShowInstallDialog(true)}
                title="Instalar App"
              >
                <Download className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground relative"
              onClick={() => navigate('/payment')}
              title="Pagamento"
            >
              <CreditCard className="w-5 h-5" />
              {hasPaymentWarning && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-destructive rounded-full animate-pulse" />
              )}
            </Button>
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
        {/* Welcome section - Centered */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            <span>Dashboard</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Olá, {userName || 'bem-vindo'}! 👋
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus departamentos e escalas em um só lugar.
          </p>
        </div>

        {/* Department Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {/* Create department CTA - Only for non-invited users */}
          {canCreateDepartment ? (
            <Link to="/departments/new" className="block">
              <div className="relative group h-full">
                <div className="absolute inset-0 gradient-vibrant rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
                <div className="relative glass rounded-2xl p-6 border-2 border-dashed border-primary/30 hover:border-primary/50 transition-all hover-lift h-full flex items-center">
                  <div className="flex items-center gap-4 w-full">
                    <div className="w-14 h-14 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all">
                      <Plus className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display text-xl font-semibold text-foreground mb-1">
                        Criar Novo Departamento
                      </h3>
                      <p className="text-muted-foreground">
                        R$ 25,00/mês • 7 dias grátis
                      </p>
                    </div>
                    <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="relative group h-full">
              <div className="absolute inset-0 gradient-vibrant rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
              <div className="relative glass rounded-2xl p-6 border-2 border-dashed border-primary/30 transition-all hover-lift h-full flex items-center">
                <div className="flex items-center gap-4 w-full">
                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center transition-transform group-hover:scale-110">
                    <User className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                      Conta de Membro
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Para criar departamentos, registre uma nova conta.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Department cards aligned next to create card */}
          {loading ? (
            <>
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-48 rounded-2xl" />
              ))}
            </>
          ) : (
            departments.map((dept) => (
              <DepartmentCard key={dept.id} department={dept} />
            ))
          )}
        </div>

        {/* Empty state */}
        {!loading && departments.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl gradient-vibrant flex items-center justify-center mx-auto mb-6 opacity-50">
              <Calendar className="w-10 h-10 text-white" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">
              Nenhum departamento ainda
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              {canCreateDepartment 
                ? 'Crie seu primeiro departamento ou peça um convite para participar de um existente.'
                : 'Peça um convite para participar de um departamento existente.'}
            </p>
            {canCreateDepartment && (
              <Link to="/departments/new">
                <Button className="gradient-vibrant text-white shadow-glow-sm hover:shadow-glow transition-all">
                  <Plus className="w-5 h-5 mr-2" />
                  Criar Departamento
                </Button>
              </Link>
            )}
          </div>
        )}
      </main>
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt 
        isFirstLogin={isFirstLogin} 
        open={showInstallDialog} 
        onOpenChange={setShowInstallDialog} 
      />
    </div>
  );
}

function DepartmentCard({ department }: { department: DepartmentWithRole }) {
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

  const departmentSlug = slugify(department.name);

  return (
    <Link to={`/departamento/${departmentSlug}`}>
      <div className="relative group h-full">
        <div className="absolute inset-0 gradient-vibrant rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
        <div className="relative glass rounded-2xl p-6 border-2 border-dashed border-primary/30 hover:border-primary/50 transition-all hover-lift h-full">
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl overflow-hidden ${department.avatar_url ? '' : 'gradient-vibrant'} flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all`}>
              {department.avatar_url ? (
                <img src={department.avatar_url} alt={department.name} className="w-full h-full object-cover" />
              ) : (
                <Calendar className="w-6 h-6 text-white" />
              )}
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
              <span>{department.member_count || 0} voluntário{(department.member_count || 0) !== 1 ? 's' : ''}</span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Criado em {new Date(department.created_at).toLocaleDateString('pt-BR')}
            </span>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </div>
    </Link>
  );
}