import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft,
  Calendar,
  Users,
  Settings,
  Share2,
  Crown,
  Plus,
  Copy,
  Check,
  Loader2,
  Sparkles,
  Download,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ScheduleCalendar from '@/components/department/ScheduleCalendar';
import ScheduleTable from '@/components/department/ScheduleTable';
import MemberList from '@/components/department/MemberList';
import SectorManagement from '@/components/department/SectorManagement';
import AddScheduleDialog from '@/components/department/AddScheduleDialog';
import InviteMemberDialog from '@/components/department/InviteMemberDialog';
import DepartmentAvatar from '@/components/department/DepartmentAvatar';
import DepartmentSettingsDialog from '@/components/department/DepartmentSettingsDialog';
import { exportToPDF, exportToExcel } from '@/lib/exportSchedules';
import { Layers } from 'lucide-react';
import { format, addMonths, startOfMonth } from 'date-fns';
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
  profile?: {
    name: string;
    avatar_url: string | null;
  };
  sector?: {
    name: string;
  } | null;
}

export default function Department() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [department, setDepartment] = useState<Department | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLeader, setIsLeader] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }
    if (id) {
      fetchDepartment();
      fetchMembers();
      fetchSchedules();
    }
  }, [user, id, navigate, authLoading]);

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
      setIsLeader(data.leader_id === user?.id);
    } catch (error) {
      console.error('Error fetching department:', error);
      toast({
        variant: 'destructive',
        title: 'Departamento não encontrado',
        description: 'Verifique se você tem acesso a este departamento.',
      });
      navigate('/dashboard');
    }
  };

  const fetchMembers = async () => {
    if (!id) return;
    
    try {
      // Use secure function that only returns non-sensitive profile data
      const { data: basicProfiles, error: profilesError } = await supabase
        .rpc('get_department_member_profiles', { dept_id: id });

      if (profilesError) throw profilesError;

      // Get member records for IDs and joined_at
      const { data: memberRecords, error: membersError } = await supabase
        .from('members')
        .select('id, user_id, role, joined_at')
        .eq('department_id', id);

      if (membersError) throw membersError;

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
    }
  };

  const fetchSchedules = async () => {
    if (!id) return;
    
    try {
      // Fetch schedules with sectors
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select('id, user_id, date, time_start, time_end, notes, sector_id, sectors(name)')
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
        profile: profileMap.get(s.user_id) || { name: 'Membro', avatar_url: null },
        sector: s.sectors ? { name: s.sectors.name } : null
      }));
      
      setSchedules(formattedSchedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
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

  if (authLoading || loading || !department) {
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
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <DepartmentAvatar
                departmentId={department.id}
                avatarUrl={department.avatar_url}
                departmentName={department.name}
                isLeader={isLeader}
                onAvatarChange={handleAvatarChange}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-lg font-bold text-foreground">
                    {department.name}
                  </h1>
                  {isLeader && (
                    <div className="w-5 h-5 rounded-full gradient-vibrant flex items-center justify-center">
                      <Crown className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {members.length} membros
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isLeader && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={copyInviteLink}
                  className="gap-2"
                >
                  {copiedInvite ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Convidar</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="calendar" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="bg-muted/50 self-start">
              <TabsTrigger value="calendar" className="gap-2 data-[state=active]:gradient-vibrant data-[state=active]:text-white">
                <Calendar className="w-4 h-4" />
                <span>Calendário</span>
              </TabsTrigger>
              <TabsTrigger value="sectors" className="gap-2 data-[state=active]:gradient-vibrant data-[state=active]:text-white">
                <Layers className="w-4 h-4" />
                <span>Setores</span>
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-2 data-[state=active]:gradient-vibrant data-[state=active]:text-white">
                <Users className="w-4 h-4" />
                <span>Membros</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Exportar</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => exportToPDF({
                      schedules,
                      departmentName: department?.name || 'Departamento',
                      monthYear: format(new Date(), 'MMMM yyyy', { locale: ptBR })
                    })}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Exportar PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => exportToExcel({
                      schedules,
                      departmentName: department?.name || 'Departamento',
                      monthYear: format(new Date(), 'MMMM yyyy', { locale: ptBR })
                    })}
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Exportar Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {isLeader && (
                <Button 
                  onClick={() => handleAddSchedule()}
                  className="gradient-vibrant text-white shadow-glow-sm hover:shadow-glow transition-all gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Escala</span>
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="calendar" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Calendars - Left Side */}
              <div className="lg:col-span-4 space-y-4">
                {/* Current Month Calendar */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Mês Atual</span>
                  </div>
                  <ScheduleCalendar 
                    schedules={schedules}
                    members={members}
                    isLeader={isLeader}
                    onAddSchedule={handleAddSchedule}
                    onDeleteSchedule={handleScheduleDeleted}
                    departmentId={id!}
                    fixedMonth={startOfMonth(new Date())}
                    title={format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
                  />
                </div>

                {/* Next Month Calendar */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span className="text-xs font-medium text-muted-foreground">Próximo Mês</span>
                  </div>
                  <ScheduleCalendar 
                    schedules={schedules}
                    members={members}
                    isLeader={isLeader}
                    onAddSchedule={handleAddSchedule}
                    onDeleteSchedule={handleScheduleDeleted}
                    departmentId={id!}
                    fixedMonth={startOfMonth(addMonths(new Date(), 1))}
                    title={format(addMonths(new Date(), 1), "MMMM 'de' yyyy", { locale: ptBR })}
                  />
                </div>
              </div>

              {/* Schedule Table - Right Side */}
              <div className="lg:col-span-8">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Próximas Escalas</h3>
                  <ScheduleTable 
                    schedules={schedules}
                    members={members}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

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
    </div>
  );
}