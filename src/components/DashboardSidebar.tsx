import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  CalendarDays, 
  LogOut, 
  Download, 
  Shield,
  Heart,
  Settings,
  Users,
  Clock,
  Megaphone,
  CalendarPlus,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  X,
  type LucideIcon
} from 'lucide-react';
import { LeviLogo } from '@/components/LeviLogo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserDepartments, type UserDepartment } from '@/hooks/useUserDepartments';
import { useState, useEffect } from 'react';
import MyAvailabilitySheet from '@/components/department/MyAvailabilitySheet';
import AnnouncementBoard from '@/components/department/AnnouncementBoard';
import AddScheduleDialog from '@/components/department/AddScheduleDialog';
import { useAuth } from '@/hooks/useAuth';

interface DashboardSidebarProps {
  isAdmin: boolean;
  shouldShowInstallPrompt: boolean;
  onInstallClick: () => void;
  onSignOut: () => void;
}

interface MenuItem {
  icon: LucideIcon;
  label: string;
  path?: string;
  onClick?: () => void;
  leaderOnly?: boolean;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

type ContextualAction = 'availability' | 'announcements' | 'create-schedule';

function SidebarContent({ 
  isAdmin, 
  shouldShowInstallPrompt, 
  onInstallClick, 
  onSignOut,
  onNavigate,
  collapsed,
  onContextualAction,
}: DashboardSidebarProps & { 
  onNavigate?: () => void; 
  collapsed: boolean;
  onContextualAction: (action: ContextualAction) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { departments, leaderDepartments, isLeader, userName, userAvatarUrl } = useUserDepartments();

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const menuItems: MenuItem[] = [
    { icon: CalendarDays, label: 'Minhas Escalas', path: '/my-schedules' },
    { icon: Users, label: 'Escalas Equipe', path: '/my-schedules?view=team' },
    { icon: Settings, label: 'Configurações', path: '/security' },
    { icon: Clock, label: 'Disponibilidade', onClick: () => { onContextualAction('availability'); onNavigate?.(); } },
    { icon: Megaphone, label: 'Mural de Avisos', onClick: () => { onContextualAction('announcements'); onNavigate?.(); } },
    { icon: CalendarPlus, label: 'Criar Escalas', onClick: () => { onContextualAction('create-schedule'); onNavigate?.(); }, leaderOnly: true },
  ];

  const isActive = (item: MenuItem) => {
    if (!item.path) return false;
    if (item.path.includes('?')) {
      return location.pathname + location.search === item.path;
    }
    return location.pathname === item.path;
  };

  const renderItem = (item: MenuItem, idx: number) => {
    if (item.leaderOnly && !isLeader) return null;

    const active = isActive(item);
    const button = (
      <button
        key={idx}
        onClick={() => item.path ? handleNav(item.path) : item.onClick?.()}
        className={`w-full flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-xl text-sm font-medium transition-all ${
          active
            ? 'bg-secondary text-secondary-foreground shadow-lg'
            : 'text-white/80 hover:bg-white/10 hover:text-white'
        }`}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </button>
    );

    if (collapsed) {
      return (
        <li key={idx}>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        </li>
      );
    }

    return <li key={idx}>{button}</li>;
  };

  return (
    <div className="flex flex-col h-full gradient-sidebar text-white">
      {/* Logo */}
      <div className={`p-5 pb-4 ${collapsed ? 'flex justify-center' : ''}`}>
        <Link to="/" className="flex items-center gap-3" onClick={onNavigate}>
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
            <LeviLogo className="w-8 h-8" />
          </div>
          {!collapsed && <span className="font-display text-xl font-bold">LEVI</span>}
        </Link>
        {!collapsed && (
          <p className="text-white/50 text-[10px] leading-tight mt-2 px-1">
            Logística de Escalas para{'\n'}Voluntários da Igreja
          </p>
        )}
      </div>

      {/* Profile quick access */}
      {!collapsed ? (
        <div className="px-3 mb-2">
          <button
            onClick={() => handleNav('/dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              location.pathname === '/dashboard'
                ? 'bg-secondary text-secondary-foreground shadow-lg'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Avatar className="w-7 h-7">
              {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName || 'Usuário'} />}
              <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px] font-bold">
                {userName ? getInitials(userName) : 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{userName || 'Meu Perfil'}</span>
          </button>
        </div>
      ) : (
        <div className="px-3 mb-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleNav('/dashboard')}
                className={`w-full flex items-center justify-center px-2 py-3 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === '/dashboard'
                    ? 'bg-secondary text-secondary-foreground shadow-lg'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Avatar className="w-6 h-6">
                  {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName} />}
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-[9px] font-bold">
                    {userName ? getInitials(userName) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Meu Perfil</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Menu */}
      <nav className="flex-1 px-3 overflow-y-auto">
        {!collapsed && (
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider px-3 mb-3">
            Principal
          </p>
        )}
        <ul className="space-y-1">
          {menuItems.map((item, idx) => renderItem(item, idx))}

          {isAdmin && (
            <li>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNav('/admin')}
                      className={`w-full flex items-center justify-center px-2 py-3 rounded-xl text-sm font-medium transition-all ${
                        location.pathname === '/admin'
                          ? 'bg-secondary text-secondary-foreground shadow-lg'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Shield className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Painel Admin</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  onClick={() => handleNav('/admin')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/admin'
                      ? 'bg-secondary text-secondary-foreground shadow-lg'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Shield className="w-5 h-5" />
                  <span>Painel Admin</span>
                </button>
              )}
            </li>
          )}

          {shouldShowInstallPrompt && (
            <li>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { onInstallClick(); onNavigate?.(); }}
                      className="w-full flex items-center justify-center px-2 py-3 rounded-xl text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Instalar App</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  onClick={() => { onInstallClick(); onNavigate?.(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all"
                >
                  <Download className="w-5 h-5" />
                  <span>Instalar App</span>
                  <span className="ml-auto w-2.5 h-2.5 bg-secondary rounded-full" />
                </button>
              )}
            </li>
          )}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-3 space-y-1">
        {/* Support */}
        <div>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNav('/payment')}
                  className={`w-full flex items-center justify-center px-2 py-3 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/payment'
                      ? 'bg-secondary text-secondary-foreground shadow-lg'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Heart className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Apoie o LEVI</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => handleNav('/payment')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                location.pathname === '/payment'
                  ? 'bg-secondary text-secondary-foreground shadow-lg'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Heart className="w-5 h-5" />
              <span>Apoie o LEVI</span>
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="flex items-center gap-2 px-3 py-2">
            <ThemeToggle />
            <NotificationBell />
          </div>
        )}

        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { onSignOut(); onNavigate?.(); }}
                className="w-full flex items-center justify-center px-2 py-3 rounded-xl text-sm font-medium text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition-all"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={() => { onSignOut(); onNavigate?.(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        )}
      </div>
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
  const isMobile = useIsMobile();
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') !== 'false';
    }
    return true;
  });
  const [hovered, setHovered] = useState(false);

  // Contextual action states
  const [pendingAction, setPendingAction] = useState<ContextualAction | null>(null);
  const [selectedDept, setSelectedDept] = useState<UserDepartment | null>(null);
  const [showAvailability, setShowAvailability] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);

  const { departments, leaderDepartments } = useUserDepartments();
  const { user, session } = useAuth();
  const currentUser = user ?? session?.user ?? null;

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  const handleContextualAction = (action: ContextualAction) => {
    const targetDepts = action === 'create-schedule' ? leaderDepartments : departments;
    if (targetDepts.length === 0) return;

    if (targetDepts.length === 1) {
      setSelectedDept(targetDepts[0]);
      openActionModal(action, targetDepts[0]);
    } else {
      setPendingAction(action);
    }
  };

  const openActionModal = (action: ContextualAction, dept: UserDepartment) => {
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
    }
  };

  const handleDeptSelect = (dept: UserDepartment) => {
    if (pendingAction) {
      openActionModal(pendingAction, dept);
    }
  };

  const isExpanded = !collapsed || hovered;
  const sidebarWidth = isExpanded ? 'w-64' : 'w-14';

  // Mobile: fixed w-14 sidebar + expandable overlay
  if (isMobile) {
    return (
      <>
        {/* Collapsed sidebar strip */}
        <aside className="w-14 fixed left-0 top-0 bottom-0 z-40">
          <SidebarContent 
            {...props} 
            collapsed={true} 
            onNavigate={() => setMobileExpanded(false)} 
            onContextualAction={handleContextualAction}
          />
          {/* Expand button at top */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setMobileExpanded(true)}
                className="absolute top-5 right-1 w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
              >
                <PanelLeftOpen className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expandir menu</TooltipContent>
          </Tooltip>
        </aside>

        {/* Expanded overlay */}
        {mobileExpanded && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200" 
              onClick={() => setMobileExpanded(false)} 
            />
            <aside className="w-64 fixed left-0 top-0 bottom-0 z-50 animate-in slide-in-from-left duration-200">
              <SidebarContent 
                {...props} 
                collapsed={false} 
                onNavigate={() => setMobileExpanded(false)}
                onContextualAction={handleContextualAction}
              />
              <button
                onClick={() => setMobileExpanded(false)}
                className="absolute top-5 right-2 w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </aside>
          </>
        )}

        {/* Modals */}
        {pendingAction && (
          <DepartmentPicker
            departments={pendingAction === 'create-schedule' ? leaderDepartments : departments}
            onSelect={handleDeptSelect}
            onClose={() => setPendingAction(null)}
            title={
              pendingAction === 'availability' ? 'Escolher Departamento' :
              pendingAction === 'announcements' ? 'Escolher Departamento' :
              'Escolher Departamento'
            }
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
      </>
    );
  }

  // Desktop: existing behavior
  return (
    <>
      <aside 
        className={`${sidebarWidth} fixed left-0 top-0 bottom-0 z-40 transition-all duration-300 ease-in-out`}
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <SidebarContent 
          {...props} 
          collapsed={!isExpanded} 
          onContextualAction={handleContextualAction}
        />
        {/* Toggle pin button */}
        {isExpanded && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { setCollapsed(!collapsed); setHovered(false); }}
                className="absolute top-5 right-2 w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
              >
                {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? 'Fixar sidebar' : 'Recolher sidebar'}</TooltipContent>
          </Tooltip>
        )}
      </aside>

      {/* Modals */}
      {pendingAction && (
        <DepartmentPicker
          departments={pendingAction === 'create-schedule' ? leaderDepartments : departments}
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
    </>
  );
}

export function useSidebarWidth() {
  const isMobile = useIsMobile();
  const [collapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') !== 'false';
    }
    return true;
  });
  
  if (isMobile) return 56; // w-14 = 56px, always visible now
  return collapsed ? 56 : 256;
}
