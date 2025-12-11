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
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ScheduleCalendar from '@/components/department/ScheduleCalendar';
import MemberList from '@/components/department/MemberList';
import AddScheduleDialog from '@/components/department/AddScheduleDialog';
import InviteMemberDialog from '@/components/department/InviteMemberDialog';

interface Department {
  id: string;
  name: string;
  description: string | null;
  leader_id: string;
  invite_code: string;
  subscription_status: string;
  created_at: string;
}

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
  profile?: {
    name: string;
    avatar_url: string | null;
  };
}

export default function Department() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [department, setDepartment] = useState<Department | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLeader, setIsLeader] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (id) {
      fetchDepartment();
      fetchMembers();
      fetchSchedules();
    }
  }, [user, id, navigate]);

  const fetchDepartment = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setDepartment(data);
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
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          id,
          user_id,
          date,
          time_start,
          time_end,
          notes,
          profiles:user_id (
            name,
            avatar_url
          )
        `)
        .eq('department_id', id)
        .order('date', { ascending: true });

      if (error) throw error;
      
      const formattedSchedules = (data || []).map(s => ({
        ...s,
        profile: s.profiles as unknown as Schedule['profile']
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

  if (loading || !department) {
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
              <div className="w-10 h-10 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm">
                <Calendar className="w-5 h-5 text-white" />
              </div>
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
                <Button variant="ghost" size="icon" className="text-muted-foreground">
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
              <TabsTrigger value="members" className="gap-2 data-[state=active]:gradient-vibrant data-[state=active]:text-white">
                <Users className="w-4 h-4" />
                <span>Membros</span>
              </TabsTrigger>
            </TabsList>

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

          <TabsContent value="calendar" className="mt-6">
            <ScheduleCalendar 
              schedules={schedules}
              members={members}
              isLeader={isLeader}
              onAddSchedule={handleAddSchedule}
              onDeleteSchedule={handleScheduleDeleted}
              departmentId={id!}
            />
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
    </div>
  );
}