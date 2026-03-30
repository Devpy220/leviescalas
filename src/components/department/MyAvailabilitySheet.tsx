import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Clock } from 'lucide-react';
import SlotAvailability from './SlotAvailability';
import MemberPreferences from './MemberPreferences';

interface MyAvailabilitySheetProps {
  departmentId: string;
  userId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function MyAvailabilitySheet({ 
  departmentId, 
  userId,
  open,
  onOpenChange 
}: MyAvailabilitySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-primary" />
            Minha Disponibilidade
          </SheetTitle>
          <SheetDescription className="text-xs">
            Horários semanais e datas de bloqueio
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-4 space-y-4">
          <SlotAvailability departmentId={departmentId} userId={userId} />
          <MemberPreferences departmentId={departmentId} userId={userId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
