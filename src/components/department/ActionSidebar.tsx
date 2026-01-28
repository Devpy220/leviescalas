import { Download, Clock, UserPlus, FileText, FileSpreadsheet, X } from 'lucide-react';
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
  onExportPDF: () => void;
  onExportExcel: () => void;
  onOpenAvailability: () => void;
  onOpenInvite: () => void;
}

const menuItems = [
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
  onExportPDF,
  onExportExcel,
  onOpenAvailability,
  onOpenInvite,
}: ActionSidebarProps) {
  const isMobile = useIsMobile();

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
                menuItems[0].color,
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

  const renderMenuItem = (item: typeof menuItems[0], inDrawer = false) => {
    if (item.id === 'export') {
      return renderExportDropdown(inDrawer);
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
            <DrawerTitle className="text-lg font-display">Ações Rápidas</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 space-y-2">
            {menuItems.map((item) => (
              <div key={item.id}>
                {renderMenuItem(item, true)}
              </div>
            ))}
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

      {/* Menu items */}
      {menuItems.map((item) => (
        <div key={item.id}>
          {renderMenuItem(item)}
        </div>
      ))}
    </aside>
  );
}
