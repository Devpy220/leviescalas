import { useRef, useState, useCallback } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import ActionMenuContent from './ActionMenuContent';

interface ActionMenuPopoverProps {
  departmentName: string;
  currentTab: string;
  onTabChange: (tab: string) => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  onOpenAvailability: () => void;
  onOpenInvite: () => void;
  onOpenScheduleCount: () => void;
  onOpenCalendarSync: () => void;
}

export default function ActionMenuPopover({
  departmentName,
  currentTab,
  onTabChange,
  onExportPDF,
  onExportExcel,
  onOpenAvailability,
  onOpenInvite,
  onOpenScheduleCount,
  onOpenCalendarSync,
}: ActionMenuPopoverProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useIsMobile();

  const handleMouseEnter = useCallback(() => {
    if (isMobile) return;
    hoverTimeoutRef.current = setTimeout(() => setMenuOpen(true), 300);
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const handlePopoverMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const handlePopoverMouseLeave = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  // Mobile: Bottom drawer
  if (isMobile) {
    return (
      <>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground click-scale shrink-0"
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
          <DrawerContent className="pb-6">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-lg font-display">Menu</DrawerTitle>
            </DrawerHeader>
            <ActionMenuContent
              departmentName={departmentName}
              currentTab={currentTab}
              onTabChange={onTabChange}
              onExportPDF={onExportPDF}
              onExportExcel={onExportExcel}
              onOpenAvailability={onOpenAvailability}
              onOpenInvite={onOpenInvite}
              onOpenScheduleCount={onOpenScheduleCount}
              onOpenCalendarSync={onOpenCalendarSync}
              onClose={closeMenu}
            />
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop: Popover
  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground click-scale shrink-0"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Menu className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        side="bottom" 
        align="start"
        sideOffset={8}
        className="w-auto p-0 bg-background/95 backdrop-blur-xl border-border/50 shadow-lg"
        onMouseEnter={handlePopoverMouseEnter}
        onMouseLeave={handlePopoverMouseLeave}
      >
        <ActionMenuContent
          departmentName={departmentName}
          currentTab={currentTab}
          onTabChange={onTabChange}
          onExportPDF={onExportPDF}
          onExportExcel={onExportExcel}
          onOpenAvailability={onOpenAvailability}
          onOpenInvite={onOpenInvite}
          onOpenScheduleCount={onOpenScheduleCount}
          onOpenCalendarSync={onOpenCalendarSync}
          onClose={closeMenu}
        />
      </PopoverContent>
    </Popover>
  );
}
