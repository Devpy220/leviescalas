import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CalendarStep() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">Janeiro 2025</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <div key={i} className="py-1 text-muted-foreground font-medium">{d}</div>
        ))}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((day) => (
          <div key={day} className="py-2 rounded relative">
            <span className={day === 5 ? 'w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto text-xs' : ''}>{day}</span>
            {[5, 12].includes(day) && (
              <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#8B5CF6' }} />
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10B981' }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
