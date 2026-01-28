import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft,
  Calendar,
  Users,
  Settings,
  Crown,
  Loader2,
  Clock,
  Layers,
  Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import MemberList from '@/components/department/MemberList';
import SectorManagement from '@/components/department/SectorManagement';
import AddScheduleDialog from '@/components/department/AddScheduleDialog';
import InviteMemberDialog from '@/components/department/InviteMemberDialog';
import DepartmentAvatar from '@/components/department/DepartmentAvatar';
import DepartmentSettingsDialog from '@/components/department/DepartmentSettingsDialog';
import SmartScheduleDialog from '@/components/department/SmartScheduleDialog';
import AvailabilityCalendar from '@/components/department/AvailabilityCalendar';
import MemberPreferences from '@/components/department/MemberPreferences';
import SlotAvailability from '@/components/department/SlotAvailability';
import LeaderAvailabilityView from '@/components/department/LeaderAvailabilityView';
import LeaderSlotAvailabilityView from '@/components/department/LeaderSlotAvailabilityView';
import UnifiedScheduleView from '@/components/department/UnifiedScheduleView';
import MyAvailabilitySheet from '@/components/department/MyAvailabilitySheet';
import ActionSidebar from '@/components/department/ActionSidebar';
import { exportToPDF, exportToExcel } from '@/lib/exportSchedules';
import { SupportNotification } from '@/components/SupportNotification';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Department {
  id: string;
  name: string;
  description: string | null;
  leader_id: string;
  invite_code: string;
  subscription_status: string;
  trial_ends_at: string | null;
  created_at: string;
  avatar_url: string | null;
  stripe_customer_id: string | null;
}

// Check if trial has expired
const isTrialExpired = (status: string | null, trialEndsAt: string | null): boolean => {
  if (status !== 'trial' || !trialEndsAt) return false;
  return new Date(trialEndsAt) < new Date();
};

// Check if subscription is inactive
const isSubscriptionInactive = (status: string | null, trialEndsAt: string | null): boolean => {
  if (status === 'active') return false;
  if (status === 'expired' || status === 'cancelled') return true;
  if (status === 'trial' && trialEndsAt) {
    return new Date(trialEndsAt) < new Date();
  }
  return false;
};

interface Member {
  id: string;
  user_id: string;
  role: 'leader' | 'member';
  joined_at: string;
  profile: {
    name: string;
    email: string;
    whatsapp: string;
    avatar_url: string | null;
  };
}

interface Schedule {
  id: string;
  user_id: string;
  date: string;
  time_start: string;
  time_end: string;
  notes: string | null;
  sector_id: string | null;
  confirmation_status?: 'pending' | 'confirmed' | 'declined';
  decline_reason?: string | null;
  profile?: {
    name: string;
    avatar_url: string | null;
  };
  sector?: {
    name: string;
    color: string;
  } | null;
}

export default function Department() {
  const [showAvailabilitySheet, setShowAvailabilitySheet] = useState(false);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, session, loading: authLoading, ensureSession } = useAuth();
  const { toast } = useToast();
  
  // Use session.user as fallback when user state hasn't updated yet
  const currentUser = user ?? session?.user;
  
  const [department, setDepartment] = useState<Department | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSmartSchedule, setShowSmartSchedule] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('dept-sidebar-open');
    return saved !== null ? saved === 'true' : true;
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    // Debug: track loading state
    console.log('[Department] State:', { authLoading, loading, hasUser: !!currentUser, hasId: !!id });
    
    // Wait for auth to finish loading
    if (authLoading) return;
    
    // No department ID - nothing to load
    if (!id) {
      setLoading(false);
      return;
    }
    
    // No user available - wait for ProtectedRoute to handle redirect
    if (!currentUser) {
      setLoading(false);
      return;
    }
    
    // Safety timeout to prevent infinite loading (reduced to 8s for faster feedback)
    const safetyTimeout = setTimeout(() => {
      console.warn('[Department] Safety timeout triggered');
      setLoadError('Tempo limite excedido. Recarregue a página.');
      setLoading(false);
    }, 8000);
    
    // Load data with proper error handling
    // NOTE: ProtectedRoute already ensures valid session, no need to call ensureSession() again
    const loadData = async () => {
      setLoading(true);
      setLoadError(null);
      
      try {
        // Fetch department first - if this fails, no point continuing
        await fetchDepartment();
        
        // Fetch members and schedules in parallel
        await Promise.all([fetchMembers(), fetchSchedules()]);
      } catch (error) {
        console.error('Error loading department data:', error);
        setLoadError('Erro ao carregar departamento.');
      } finally {
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    };
    
    loadData();
    
    return () => clearTimeout(safetyTimeout);
  }, [currentUser?.id, id, authLoading]);

  const fetchDepartment = async () => {
    if (!id) return;
    
    try {
      // Use secure function that conditionally returns stripe data based on role
      const { data, error } = await supabase
        .rpc('get_department_secure', { dept_id: id })
        .single();

      if (error) throw error;
      if (!data) throw new Error('Department not found');

      // Check if subscription is inactive (expired trial or cancelled)
      const subscriptionInactive = isSubscriptionInactive(data.subscription_status, data.trial_ends_at);
      
      if (subscriptionInactive && data.leader_id === user?.id) {
        toast({
          variant: 'destructive',
          title: 'Assinatura expirada',
          description: 'Seu período de teste expirou. Renove para continuar usando.',
        });
        navigate('/payment');
        return;
      }
      
      setDepartment({
        id: data.id,
        name: data.name,
        description: data.description,
        leader_id: data.leader_id,
        invite_code: data.invite_code || '',
        subscription_status: data.subscription_status,
        trial_ends_at: data.trial_ends_at || null,
        created_at: data.created_at,
        avatar_url: (data as any).avatar_url || null,
        stripe_customer_id: data.stripe_customer_id || null
      });
      setIsLeader(data.leader_id === currentUser?.id);
    } catch (error: any) {
      console.error('Error fetching department:', error);
      
      // Check if it's an auth error
      if (error?.code === '401' || error?.message?.includes('JWT')) {
        setLoadError('Sessão expirada. Faça login novamente.');
      } else {
        toast({
          variant: 'destructive',
          title: 'Departamento não encontrado',
          description: 'Verifique se você tem acesso a este departamento.',
        });
        navigate('/dashboard');
      }
      throw error; // Re-throw to be caught by loadData
    }
  };

  const fetchMembers = async () => {
    if (!id) return;
    
    try {
      // NOTE: ProtectedRoute already ensures valid session, no redundant ensureSession() call

      // Use secure function that only returns non-sensitive profile data
      const { data: basicProfiles, error: profilesError } = await supabase
        .rpc('get_department_member_profiles', { dept_id: id });

      if (profilesError) {
        console.error('Error fetching member profiles:', profilesError);
        // Don't throw - try to continue with member records
      }

      // Get member records for IDs and joined_at
      const { data: memberRecords, error: membersError } = await supabase
        .from('members')
        .select('id, user_id, role, joined_at')
        .eq('department_id', id);

      if (membersError) {
        console.error('Error fetching member records:', membersError);
        throw membersError;
      }

      // Combine the data
      const formattedMembers = (memberRecords || []).map(m => {
        const profile = basicProfiles?.find((p: any) => p.id === m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role as 'leader' | 'member',
          joined_at: m.joined_at,
          profile: {
            name: profile?.name || 'Usuário',
            email: '', // Protected - only leaders can see via separate call
            whatsapp: '', // Protected - only leaders can see via separate call
            avatar_url: profile?.avatar_url || null
          }
        };
      });
      
      setMembers(formattedMembers);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar membros',
        description: 'Recarregue a página para tentar novamente.',
      });
    }
  };

  const fetchSchedules = async () => {
    if (!id) return;
    
    try {
      // Fetch schedules with sectors (including color)
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select('id, user_id, date, time_start, time_end, notes, sector_id, confirmation_status, decline_reason, sectors(name, color)')
        .eq('department_id', id)
        .order('date', { ascending: true });

      if (schedulesError) throw schedulesError;

      // Get member profiles to map names
      const { data: memberProfiles, error: profilesError } = await supabase
        .rpc('get_department_member_profiles', { dept_id: id });

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profileMap = new Map<string, { name: string; avatar_url: string | null }>();
      (memberProfiles || []).forEach((p: any) => {
        profileMap.set(p.id, { 
          name: p.name || 'Membro', 
          avatar_url: p.avatar_url 
        });
      });
      
      const formattedSchedules = (schedulesData || []).map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        date: s.date,
        time_start: s.time_start,
        time_end: s.time_end,
        notes: s.notes,
        sector_id: s.sector_id,
        confirmation_status: s.confirmation_status,
        decline_reason: s.decline_reason,
        profile: profileMap.get(s.user_id) || { name: 'Membro', avatar_url: null },
        sector: s.sectors ? { name: s.sectors.name, color: s.sectors.color } : null
      }));
      
      setSchedules(formattedSchedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const copyInviteLink = async () => {
    if (!department) return;
    
    const inviteUrl = `${window.location.origin}/join/${department.invite_code}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
    
    toast({
      title: 'Link copiado!',
      description: 'Compartilhe com novos membros.',
    });
  };

  const handleAddSchedule = (date?: Date) => {
    setSelectedDate(date || null);
    setShowAddSchedule(true);
  };

  const handleScheduleCreated = () => {
    setShowAddSchedule(false);
    setSelectedDate(null);
    fetchSchedules();
  };

  const handleMemberRemoved = () => {
    fetchMembers();
  };

  const handleScheduleDeleted = () => {
    fetchSchedules();
  };

  const handleAvatarChange = (newUrl: string) => {
    if (department) {
      setDepartment({ ...department, avatar_url: newUrl });
    }
  };

  // Show spinner only while actively loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show error state instead of infinite spinner
  if (loadError || !department) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-6">
          <h2 className="text-xl font-semibold text-foreground">
            {loadError || 'Departamento não encontrado'}
          </h2>
          <p className="text-muted-foreground">
            {loadError 
              ? 'Tente recarregar a página ou fazer login novamente.'
              : 'Verifique se você tem acesso a este departamento.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Toggle sidebar and persist to localStorage
  const toggleSidebar = () => {
    const newValue = !sidebarOpen;
    setSidebarOpen(newValue);
    localStorage.setItem('dept-sidebar-open', String(newValue));
  };

  // Export handlers for sidebar
  const handleExportPDF = () => {
    exportToPDF({
      schedules,
      departmentName: department?.name || 'Departamento',
      monthYear: format(new Date(), 'MMMM yyyy', { locale: ptBR })
    });
  };

  const handleExportExcel = async () => {
    await exportToExcel({
      schedules,
      departmentName: department?.name || 'Departamento',
      monthYear: format(new Date(), 'MMMM yyyy', { locale: ptBR })
    });
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <SupportNotification />
        {/* Header */}
        <header className="sticky top-0 z-50 glass border-b border-border/50">
          <div className="container mx-auto px-2 sm:px-4 h-14 sm:h-16 flex items-center justify-between max-w-7xl">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              {/* Hamburger menu for leaders */}
              {isLeader && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-foreground click-scale shrink-0"
                  onClick={toggleSidebar}
                >
                  <Menu className="w-5 h-5" />
                </Button>
              )}
              
              <Link to="/dashboard">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground click-scale shrink-0">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <DepartmentAvatar
                  departmentId={department.id}
                  avatarUrl={department.avatar_url}
                  departmentName={department.name}
                  isLeader={isLeader}
                  onAvatarChange={handleAvatarChange}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-base sm:text-lg font-bold text-foreground truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
                      {department.name}
                    </h1>
                    {isLeader && (
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full gradient-vibrant flex items-center justify-center shrink-0">
                        <Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {members.length} membros
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <ThemeToggle />
              {isLeader && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground click-scale"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Action Sidebar for leaders */}
        {isLeader && (
          <ActionSidebar
            isOpen={sidebarOpen}
            onClose={() => {
              setSidebarOpen(false);
              localStorage.setItem('dept-sidebar-open', 'false');
            }}
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
            onOpenAvailability={() => setShowAvailabilitySheet(true)}
            onOpenInvite={() => setShowInviteMember(true)}
          />
        )}

        <main className={cn(
          "container mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 max-w-7xl transition-all duration-200",
          isLeader && sidebarOpen && !isMobile && "ml-14"
        )}>
        <Tabs defaultValue="schedules" className="space-y-4 sm:space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="bg-muted/50 self-start w-full sm:w-auto overflow-x-auto">
              <TabsTrigger 
                value="schedules" 
                className="gap-2 click-scale selection-glow data-[state=active]:gradient-vibrant data-[state=active]:text-white data-[state=active]:shadow-glow-sm transition-all"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden xs:inline">Escalas</span>
              </TabsTrigger>
              {!isLeader && (
                <TabsTrigger 
                  value="availability" 
                  className="gap-2 click-scale selection-glow data-[state=active]:gradient-vibrant data-[state=active]:text-white data-[state=active]:shadow-glow-sm transition-all"
                >
                  <Clock className="w-4 h-4" />
                  <span className="hidden xs:inline">Disponibilidade</span>
                </TabsTrigger>
              )}
              {isLeader && (
                <TabsTrigger 
                  value="sectors" 
                  className="gap-2 click-scale selection-glow data-[state=active]:gradient-vibrant data-[state=active]:text-white data-[state=active]:shadow-glow-sm transition-all"
                >
                  <Layers className="w-4 h-4" />
                  <span className="hidden xs:inline">Setores</span>
                </TabsTrigger>
              )}
              {isLeader && (
                <TabsTrigger 
                  value="members" 
                  className="gap-2 click-scale selection-glow data-[state=active]:gradient-vibrant data-[state=active]:text-white data-[state=active]:shadow-glow-sm transition-all"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden xs:inline">Membros</span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Removed - moved to sidebar */}
          </div>

          <TabsContent value="schedules" className="mt-4 sm:mt-6 animate-fade-in">
            <div className="space-y-6">
              {/* Schedule Calendar */}
              <UnifiedScheduleView 
                schedules={schedules}
                members={members}
                isLeader={isLeader}
                onAddSchedule={handleAddSchedule}
                onDeleteSchedule={handleScheduleDeleted}
                departmentId={id!}
                onOpenSmartSchedule={() => setShowSmartSchedule(true)}
              />
              
              {/* Leader sees member availability below the calendar */}
              {isLeader && (
                <div className="border-t border-border/50 pt-6">
                  <LeaderSlotAvailabilityView departmentId={id!} />
                </div>
              )}
              
              {isLeader && (
                <LeaderAvailabilityView 
                  departmentId={id!} 
                  onOpenSmartSchedule={() => setShowSmartSchedule(true)} 
                />
              )}
            </div>
          </TabsContent>

          {/* Availability tab - only for non-leaders (members) */}
          {!isLeader && (
            <TabsContent value="availability" className="mt-6 animate-fade-in">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold mb-4">Minha Disponibilidade</h3>
                <div className="grid gap-6 lg:grid-cols-3 max-w-6xl">
                  <SlotAvailability departmentId={id!} userId={user?.id || ''} />
                  <AvailabilityCalendar departmentId={id!} userId={user?.id || ''} />
                  <MemberPreferences departmentId={id!} userId={user?.id || ''} />
                </div>
              </div>
            </TabsContent>
          )}

          <TabsContent value="sectors" className="mt-6">
            <div className="max-w-2xl">
              <SectorManagement 
                departmentId={id!}
                isLeader={isLeader}
              />
            </div>
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <MemberList 
              members={members}
              isLeader={isLeader}
              currentUserId={user?.id || ''}
              departmentId={id!}
              onMemberRemoved={handleMemberRemoved}
              onInviteMember={() => setShowInviteMember(true)}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Dialogs */}
      <AddScheduleDialog
        open={showAddSchedule}
        onOpenChange={setShowAddSchedule}
        departmentId={id!}
        members={members}
        selectedDate={selectedDate}
        onScheduleCreated={handleScheduleCreated}
      />

      <InviteMemberDialog
        open={showInviteMember}
        onOpenChange={setShowInviteMember}
        inviteCode={department.invite_code}
      />

      <DepartmentSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        department={department}
        onDepartmentUpdated={fetchDepartment}
      />

      <SmartScheduleDialog
        open={showSmartSchedule}
        onOpenChange={setShowSmartSchedule}
        departmentId={id!}
        onSchedulesCreated={fetchSchedules}
      />

      {/* My Availability Sheet for leaders */}
      <MyAvailabilitySheet 
        departmentId={id!} 
        userId={user?.id || ''} 
        open={showAvailabilitySheet}
        onOpenChange={setShowAvailabilitySheet}
      />
    </div>
    </TooltipProvider>
  );
}