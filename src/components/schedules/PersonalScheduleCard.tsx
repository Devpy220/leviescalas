import { ArrowLeftRight, Clock, Church } from 'lucide-react';
import { format, parseISO, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { PendingSwapBadge } from '@/components/schedules/PendingSwapBadge';
import SlotRepertoireEditor from '@/components/department/SlotRepertoireEditor';
import { REPERTOIRE_EDIT_ROLES, ASSIGNMENT_ROLES } from '@/lib/constants';
import { findSlotByDayAndTime } from '@/lib/fixedSlots';
import type { ScheduleSwap } from '@/hooks/useScheduleSwaps';
import { cn } from '@/lib/utils';

export interface PersonalScheduleData {
  id: string;
  date: string;
  time_start: string;
  time_end: string;
  department_id: string;
  department_name: string;
  sector_name: string | null;
  sector_color: string | null;
  church_name: string | null;
  church_logo_url: string | null;
  assignment_role: string | null;
}

interface Props {
  schedule: PersonalScheduleData;
  swap: ScheduleSwap | null;
  cancellingSwapId: string | null;
  onRequestSwap: (schedule: PersonalScheduleData) => void;
  onCancelSwap: (swapId: string) => Promise<boolean>;
  onRespondSwap: (swap: ScheduleSwap) => void;
  compact?: boolean;
}

export function PersonalScheduleCard({
  schedule,
  swap,
  cancellingSwapId,
  onRequestSwap,
  onCancelSwap,
  onRespondSwap,
  compact = false,
}: Props) {
  const dateObj = parseISO(schedule.date);
  const dayOfWeekNum = getDay(dateObj);
  const dayOfWeek = format(dateObj, 'EEE', { locale: ptBR }).toUpperCase();
  const dayMonth = format(dateObj, 'dd/MM', { locale: ptBR });
  const slotInfo = findSlotByDayAndTime(dayOfWeekNum, schedule.time_start);

  const [open, setOpen] = useState(false);
  const role = schedule.assignment_role
    ? ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES]
    : null;

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="relative overflow-hidden flex flex-col h-full bg-card/60 backdrop-blur-md border-border/40 shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-primary/40"
      >
        <div className={cn('px-2.5 py-2 border-b border-border/40 backdrop-blur-sm', slotInfo?.bgColor || 'bg-primary/10')}>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-xs text-primary">{dayOfWeek}</span>
            <span className="text-primary font-bold text-xs">{dayMonth}</span>
            {swap && <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500 ml-auto shrink-0" />}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
            <Clock className="w-3 h-3" />
            {schedule.time_start.slice(0, 5)} - {schedule.time_end.slice(0, 5)}
          </div>
        </div>
        <div className="p-2.5 mt-auto">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 truncate max-w-full">
            {schedule.department_name}
          </Badge>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dayOfWeek} • {format(dateObj, "d 'de' MMMM", { locale: ptBR })}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {schedule.time_start.slice(0, 5)} - {schedule.time_end.slice(0, 5)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Badge variant="secondary" className="text-[11px]">
              {schedule.department_name}
            </Badge>

            {schedule.church_name && (
              <div className="flex items-center gap-1.5 text-xs text-primary/80">
                {schedule.church_logo_url ? (
                  <img
                    src={schedule.church_logo_url}
                    alt={schedule.church_name}
                    className="w-5 h-5 rounded-full object-cover border border-primary/20"
                  />
                ) : (
                  <Church className="w-3.5 h-3.5" />
                )}
                {schedule.church_name}
              </div>
            )}

            {schedule.sector_name && (
              <div className="flex items-center gap-1.5 text-xs">
                {schedule.sector_color && (
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: schedule.sector_color }} />
                )}
                <span style={{ color: schedule.sector_color || undefined }} className="font-medium">
                  {schedule.sector_name}
                </span>
              </div>
            )}

            {role && (
              <div className="flex items-center gap-1.5 text-xs">
                <span>{role.icon}</span>
                <Badge variant="outline" className={cn('text-[10px] px-1 py-0', role.color)}>
                  {role.label}
                </Badge>
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            className={cn('w-full', swap && 'text-amber-600 dark:text-amber-400 border-amber-400/50')}
            onClick={() => (swap ? onRespondSwap(swap) : onRequestSwap(schedule))}
          >
            <ArrowLeftRight className="w-4 h-4 mr-1" />
            {swap ? 'Troca pendente' : 'Pedir troca'}
          </Button>

          <div className="pt-3 border-t border-border/50">
            <SlotRepertoireEditor
              departmentId={schedule.department_id}
              date={schedule.date}
              timeStart={schedule.time_start}
              timeEnd={schedule.time_end}
              canEdit={
                !!schedule.assignment_role &&
                REPERTOIRE_EDIT_ROLES.includes(schedule.assignment_role as any)
              }
            />
          </div>

          {swap && (
            <div className="pt-3 border-t border-border/50">
              <PendingSwapBadge
                swap={swap}
                onCancel={onCancelSwap}
                onRespond={onRespondSwap}
                cancelling={cancellingSwapId === swap.id}
                compact
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
