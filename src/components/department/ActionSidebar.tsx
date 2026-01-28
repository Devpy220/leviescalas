import { Download, Clock, UserPlus, FileText, FileSpreadsheet, X, Calendar, Layers, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ActionSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  departmentName: string;
  currentTab: string;
  onTabChange: (tab: string) => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  onOpenAvailability: () => void;
  onOpenInvite: () => void;
}

const navigationItems = [
  { 
    id: 'schedules',
    icon: Calendar, 
    labelSuffix: 'Escalas', 
    color: 'text-purple-500 hover:text-purple-400 hover:bg-purple-500/10',
  },
  { 
    id: 'sectors',
    icon: Layers, 
    labelSuffix: 'Setores', 
    color: 'text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10',
  },
  { 
    id: 'members',
    icon: Users, 
    labelSuffix: 'Membros', 
    color: 'text-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10',
  },
];

const actionItems = [
  { 
    id: 'export',
    icon: Download, 
    label: 'Exportar Escalas', 
    color: 'text-green-500 hover:text-green-400 hover:bg-green-500/10',
  },
  { 
    id: 'availability',
    icon: Clock, 
    label: 'Minha Disponibilidade', 
    color: 'text-orange-500 hover:text-orange-400 hover:bg-orange-500/10',
  },
  { 
    id: 'invite',
    icon: UserPlus, 
    label: 'Convidar Membro', 
    color: 'text-blue-500 hover:text-blue-400 hover:bg-blue-500/10',
  },
];

export default function ActionSidebar({
  isOpen,
  onClose,
  departmentName,
  currentTab,
  onTabChange,
  onExportPDF,
  onExportExcel,
  onOpenAvailability,
  onOpenInvite,
}: ActionSidebarProps) {
  const isMobile = useIsMobile();

  const handleNavigation = (tabId: string) => {
    onTabChange(tabId);
    if (isMobile) onClose();
  };

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case 'availability':
        onOpenAvailability();
        if (isMobile) onClose();
        break;
      case 'invite':
        onOpenInvite();
        if (isMobile) onClose();
        break;
    }
  };

  const renderExportDropdown = (inDrawer = false) => (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size={inDrawer ? "default" : "icon"}
              className={cn(
                actionItems[0].color,
                "transition-all duration-200",
                inDrawer && "w-full justify-start gap-3"
              )}
            >
              <Download className={cn("w-5 h-5", inDrawer && "shrink-0")} />
              {inDrawer && <span>Exportar Escalas</span>}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        {!inDrawer && (
          <TooltipContent side="right" className="font-medium">
            Exportar Escalas
          </TooltipContent>
        )}
      </Tooltip>
      <DropdownMenuContent 
        side={inDrawer ? "top" : "right"} 
        align="start"
        className="bg-popover border-border z-[60]"
      >
        <DropdownMenuItem 
          className="cursor-pointer gap-2"
          onClick={() => {
            onExportPDF();
            if (isMobile) onClose();
          }}
        >
          <FileText className="w-4 h-4 text-red-500" />
          Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem 
          className="cursor-pointer gap-2"
          onClick={() => {
            onExportExcel();
            if (isMobile) onClose();
          }}
        >
          <FileSpreadsheet className="w-4 h-4 text-green-600" />
          Exportar Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderNavigationItem = (item: typeof navigationItems[0], inDrawer = false) => {
    const label = `${departmentName} - ${item.labelSuffix}`;
    const isActive = currentTab === item.id;

    return (
      <Tooltip key={item.id}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={inDrawer ? "default" : "icon"}
            className={cn(
              item.color,
              "transition-all duration-200",
              inDrawer && "w-full justify-start gap-3",
              isActive && "bg-accent ring-1 ring-primary/30"
            )}
            onClick={() => handleNavigation(item.id)}
          >
            <item.icon className={cn("w-5 h-5", inDrawer && "shrink-0")} />
            {inDrawer && <span>{label}</span>}
          </Button>
        </TooltipTrigger>
        {!inDrawer && (
          <TooltipContent side="right" className="font-medium">
            {label}
          </TooltipContent>
        )}
      </Tooltip>
    );
  };

  const renderActionItem = (item: typeof actionItems[0], inDrawer = false) => {
    if (item.id === 'export') {
      return <div key={item.id}>{renderExportDropdown(inDrawer)}</div>;
    }

    return (
      <Tooltip key={item.id}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={inDrawer ? "default" : "icon"}
            className={cn(
              item.color,
              "transition-all duration-200",
              inDrawer && "w-full justify-start gap-3"
            )}
            onClick={() => handleAction(item.id)}
          >
            <item.icon className={cn("w-5 h-5", inDrawer && "shrink-0")} />
            {inDrawer && <span>{item.label}</span>}
          </Button>
        </TooltipTrigger>
        {!inDrawer && (
          <TooltipContent side="right" className="font-medium">
            {item.label}
          </TooltipContent>
        )}
      </Tooltip>
    );
  };

  // Mobile: Bottom drawer
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="pb-6">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-lg font-display">Menu</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 space-y-1">
            {/* Navigation items */}
            <div className="pb-2 border-b border-border/50 mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-2">Navegação</p>
              {navigationItems.map((item) => renderNavigationItem(item, true))}
            </div>
            
            {/* Action items */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-2">Ações</p>
              {actionItems.map((item) => renderActionItem(item, true))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Fixed left sidebar
  if (!isOpen) return null;

  return (
    <aside 
      className={cn(
        "fixed left-0 top-[56px] sm:top-[64px] h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)]",
        "w-14 flex flex-col items-center py-4 gap-2",
        "bg-background/80 backdrop-blur-xl border-r border-border/50",
        "z-40 animate-in slide-in-from-left-2 duration-200"
      )}
    >
      {/* Close button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground mb-2"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          Fechar Menu
        </TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div className="w-8 h-px bg-border/50 mb-2" />

      {/* Navigation items */}
      {navigationItems.map((item) => (
        <div key={item.id}>
          {renderNavigationItem(item)}
        </div>
      ))}

      {/* Divider */}
      <div className="w-8 h-px bg-border/50 my-2" />

      {/* Action items */}
      {actionItems.map((item) => (
        <div key={item.id}>
          {renderActionItem(item)}
        </div>
      ))}
    </aside>
  );
}
