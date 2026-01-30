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
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Minha Disponibilidade
          </SheetTitle>
          <SheetDescription>
            Marque os horários semanais e datas de bloqueio
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <SlotAvailability departmentId={departmentId} userId={userId} />
          <MemberPreferences departmentId={departmentId} userId={userId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
