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

  return (
    <Card className="relative overflow-hidden flex flex-col bg-card/60 backdrop-blur-md border-border/40 shadow-sm">
      {/* Colored header — day on left, swap icon on right */}
      <div className={cn('px-2.5 py-1.5 border-b border-border/40 backdrop-blur-sm', slotInfo?.bgColor || 'bg-primary/10')}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-xs text-primary">{dayOfWeek}</span>
            <span className="text-primary font-bold text-xs">{dayMonth}</span>
            {schedule.church_logo_url && (
              <div className="w-5 h-5 rounded-full bg-background border border-primary/20 overflow-hidden shadow-sm ml-1 shrink-0">
                <img src={schedule.church_logo_url} alt={schedule.church_name || 'Igreja'} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
          {/* Swap action on opposite side */}
          {swap ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40"
                    onClick={() => onRespondSwap(swap)}
                    aria-label="Troca pendente"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Troca pendente</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full hover:bg-primary/10"
                    onClick={() => onRequestSwap(schedule)}
                    aria-label="Pedir troca"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pedir troca</TooltipContent>
              </Tooltip>
            </TooltipProvider>

          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
          <Clock className="w-2.5 h-2.5" />
          {schedule.time_start.slice(0, 5)} - {schedule.time_end.slice(0, 5)}
        </div>
      </div>

      {/* Content */}
      <div className="p-2.5 flex-1 flex flex-col">
        <div className="flex-1 space-y-1.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {schedule.department_name}
          </Badge>

          {schedule.church_name && (
            <div className="flex items-center gap-1 text-[11px] text-primary/80">
              <Church className="w-3 h-3" />
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

          {schedule.assignment_role && ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES] && (
            <div className="flex items-center gap-1.5 text-xs">
              <span>{ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].icon}</span>
              <Badge
                variant="outline"
                className={cn('text-[10px] px-1 py-0', ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].color)}
              >
                {ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES].label}
              </Badge>
            </div>
          )}
        </div>

        {!compact && (
          <div className="pt-2 mt-2 border-t border-border/50">
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
        )}

        {swap && (
          <div className="pt-2 mt-2 border-t border-border/50">
            <PendingSwapBadge
              swap={swap}
              onCancel={onCancelSwap}
              onRespond={onRespondSwap}
              cancelling={cancellingSwapId === swap.id}
              compact
            />
          </div>
        )}
      </div>
    </Card>
  );
}
