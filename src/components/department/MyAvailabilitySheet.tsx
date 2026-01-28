import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import SlotAvailability from './SlotAvailability';
import AvailabilityCalendar from './AvailabilityCalendar';
import MemberPreferences from './MemberPreferences';

interface MyAvailabilitySheetProps {
  departmentId: string;
  userId: string;
}

export default function MyAvailabilitySheet({ departmentId, userId }: MyAvailabilitySheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 press-effect"
        >
          <Clock className="w-4 h-4" />
          <span className="hidden sm:inline">Minha Disponibilidade</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Minha Disponibilidade
          </SheetTitle>
          <SheetDescription>
            Marque os horários e datas em que você pode ser escalado
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <SlotAvailability departmentId={departmentId} userId={userId} />
          <AvailabilityCalendar departmentId={departmentId} userId={userId} />
          <MemberPreferences departmentId={departmentId} userId={userId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
