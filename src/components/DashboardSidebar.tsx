import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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
  ChevronLeft,
  Layers,
  UserCog,
  Eye,
  UserPlus,
  FileDown,
  type LucideIcon
} from 'lucide-react';
import { LeviLogo } from '@/components/LeviLogo';
import { LanguageSelector } from '@/components/LanguageSelector';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserDepartments, type UserDepartment } from '@/hooks/useUserDepartments';
import { useState } from 'react';
import { useSidebarExpanded } from '@/contexts/SidebarContext';
import MyAvailabilitySheet from '@/components/department/MyAvailabilitySheet';
import AnnouncementBoard from '@/components/department/AnnouncementBoard';
import AddScheduleDialog from '@/components/department/AddScheduleDialog';
import SectorManagement from '@/components/department/SectorManagement';
import DepartmentSettingsDialog from '@/components/department/DepartmentSettingsDialog';
import AssignmentRoleManagement from '@/components/department/AssignmentRoleManagement';
import InviteMemberDialog from '@/components/department/InviteMemberDialog';
import ScheduleCountDialog from '@/components/department/ScheduleCountDialog';
import LeaderSlotAvailabilityView from '@/components/department/LeaderSlotAvailabilityView';
import LeaderBlackoutDatesView from '@/components/department/LeaderBlackoutDatesView';
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

type ContextualAction = 'availability' | 'team-availability' | 'announcements' | 'create-schedule' | 'sectors' | 'roles' | 'schedule-count' | 'invite' | 'export' | 'dept-settings';
type SidebarItemVariant = 'nav' | 'action' | 'danger';

// Sidebar item with tooltip (collapsed) or label (expanded)
function SidebarItem({ icon: Icon, label, active, onClick, variant = 'nav', expanded }: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
  variant?: SidebarItemVariant;
  expanded?: boolean;
}) {
  const base = `w-full flex items-center ${expanded ? 'justify-start px-3' : 'justify-center px-2'} py-2.5 rounded-xl text-sm transition-all`;

  const styles: Record<SidebarItemVariant, string> = {
    nav: active
      ? 'bg-sidebar-primary/12 text-sidebar-primary font-medium'
      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
    action: 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
    danger: 'text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300',
  };

  const button = (
    <button onClick={onClick} className={`${base} ${styles[variant]}`}>
      <Icon className="w-[18px] h-[18px] shrink-0" />
      {expanded && <span className="ml-3 truncate text-sm">{label}</span>}
    </button>
  );

  if (expanded) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

// Section label divider
function SectionLabel({ label, expanded }: { label: string; expanded: boolean }) {
  if (!expanded) {
    return <div className="border-t border-sidebar-border my-2 mx-1" />;
  }
  return (
    <div className="px-3 pt-4 pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
        {label}
      </span>
    </div>
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
  const { t } = useTranslation();
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
  const [showTeamAvailability, setShowTeamAvailability] = useState(false);
  const [deptSettingsData, setDeptSettingsData] = useState<any>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [scheduleCountData, setScheduleCountData] = useState<{ members: any[]; schedules: any[] }>({ members: [], schedules: [] });
  const [addScheduleMembers, setAddScheduleMembers] = useState<any[]>([]);

  const isActive = (path: string) => location.pathname === path;

  const handleContextualAction = (action: ContextualAction) => {
    const isLeaderAction = ['team-availability', 'create-schedule', 'sectors', 'roles', 'schedule-count', 'invite', 'export', 'dept-settings'].includes(action);
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
      case 'team-availability':
        setShowTeamAvailability(true);
        break;
      case 'announcements':
        setShowAnnouncements(true);
        break;
      case 'create-schedule':
        try {
          const { data: memberProfiles } = await supabase
            .rpc('get_department_member_profiles', { dept_id: dept.id });
          const { data: memberRows } = await supabase
            .from('members')
            .select('id, user_id, role')
            .eq('department_id', dept.id);
          const roleMap = new Map((memberRows || []).map((m: any) => [m.id, m]));
          setAddScheduleMembers((memberProfiles || []).map((m: any) => {
            const memberRow = Array.from(roleMap.values()).find((r: any) => r.user_id === m.id);
            return {
              id: memberRow?.id || m.id,
              user_id: m.id,
              role: m.role || 'member',
              profile: { name: m.name, avatar_url: m.avatar_url },
            };
          }));
        } catch (e) {
          console.error('Error fetching members for schedule:', e);
          setAddScheduleMembers([]);
        }
        setShowAddSchedule(true);
        break;
      case 'sectors':
        setShowSectors(true);
        break;
      case 'roles':
        setShowRoles(true);
        break;
      case 'schedule-count':
        try {
          const { data: members } = await supabase
            .rpc('get_department_member_profiles', { dept_id: dept.id });
          const { data: schedules } = await supabase
            .from('schedules')
            .select('id, user_id, date, assignment_role')
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

  const { expanded, toggleExpanded } = useSidebarExpanded();
  const hasDepartments = departments.length > 0;

  return (
    <>
      <aside className={`${expanded ? 'w-56' : 'w-16'} fixed left-0 top-0 bottom-0 z-40 transition-all duration-300`}>
        <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
          {/* Logo */}
          <div className={`p-3 flex ${expanded ? 'justify-between' : 'justify-center'} items-center`}>
            {expanded ? (
              <button onClick={() => navigate('/')} className="flex items-center gap-2.5 overflow-hidden">
                <LeviLogo className="w-7 h-7 shrink-0" />
                <span className="font-display font-bold text-lg text-sidebar-primary">LEVI</span>
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => navigate('/')} className="shrink-0">
                    <LeviLogo className="w-7 h-7" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">LEVI</TooltipContent>
              </Tooltip>
            )}
            {expanded && (
              <button onClick={toggleExpanded} className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground/50">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Profile */}
          <div className="px-2 mb-1">
            {expanded ? (
              <button
                onClick={() => navigate('/dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  isActive('/dashboard')
                    ? 'bg-sidebar-primary/12 text-sidebar-primary font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <Avatar className="w-7 h-7">
                  {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName || 'Usuário'} />}
                  <AvatarFallback className="bg-sidebar-primary/10 text-sidebar-primary text-[10px] font-bold">
                    {userName ? getInitials(userName) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm">{userName || 'Meu Perfil'}</span>
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className={`w-full flex items-center justify-center px-2 py-2.5 rounded-xl text-sm transition-all ${
                      isActive('/dashboard')
                        ? 'bg-sidebar-primary/12 text-sidebar-primary font-medium'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    }`}
                  >
                    <Avatar className="w-7 h-7">
                      {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName || 'Usuário'} />}
                      <AvatarFallback className="bg-sidebar-primary/10 text-sidebar-primary text-[10px] font-bold">
                        {userName ? getInitials(userName) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{userName || 'Meu Perfil'}</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Main nav */}
          <nav className="flex-1 px-2 overflow-y-auto">
            {/* Navigation section */}
            <ul className="space-y-0.5">
              <li>
                <SidebarItem expanded={expanded} icon={CalendarDays} label={t('sidebar.mySchedules')} variant="nav" active={isActive('/my-schedules')} onClick={() => navigate('/my-schedules')} />
              </li>
              <li>
                <SidebarItem expanded={expanded} icon={Settings} label={t('sidebar.settings')} variant="nav" active={isActive('/security')} onClick={() => navigate('/security')} />
              </li>
            </ul>

            {/* Department section — visible when user has departments */}
            {hasDepartments && (
              <>
                <SectionLabel label={t('sidebar.department')} expanded={expanded} />
                <ul className="space-y-0.5">
                  <li>
                    <SidebarItem expanded={expanded} icon={Clock} label={t('sidebar.availability')} variant="action" onClick={() => handleContextualAction('availability')} />
                  </li>
                  <li>
                    <SidebarItem expanded={expanded} icon={Megaphone} label={t('sidebar.announcements')} variant="action" onClick={() => handleContextualAction('announcements')} />
                  </li>
                </ul>
              </>
            )}

            {/* Leader management section */}
            {isLeader && (
              <>
                <SectionLabel label={t('sidebar.management')} expanded={expanded} />
                <ul className="space-y-0.5">
                  <li>
                    <SidebarItem expanded={expanded} icon={Eye} label={t('sidebar.teamAvailability')} variant="action" onClick={() => handleContextualAction('team-availability')} />
                  </li>
                  <li>
                    <SidebarItem expanded={expanded} icon={CalendarPlus} label={t('sidebar.createSchedule')} variant="action" onClick={() => handleContextualAction('create-schedule')} />
                  </li>
                  <li>
                    <SidebarItem expanded={expanded} icon={Layers} label={t('sidebar.sectors')} variant="action" onClick={() => handleContextualAction('sectors')} />
                  </li>
                  <li>
                    <SidebarItem expanded={expanded} icon={UserCog} label={t('sidebar.roles')} variant="action" onClick={() => handleContextualAction('roles')} />
                  </li>
                  <li>
                    <SidebarItem expanded={expanded} icon={Users} label={t('sidebar.teamSummary')} variant="action" onClick={() => handleContextualAction('schedule-count')} />
                  </li>
                  <li>
                    <SidebarItem expanded={expanded} icon={UserPlus} label={t('sidebar.inviteMember')} variant="action" onClick={() => handleContextualAction('invite')} />
                  </li>
                  <li>
                    <SidebarItem expanded={expanded} icon={FileDown} label={t('sidebar.export')} variant="action" onClick={() => handleContextualAction('export')} />
                  </li>
                  <li>
                    <SidebarItem expanded={expanded} icon={Wrench} label={t('sidebar.deptSettings')} variant="action" onClick={() => handleContextualAction('dept-settings')} />
                  </li>
                </ul>
              </>
            )}
          </nav>

          {/* Footer */}
          <div className="p-2 space-y-0.5 border-t border-sidebar-border">
            <SidebarItem expanded={expanded} icon={Heart} label={t('sidebar.supportLevi')} variant="nav" active={isActive('/payment')} onClick={() => navigate('/payment')} />
            
            <div className={`flex ${expanded ? 'flex-row justify-center' : 'flex-col'} items-center gap-1 py-1`}>
              <ThemeToggle />
              <LanguageSelector />
              <NotificationBell />
            </div>

            {isAdmin && (
              <SidebarItem expanded={expanded} icon={Shield} label={t('sidebar.adminPanel')} variant="nav" active={isActive('/admin')} onClick={() => navigate('/admin')} />
            )}

            {shouldShowInstallPrompt && (
              <SidebarItem expanded={expanded} icon={Download} label={t('sidebar.installApp')} variant="action" onClick={onInstallClick} />
            )}
            
            <SidebarItem 
              expanded={expanded}
              icon={LogOut} 
              label={t('sidebar.signOut')} 
              variant="danger"
              onClick={onSignOut}
            />

            {/* Expand toggle when collapsed */}
            {!expanded && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleExpanded}
                    className="w-full flex items-center justify-center px-2 py-2 rounded-xl text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{t('sidebar.expandMenu')}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </aside>

      {/* Modals — all logic preserved */}
      {pendingAction && (
        <DepartmentPicker
          departments={['team-availability', 'create-schedule', 'sectors', 'roles', 'schedule-count', 'invite', 'export', 'dept-settings'].includes(pendingAction) ? leaderDepartments : departments}
          onSelect={handleDeptSelect}
          onClose={() => setPendingAction(null)}
          title={t('sidebar.chooseDepartment')}
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
          members={addScheduleMembers}
          selectedDate={null}
          onScheduleCreated={() => {
            setShowAddSchedule(false);
            window.dispatchEvent(new CustomEvent('schedules-updated', { detail: { departmentId: selectedDept.id } }));
          }}
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
          departmentId={selectedDept.id}
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

      {showTeamAvailability && selectedDept && (
        <Dialog open={showTeamAvailability} onOpenChange={setShowTeamAvailability}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                Disponibilidade da Equipe - {selectedDept.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <LeaderSlotAvailabilityView departmentId={selectedDept.id} />
              <LeaderBlackoutDatesView departmentId={selectedDept.id} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export { useSidebarExpanded } from '@/contexts/SidebarContext';
