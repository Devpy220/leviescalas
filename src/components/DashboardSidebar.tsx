import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  CalendarDays, 
  LogOut, 
  Download, 
  Shield,
  Menu,
  Heart,
  Settings,
  Users,
  Clock,
  Megaphone,
  CalendarPlus,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon
} from 'lucide-react';
import { LeviLogo } from '@/components/LeviLogo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserDepartments } from '@/hooks/useUserDepartments';
import { useState, useEffect } from 'react';
import { slugify } from '@/lib/slugify';

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

function SidebarContent({ 
  isAdmin, 
  shouldShowInstallPrompt, 
  onInstallClick, 
  onSignOut,
  onNavigate,
  collapsed,
}: DashboardSidebarProps & { onNavigate?: () => void; collapsed: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { departments, leaderDepartments, isLeader, userName, userAvatarUrl } = useUserDepartments();

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const handleContextualNav = (type: 'availability' | 'announcements' | 'create-schedule') => {
    const targetDepts = type === 'create-schedule' ? leaderDepartments : departments;
    if (targetDepts.length === 0) return;
    
    const dept = targetDepts[0];
    const slug = slugify(dept.name);
    
    switch (type) {
      case 'availability':
        navigate(`/departamento/${slug}?action=availability`);
        break;
      case 'announcements':
        navigate(`/departamento/${slug}?tab=announcements`);
        break;
      case 'create-schedule':
        navigate(`/departments/${dept.id}?action=add-schedule`);
        break;
    }
    onNavigate?.();
  };

  const menuItems: MenuItem[] = [
    { icon: User, label: 'Meu Perfil', path: '/dashboard' },
    { icon: CalendarDays, label: 'Minhas Escalas', path: '/my-schedules' },
    { icon: Users, label: 'Escalas Equipe', path: '/my-schedules?view=team' },
    { icon: Settings, label: 'Configurações', path: '/security' },
    { icon: Clock, label: 'Disponibilidade', onClick: () => handleContextualNav('availability') },
    { icon: Megaphone, label: 'Mural de Avisos', onClick: () => handleContextualNav('announcements') },
    { icon: CalendarPlus, label: 'Criar Escalas', onClick: () => handleContextualNav('create-schedule'), leaderOnly: true },
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
      {!collapsed && (
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
      )}

      {/* Menu */}
      <nav className="flex-1 px-3 overflow-y-auto">
        {!collapsed && (
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider px-3 mb-3">
            Principal
          </p>
        )}
        <ul className="space-y-1">
          {collapsed && (
            <li>
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
            </li>
          )}

          {/* Skip "Meu Perfil" from menuItems since we render it separately */}
          {menuItems.filter(item => item.label !== 'Meu Perfil').map((item, idx) => renderItem(item, idx))}

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

export function DashboardSidebar(props: DashboardSidebarProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') !== 'false';
    }
    return true;
  });
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  const isExpanded = !collapsed || hovered;
  const sidebarWidth = isExpanded ? 'w-64' : 'w-14';

  if (isMobile) {
    return (
      <>
        <header className="sticky top-0 z-50 glass border-b border-border/50 flex items-center h-14 px-4 gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 border-none [&>button]:hidden">
              <SidebarContent {...props} collapsed={false} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex items-center gap-2">
            <LeviLogo className="w-7 h-7" />
            <span className="font-display text-lg font-bold text-foreground">LEVI</span>
          </Link>
        </header>
      </>
    );
  }

  return (
    <aside 
      className={`${sidebarWidth} fixed left-0 top-0 bottom-0 z-40 transition-all duration-300 ease-in-out`}
      onMouseEnter={() => collapsed && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <SidebarContent {...props} collapsed={!isExpanded} />
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
  
  if (isMobile) return 0;
  return collapsed ? 56 : 256; // w-14 = 56px, w-64 = 256px
}
