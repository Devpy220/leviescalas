import { useState, useEffect } from 'react';
import Footer from '@/components/Footer';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Calendar, 
  Users, 
  ChevronRight,
  Crown,
  User,
  Loader2,
  Sparkles,
  Heart,
  Church
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { DashboardSidebar } from '@/components/DashboardSidebar';

import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useIsMobile } from '@/hooks/use-mobile';
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
  church_id?: string | null;
  church_name?: string | null;
  church_logo_url?: string | null;
}

interface DepartmentWithRole extends Department {
  role: 'leader' | 'member';
}



export default function Dashboard() {
  const [departments, setDepartments] = useState<DepartmentWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [canCreateDepartment, setCanCreateDepartment] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const { user, session, loading: authLoading, authEvent, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { isInstallable, install, isIOS, shouldShowInstallPrompt } = usePWAInstall();
  const isMobile = useIsMobile();
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // CRITICAL: Use fallback to prevent infinite loading when user state is delayed
  const currentUser = user ?? session?.user ?? null;

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
    // Wait for auth to finish loading
    if (authLoading) return;

    // If we have a user, fetch data (ProtectedRoute ensures user exists)
    if (currentUser) {
      const fetchData = async () => {
        await Promise.all([
          fetchDepartments(),
          checkCanCreateDepartment(),
          fetchUserName(),
        ]);
      };
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, authLoading]);

  const fetchUserName = async () => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', currentUser.id)
      .maybeSingle();
    
    if (!error && data) {
      setUserName(data.name);
      setUserAvatarUrl(data.avatar_url);
    }
  };

  const checkCanCreateDepartment = async () => {
    if (!currentUser) return;
    
    // Check if user is a church leader
    const { data: churches, error: churchError } = await supabase
      .from('churches')
      .select('id')
      .eq('leader_id', currentUser.id)
      .limit(1);
    
    if (churchError) {
      console.error('Error checking church leader status:', churchError);
      return;
    }

    // If user is a church leader, they can create departments
    if (churches && churches.length > 0) {
      setCanCreateDepartment(true);
      return;
    }

    // Check if user is a leader of any department
    const { data: leaderDepts, error: leaderError } = await supabase
      .from('departments')
      .select('id')
      .eq('leader_id', currentUser.id)
      .limit(1);
    
    if (leaderError) {
      console.error('Error checking leader status:', leaderError);
      return;
    }

    // Only department/church leaders can create new departments
    // New accounts and members who joined via invite cannot create
    setCanCreateDepartment(leaderDepts && leaderDepts.length > 0);
  };

  const fetchDepartments = async () => {
    if (!currentUser) return;
    
    try {
      // Fetch departments where user is leader (leaders have direct SELECT access)
      const { data: leaderDepts, error: leaderError } = await supabase
        .from('departments')
        .select('*')
        .eq('leader_id', currentUser.id) as any;

      if (leaderError) throw leaderError;

      // Fetch member relationships
      const { data: memberRelations, error: memberError } = await supabase
        .from('members')
        .select('department_id')
        .eq('user_id', currentUser.id);

      if (memberError) throw memberError;

      // Get all department IDs to fetch member counts
      const allDeptIds = [
        ...(leaderDepts || []).map((d: any) => d.id),
        ...(memberRelations || []).map(r => r.department_id)
      ];

      // Fetch member counts for all departments
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

      // Fetch church info for all departments
      const churchIds = [...new Set((leaderDepts || []).map((d: any) => d.church_id).filter(Boolean))] as string[];
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
            
            // Fetch church info for member department if it has a church_id
            let churchInfo = null;
            if (dept.church_id) {
              if (!churchMap[dept.church_id]) {
                const { data: churchData } = await supabase
                  .from('churches')
                  .select('id, name, logo_url')
                  .eq('id', dept.church_id)
                  .maybeSingle();
                
                if (churchData) {
                  churchMap[churchData.id] = { name: churchData.name, logo_url: churchData.logo_url };
                }
              }
              churchInfo = churchMap[dept.church_id];
            }
            
            memberDepartments.push({
              id: dept.id,
              name: dept.name,
              description: dept.description,
              leader_id: dept.leader_id,
              created_at: dept.created_at,
              avatar_url: dept.avatar_url || null,
              member_count: memberCounts[dept.id] || 0,
              church_id: dept.church_id || null,
              church_name: churchInfo?.name || null,
              church_logo_url: churchInfo?.logo_url || null,
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
        church_id: d.church_id || null,
        church_name: d.church_id ? churchMap[d.church_id]?.name : null,
        church_logo_url: d.church_id ? churchMap[d.church_id]?.logo_url : null,
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


  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar 
        isAdmin={isAdmin}
        shouldShowInstallPrompt={shouldShowInstallPrompt()}
        onInstallClick={() => setShowInstallDialog(true)}
        onSignOut={handleSignOut}
      />

      <div className={isMobile ? '' : 'ml-64'}>
        <main className="container mx-auto px-4 py-8">

        {/* Welcome section - Centered */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-medium mb-4">
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
                <div className="absolute inset-0 gradient-fresh rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
                <div className="relative glass rounded-2xl p-6 border-2 border-dashed border-accent/30 hover:border-accent/50 transition-all hover-lift h-full flex items-center">
                  <div className="flex items-center gap-4 w-full">
                    <div className="w-14 h-14 rounded-xl gradient-fresh flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all">
                      <Plus className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display text-xl font-semibold text-foreground mb-1">
                        Criar Novo Departamento
                      </h3>
                      <p className="text-muted-foreground">
                        100% Gratuito • Apoie o projeto
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

        {/* Support LEVI Section */}
        <div className="mt-12 mb-8">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-rose-500/20 to-primary/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className="relative glass rounded-2xl p-6 border-2 border-rose-500/30 hover:border-rose-500/50 transition-all">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-16 h-16 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                  <Heart className="w-8 h-8 text-rose-500 animate-pulse" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-display text-xl font-semibold text-foreground mb-1">
                    Apoie o Projeto LEVI
                  </h3>
                  <p className="text-muted-foreground text-sm mb-3">
                    O LEVI é 100% gratuito. Sua contribuição voluntária ajuda a manter o projeto disponível para todos.
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    <Sparkles className="w-3 h-3" />
                    <span>Sugestão: R$ 10,00</span>
                  </div>
                </div>
                <Link to="/payment">
                  <Button className="bg-rose-500 hover:bg-rose-600 text-white shadow-lg hover:shadow-xl transition-all gap-2">
                    <Heart className="w-4 h-4" />
                    Apoie o LEVI
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        </main>
      
        <Footer />
      
        {/* PWA Install Prompt */}
        <PWAInstallPrompt 
          isFirstLogin={isFirstLogin} 
          open={showInstallDialog} 
          onOpenChange={setShowInstallDialog} 
        />
      </div>
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
          {/* Church logo badge */}
          {department.church_logo_url && (
            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-background border-2 border-primary/20 overflow-hidden shadow-lg z-10">
              <img 
                src={department.church_logo_url} 
                alt={department.church_name || 'Igreja'} 
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
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
          
          {/* Church name */}
          {department.church_name && (
            <div className="flex items-center gap-1.5 text-xs text-primary/80 mb-2">
              <Church className="w-3 h-3" />
              <span>{department.church_name}</span>
            </div>
          )}
          
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