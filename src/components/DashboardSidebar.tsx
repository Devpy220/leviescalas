import { useNavigate, useLocation } from 'react-router-dom';
import { 
  CalendarDays, 
  LogOut, 
  Download, 
  Shield,
  Wrench,
  Heart,
  Settings,
  Users,
  Clock,
  Megaphone,
  CalendarPlus,
  ChevronRight,
  Layers,
  UserCog,
  UserPlus,
  FileDown,
  type LucideIcon
} from 'lucide-react';
import { LeviLogo } from '@/components/LeviLogo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserDepartments, type UserDepartment } from '@/hooks/useUserDepartments';
import { useState, useEffect } from 'react';
import MyAvailabilitySheet from '@/components/department/MyAvailabilitySheet';
import AnnouncementBoard from '@/components/department/AnnouncementBoard';
import AddScheduleDialog from '@/components/department/AddScheduleDialog';
import SectorManagement from '@/components/department/SectorManagement';
import DepartmentSettingsDialog from '@/components/department/DepartmentSettingsDialog';
import AssignmentRoleManagement from '@/components/department/AssignmentRoleManagement';
import InviteMemberDialog from '@/components/department/InviteMemberDialog';
import ScheduleCountDialog from '@/components/department/ScheduleCountDialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { exportToPDF, exportToExcel } from '@/lib/exportSchedules';
import { useToast } from '@/hooks/use-toast';

interface DashboardSidebarProps {
  isAdmin: boolean;
  shouldShowInstallPrompt: boolean;
  onInstallClick: () => void;
  onSignOut: () => void;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

type ContextualAction = 'availability' | 'announcements' | 'create-schedule' | 'sectors' | 'roles' | 'schedule-count' | 'invite' | 'export' | 'dept-settings';

// Icon-only sidebar item with tooltip
function SidebarItem({ icon: Icon, label, active, onClick, className }: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`w-full flex items-center justify-center px-2 py-3 rounded-xl text-sm font-medium transition-all ${
            active
              ? 'bg-secondary text-secondary-foreground shadow-lg'
              : className || 'text-white/80 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Icon className="w-5 h-5 shrink-0" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

// Department picker for contextual actions
function DepartmentPicker({ 
  departments, 
  onSelect, 
  onClose,
  title 
}: { 
  departments: UserDepartment[]; 
  onSelect: (dept: UserDepartment) => void; 
  onClose: () => void;
  title: string;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {departments.map((dept) => (
            <button
              key={dept.id}
              onClick={() => onSelect(dept)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:bg-accent text-foreground"
            >
              <Avatar className="w-8 h-8">
                {dept.avatar_url && <AvatarImage src={dept.avatar_url} alt={dept.name} />}
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {dept.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-left truncate">{dept.name}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardSidebar(props: DashboardSidebarProps) {
  const { isAdmin, shouldShowInstallPrompt, onInstallClick, onSignOut } = props;
  const location = useLocation();
  const navigate = useNavigate();
  const { departments, leaderDepartments, isLeader, userName, userAvatarUrl } = useUserDepartments();
  const { user, session } = useAuth();
  const currentUser = user ?? session?.user ?? null;
  const { toast } = useToast();

  // Contextual action states
  const [pendingAction, setPendingAction] = useState<ContextualAction | null>(null);
  const [selectedDept, setSelectedDept] = useState<UserDepartment | null>(null);
  const [showAvailability, setShowAvailability] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showSectors, setShowSectors] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [showScheduleCount, setShowScheduleCount] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showDeptSettings, setShowDeptSettings] = useState(false);
  const [deptSettingsData, setDeptSettingsData] = useState<any>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [scheduleCountData, setScheduleCountData] = useState<{ members: any[]; schedules: any[] }>({ members: [], schedules: [] });

  const isActive = (path: string) => {
    if (path.includes('?')) {
      return location.pathname + location.search === path;
    }
    return location.pathname === path;
  };

  const handleContextualAction = (action: ContextualAction) => {
    const isLeaderAction = ['create-schedule', 'sectors', 'roles', 'schedule-count', 'invite', 'export', 'dept-settings'].includes(action);
    const targetDepts = isLeaderAction ? leaderDepartments : departments;
    if (targetDepts.length === 0) return;

    if (targetDepts.length === 1) {
      openActionModal(action, targetDepts[0]);
    } else {
      setPendingAction(action);
    }
  };

  const openActionModal = async (action: ContextualAction, dept: UserDepartment) => {
    setSelectedDept(dept);
    setPendingAction(null);
    switch (action) {
      case 'availability':
        setShowAvailability(true);
        break;
      case 'announcements':
        setShowAnnouncements(true);
        break;
      case 'create-schedule':
        setShowAddSchedule(true);
        break;
      case 'sectors':
        setShowSectors(true);
        break;
      case 'roles':
        setShowRoles(true);
        break;
      case 'schedule-count':
        // Fetch members and schedules for the dialog
        try {
          const { data: members } = await supabase
            .rpc('get_department_member_profiles', { dept_id: dept.id });
          const { data: schedules } = await supabase
            .from('schedules')
            .select('id, user_id, date')
            .eq('department_id', dept.id);
          setScheduleCountData({
            members: (members || []).map((m: any) => ({
              id: m.id,
              user_id: m.id,
              role: m.role,
              profile: { name: m.name, avatar_url: m.avatar_url },
            })),
            schedules: schedules || [],
          });
        } catch (e) {
          console.error(e);
        }
        setShowScheduleCount(true);
        break;
      case 'invite':
        // Fetch invite code
        try {
          const { data } = await supabase
            .rpc('get_department_secure', { dept_id: dept.id });
          if (data && data[0]) {
            setInviteCode(data[0].invite_code);
          }
        } catch (e) {
          console.error(e);
        }
        setShowInvite(true);
        break;
      case 'export':
        setShowExport(true);
        break;
      case 'dept-settings':
        // Fetch department data for settings
        try {
          const { data: deptData } = await supabase
            .from('departments')
            .select('id, name, description, subscription_status, stripe_customer_id, max_blackout_dates, allow_sunday_double')
            .eq('id', dept.id)
            .single();
          if (deptData) {
            setDeptSettingsData(deptData);
            setShowDeptSettings(true);
          }
        } catch (e) {
          console.error(e);
        }
        break;
    }
  };

  const handleDeptSelect = (dept: UserDepartment) => {
    if (pendingAction) {
      openActionModal(pendingAction, dept);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedDept) return;
    try {
      const { data: schedules } = await supabase
        .from('schedules')
        .select('*, sector:sectors(name, color)')
        .eq('department_id', selectedDept.id)
        .order('date');
      
      if (!schedules) return;
      
      const { data: members } = await supabase
        .rpc('get_department_member_profiles', { dept_id: selectedDept.id });
      
      const memberMap: Record<string, string> = {};
      (members || []).forEach((m: any) => { memberMap[m.id] = m.name; });
      
      const formatted = schedules.map((s: any) => ({
        ...s,
        user_name: memberMap[s.user_id] || 'Desconhecido',
        sector_name: s.sector?.name || null,
        sector_color: s.sector?.color || null,
      }));
      
      exportToPDF({ schedules: formatted, departmentName: selectedDept.name, monthYear: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) });
      toast({ title: 'PDF exportado com sucesso!' });
    } catch (e) {
      toast({ title: 'Erro ao exportar PDF', variant: 'destructive' });
    }
    setShowExport(false);
  };

  const handleExportExcel = async () => {
    if (!selectedDept) return;
    try {
      const { data: schedules } = await supabase
        .from('schedules')
        .select('*, sector:sectors(name, color)')
        .eq('department_id', selectedDept.id)
        .order('date');
      
      if (!schedules) return;
      
      const { data: members } = await supabase
        .rpc('get_department_member_profiles', { dept_id: selectedDept.id });
      
      const memberMap: Record<string, string> = {};
      (members || []).forEach((m: any) => { memberMap[m.id] = m.name; });
      
      const formatted = schedules.map((s: any) => ({
        ...s,
        user_name: memberMap[s.user_id] || 'Desconhecido',
        sector_name: s.sector?.name || null,
        sector_color: s.sector?.color || null,
      }));
      
      await exportToExcel({ schedules: formatted, departmentName: selectedDept.name, monthYear: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) });
      toast({ title: 'Excel exportado com sucesso!' });
    } catch (e) {
      toast({ title: 'Erro ao exportar Excel', variant: 'destructive' });
    }
    setShowExport(false);
  };

  return (
    <>
      <aside className="w-14 fixed left-0 top-0 bottom-0 z-40">
        <div className="flex flex-col h-full gradient-sidebar text-white">
          {/* Logo */}
          <div className="p-2 pb-2 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => navigate('/')} className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                  <LeviLogo className="w-8 h-8" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">LEVI</TooltipContent>
            </Tooltip>
          </div>

          {/* Profile */}
          <div className="px-2 mb-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`w-full flex items-center justify-center px-2 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive('/dashboard')
                      ? 'bg-secondary text-secondary-foreground shadow-lg'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Avatar className="w-6 h-6">
                    {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName || 'Usuário'} />}
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-[9px] font-bold">
                      {userName ? getInitials(userName) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{userName || 'Meu Perfil'}</TooltipContent>
            </Tooltip>
          </div>

          {/* Main menu */}
          <nav className="flex-1 px-2 overflow-y-auto">
            <ul className="space-y-1">
              <li>
                <SidebarItem icon={CalendarDays} label="Minhas Escalas" active={isActive('/my-schedules')} onClick={() => navigate('/my-schedules')} />
              </li>
              <li>
                <SidebarItem icon={Users} label="Escalas Equipe" active={isActive('/my-schedules?view=team')} onClick={() => navigate('/my-schedules?view=team')} />
              </li>
              <li>
                <SidebarItem icon={Settings} label="Configurações" active={isActive('/security')} onClick={() => navigate('/security')} />
              </li>
              <li>
                <SidebarItem icon={Clock} label="Disponibilidade" onClick={() => handleContextualAction('availability')} />
              </li>
              <li>
                <SidebarItem icon={Megaphone} label="Mural de Avisos" onClick={() => handleContextualAction('announcements')} />
              </li>

              {/* Leader-only items */}
              {isLeader && (
                <>
                  <li className="pt-2">
                    <div className="border-t border-white/10 mb-2" />
                  </li>
                  <li>
                    <SidebarItem icon={CalendarPlus} label="Criar Escalas" onClick={() => handleContextualAction('create-schedule')} />
                  </li>
                  <li>
                    <SidebarItem icon={Layers} label="Setores" onClick={() => handleContextualAction('sectors')} />
                  </li>
                  <li>
                    <SidebarItem icon={UserCog} label="Funções" onClick={() => handleContextualAction('roles')} />
                  </li>
                  <li>
                    <SidebarItem icon={Users} label="Resumo Equipe" onClick={() => handleContextualAction('schedule-count')} />
                  </li>
                  <li>
                    <SidebarItem icon={UserPlus} label="Convidar Membro" onClick={() => handleContextualAction('invite')} />
                  </li>
                  <li>
                    <SidebarItem icon={FileDown} label="Exportar Escalas" onClick={() => handleContextualAction('export')} />
                  </li>
                  <li>
                    <SidebarItem icon={Wrench} label="Config. Departamento" onClick={() => handleContextualAction('dept-settings')} />
                  </li>
                </>
              )}

              {isAdmin && (
                <li>
                  <SidebarItem icon={Shield} label="Painel Admin" active={isActive('/admin')} onClick={() => navigate('/admin')} />
                </li>
              )}

              {shouldShowInstallPrompt && (
                <li>
                  <SidebarItem icon={Download} label="Instalar App" onClick={onInstallClick} />
                </li>
              )}
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-2 space-y-1">
            <SidebarItem icon={Heart} label="Apoie o LEVI" active={isActive('/payment')} onClick={() => navigate('/payment')} />
            
            <div className="flex flex-col items-center gap-1 py-1">
              <ThemeToggle />
              <NotificationBell />
            </div>
            
            <SidebarItem 
              icon={LogOut} 
              label="Sair" 
              onClick={onSignOut}
              className="text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
            />
          </div>
        </div>
      </aside>

      {/* Modals */}
      {pendingAction && (
        <DepartmentPicker
          departments={['create-schedule', 'sectors', 'roles', 'schedule-count', 'invite', 'export', 'dept-settings'].includes(pendingAction) ? leaderDepartments : departments}
          onSelect={handleDeptSelect}
          onClose={() => setPendingAction(null)}
          title="Escolher Departamento"
        />
      )}

      {showAvailability && selectedDept && currentUser && (
        <MyAvailabilitySheet
          departmentId={selectedDept.id}
          userId={currentUser.id}
          open={showAvailability}
          onOpenChange={setShowAvailability}
        />
      )}

      {showAnnouncements && selectedDept && (
        <Dialog open={showAnnouncements} onOpenChange={setShowAnnouncements}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Mural de Avisos - {selectedDept.name}</DialogTitle>
            </DialogHeader>
            <AnnouncementBoard departmentId={selectedDept.id} isLeader={selectedDept.role === 'leader'} currentUserId={currentUser?.id || ''} />
          </DialogContent>
        </Dialog>
      )}

      {showAddSchedule && selectedDept && (
        <AddScheduleDialog
          departmentId={selectedDept.id}
          open={showAddSchedule}
          onOpenChange={setShowAddSchedule}
          members={[]}
          selectedDate={null}
          onScheduleCreated={() => setShowAddSchedule(false)}
        />
      )}

      {showSectors && selectedDept && (
        <Dialog open={showSectors} onOpenChange={setShowSectors}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Setores - {selectedDept.name}</DialogTitle>
            </DialogHeader>
            <SectorManagement departmentId={selectedDept.id} isLeader={true} />
          </DialogContent>
        </Dialog>
      )}

      {showRoles && selectedDept && (
        <Dialog open={showRoles} onOpenChange={setShowRoles}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Funções - {selectedDept.name}</DialogTitle>
            </DialogHeader>
            <AssignmentRoleManagement departmentId={selectedDept.id} isLeader={true} />
          </DialogContent>
        </Dialog>
      )}

      {showScheduleCount && selectedDept && (
        <ScheduleCountDialog
          open={showScheduleCount}
          onOpenChange={setShowScheduleCount}
          members={scheduleCountData.members}
          schedules={scheduleCountData.schedules}
        />
      )}

      {showInvite && selectedDept && (
        <InviteMemberDialog
          open={showInvite}
          onOpenChange={setShowInvite}
          inviteCode={inviteCode}
        />
      )}

      {showExport && selectedDept && (
        <Dialog open={showExport} onOpenChange={setShowExport}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>Exportar - {selectedDept.name}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleExportPDF}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:bg-accent text-foreground"
              >
                <FileDown className="w-5 h-5" />
                <span>Exportar PDF</span>
              </button>
              <button
                onClick={handleExportExcel}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:bg-accent text-foreground"
              >
                <FileDown className="w-5 h-5" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showDeptSettings && selectedDept && deptSettingsData && (
        <DepartmentSettingsDialog
          open={showDeptSettings}
          onOpenChange={setShowDeptSettings}
          department={deptSettingsData}
          onDepartmentUpdated={() => setShowDeptSettings(false)}
        />
      )}
    </>
  );
}

export function useSidebarWidth() {
  return 56; // Always w-14 = 56px
}
