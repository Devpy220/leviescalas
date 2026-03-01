import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  CalendarDays, 
  LogOut, 
  Download, 
  Shield,
  Menu,
  Heart,
  type LucideIcon
} from 'lucide-react';
import { LeviLogo } from '@/components/LeviLogo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';

interface DashboardSidebarProps {
  isAdmin: boolean;
  shouldShowInstallPrompt: boolean;
  onInstallClick: () => void;
  onSignOut: () => void;
  userName?: string;
  userAvatarUrl?: string | null;
  extraMenuItems?: Array<{
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    isActive?: boolean;
    color?: string;
  }>;
}

const menuItems = [
  { icon: CalendarDays, label: 'Minhas Escalas', path: '/my-schedules', color: 'text-white' },
  { icon: Heart, label: 'Apoie o LEVI', path: '/payment', color: 'text-white' },
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function SidebarContent({ 
  isAdmin, 
  shouldShowInstallPrompt, 
  onInstallClick, 
  onSignOut,
  onNavigate,
  userName,
  userAvatarUrl,
  extraMenuItems
}: DashboardSidebarProps & { onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full gradient-sidebar text-white">
      {/* Logo + Subtitle */}
      <div className="p-5 pb-4">
        <Link to="/" className="flex items-center gap-3" onClick={onNavigate}>
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
            <LeviLogo className="w-8 h-8" />
          </div>
          <span className="font-display text-xl font-bold">LEVI</span>
        </Link>
        <p className="text-white/50 text-[10px] leading-tight mt-2 px-1">
          Logística de Escalas para{'\n'}Voluntários da Igreja
        </p>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3">
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider px-3 mb-3">
          Principal
        </p>
        <ul className="space-y-1">
          {/* Dashboard item with user avatar */}
          <li>
            <button
              onClick={() => handleNav('/dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                location.pathname === '/dashboard'
                  ? 'bg-secondary text-secondary-foreground shadow-lg'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Avatar className="w-6 h-6">
                {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName || 'Usuário'} />}
                <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px] font-bold">
                  {userName ? getInitials(userName) : 'U'}
                </AvatarFallback>
              </Avatar>
              <span>{userName || 'Meu Perfil'}</span>
            </button>
          </li>

          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <button
                  onClick={() => handleNav(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-secondary text-secondary-foreground shadow-lg'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}

          {isAdmin && (
            <li>
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
            </li>
          )}

          {shouldShowInstallPrompt && (
            <li>
              <button
                onClick={() => { onInstallClick(); onNavigate?.(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all"
              >
                <Download className="w-5 h-5" />
                <span>Instalar App</span>
                <span className="ml-auto w-2.5 h-2.5 bg-secondary rounded-full" />
              </button>
            </li>
          )}
        </ul>

        {/* Extra menu items (e.g. leader actions) */}
        {extraMenuItems && extraMenuItems.length > 0 && (
          <>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider px-3 mb-3 mt-6">
              Ações
            </p>
            <ul className="space-y-1">
              {extraMenuItems.map((item, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => { item.onClick(); onNavigate?.(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      item.isActive
                        ? 'bg-secondary text-secondary-foreground shadow-lg'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 space-y-1">
        <div className="flex items-center gap-2 px-3 py-2">
          <ThemeToggle />
          <NotificationBell />
        </div>
        <button
          onClick={() => { onSignOut(); onNavigate?.(); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}

export function DashboardSidebar(props: DashboardSidebarProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

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
              <SidebarContent {...props} onNavigate={() => setOpen(false)} />
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
    <aside className="w-64 fixed left-0 top-0 bottom-0 z-40">
      <SidebarContent {...props} />
    </aside>
  );
}
