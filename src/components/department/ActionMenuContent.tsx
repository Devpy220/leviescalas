import { Download, Clock, UserPlus, FileText, FileSpreadsheet, Calendar, Layers, Users, CalendarDays, BarChart2, Megaphone } from 'lucide-react';
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
import { cn } from '@/lib/utils';

interface ActionMenuContentProps {
  departmentName: string;
  currentTab: string;
  onTabChange: (tab: string) => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  onOpenAvailability: () => void;
  onOpenInvite: () => void;
  onOpenScheduleCount: () => void;
  onClose: () => void;
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
  { 
    id: 'announcements',
    icon: Megaphone, 
    labelSuffix: 'Mural', 
    color: 'text-rose-500 hover:text-rose-400 hover:bg-rose-500/10',
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
  { 
    id: 'my-schedules',
    icon: CalendarDays, 
    label: 'Minhas Escalas', 
    color: 'text-pink-500 hover:text-pink-400 hover:bg-pink-500/10',
  },
  { 
    id: 'schedule-count',
    icon: BarChart2, 
    label: 'Resumo da Equipe', 
    color: 'text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10',
  },
];

export default function ActionMenuContent({
  departmentName,
  currentTab,
  onTabChange,
  onExportPDF,
  onExportExcel,
  onOpenAvailability,
  onOpenInvite,
  onOpenScheduleCount,
  onClose,
}: ActionMenuContentProps) {

  const handleNavigation = (tabId: string) => {
    onTabChange(tabId);
    onClose();
  };

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case 'availability':
        onOpenAvailability();
        onClose();
        break;
      case 'invite':
        onOpenInvite();
        onClose();
        break;
      case 'my-schedules':
        window.location.href = '/my-schedules';
        onClose();
        break;
      case 'schedule-count':
        onOpenScheduleCount();
        onClose();
        break;
    }
  };

  return (
    <div className="p-3 space-y-3">
      {/* Navigation section */}
      <div className="grid grid-cols-4 gap-2">
        {navigationItems.map((item) => {
          const label = `${departmentName} - ${item.labelSuffix}`;
          const isActive = currentTab === item.id;

          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-12 w-12 rounded-xl transition-all duration-200",
                    item.color,
                    isActive && "bg-accent ring-2 ring-primary/30"
                  )}
                  onClick={() => handleNavigation(item.id)}
                >
                  <item.icon className="w-6 h-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="font-medium">
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Actions section */}
      <div className="grid grid-cols-3 gap-2">
        {/* Export dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-12 w-12 rounded-xl transition-all duration-200",
                    actionItems[0].color
                  )}
                >
                  <Download className="w-6 h-6" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-medium">
              Exportar Escalas
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent 
            side="bottom" 
            align="center"
            className="bg-popover border-border z-[60]"
          >
            <DropdownMenuItem 
              className="cursor-pointer gap-2"
              onClick={() => {
                onExportPDF();
                onClose();
              }}
            >
              <FileText className="w-4 h-4 text-red-500" />
              Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="cursor-pointer gap-2"
              onClick={() => {
                onExportExcel();
                onClose();
              }}
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              Exportar Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Other action items */}
        {actionItems.slice(1).map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-xl transition-all duration-200",
                  item.color
                )}
                onClick={() => handleAction(item.id)}
              >
                <item.icon className="w-6 h-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-medium">
              {item.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
