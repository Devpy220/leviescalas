import { useState } from 'react';
import { Clock, Users, ArrowLeftRight } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PendingSwapBadge } from '@/components/schedules/PendingSwapBadge';
import SlotRepertoireEditor from '@/components/department/SlotRepertoireEditor';
import { ASSIGNMENT_ROLES, REPERTOIRE_EDIT_ROLES } from '@/lib/constants';
import type { FixedSlot } from '@/lib/fixedSlots';
import type { ScheduleSwap } from '@/hooks/useScheduleSwaps';
import { cn } from '@/lib/utils';

interface TeamSchedule {
  id: string;
  date: string;
  time_start: string;
  time_end: string;
  department_id: string;
  sector_name: string | null;
  sector_color: string | null;
  assignment_role: string | null;
  user_id: string;
}

interface Props {
  date: Date;
  slotInfo: FixedSlot;
  schedules: TeamSchedule[];
  currentUserId?: string;
  memberProfiles: Record<string, { id: string; name: string }>;
  swap: ScheduleSwap | null;
  cancellingSwapId: string | null;
  onRequestSwap: (schedule: TeamSchedule) => void;
  onRespondSwap: (swap: ScheduleSwap) => void;
  onCancelSwap: (swapId: string) => Promise<boolean>;
}

export function TeamSlotCard({
  date,
  slotInfo,
  schedules,
  currentUserId,
  memberProfiles,
  swap,
  cancellingSwapId,
  onRequestSwap,
  onRespondSwap,
  onCancelSwap,
}: Props) {
  const [open, setOpen] = useState(false);
  const isCurrentDay = isToday(date);
  const userScheduleInSlot = schedules.find((s) => s.user_id === currentUserId);

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
        className={cn(
          'overflow-hidden flex flex-col h-full bg-card/60 backdrop-blur-md border-border/40 shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-primary/40',
          isCurrentDay && 'ring-2 ring-primary'
        )}
      >
        <CardHeader className={cn('p-2.5 backdrop-blur-sm', slotInfo.bgColor)}>
          <p className="font-bold text-[11px] uppercase tracking-wide">{slotInfo.label}</p>
          <p className="text-sm font-semibold text-foreground">
            {format(date, "d 'de' MMMM", { locale: ptBR })}
          </p>
          <p className="text-[11px] font-medium text-foreground/70 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {slotInfo.timeStart} - {slotInfo.timeEnd}
          </p>
        </CardHeader>
        <CardContent className="p-2.5 pt-2 mt-auto flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" />
            {schedules.length} {schedules.length === 1 ? 'escalado' : 'escalados'}
          </span>
          {userScheduleInSlot && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 border-green-500/50 text-green-600 dark:text-green-400">
              Você
            </Badge>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {slotInfo.label} • {format(date, "d 'de' MMMM", { locale: ptBR })}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {slotInfo.timeStart} - {slotInfo.timeEnd} • {schedules.length}{' '}
              {schedules.length === 1 ? 'voluntário' : 'voluntários'}
            </DialogDescription>
          </DialogHeader>

          {userScheduleInSlot && (
            <Button
              size="sm"
              variant="outline"
              className={cn(
                'w-full',
                swap && 'text-amber-600 dark:text-amber-400 border-amber-400/50'
              )}
              onClick={() => (swap ? onRespondSwap(swap) : onRequestSwap(userScheduleInSlot))}
            >
              <ArrowLeftRight className="w-4 h-4 mr-1" />
              {swap ? 'Troca pendente' : 'Pedir troca'}
            </Button>
          )}

          <div className="space-y-1.5">
            {schedules.map((schedule) => {
              const isCurrentUser = schedule.user_id === currentUserId;
              const memberName = memberProfiles[schedule.user_id]?.name || 'Voluntário';
              const role = schedule.assignment_role
                ? ASSIGNMENT_ROLES[schedule.assignment_role as keyof typeof ASSIGNMENT_ROLES]
                : null;

              return (
                <div
                  key={schedule.id}
                  className={cn(
                    'flex items-center gap-1.5 p-1.5 rounded-md border-l-4',
                    isCurrentUser
                      ? 'bg-green-100 dark:bg-green-900/40 border-l-green-500'
                      : 'border-l-transparent'
                  )}
                  style={
                    !isCurrentUser && schedule.sector_color
                      ? { borderLeftColor: schedule.sector_color }
                      : undefined
                  }
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback
                      className={cn(
                        'text-[10px] font-medium',
                        isCurrentUser ? 'bg-green-500 text-white' : 'bg-primary/20 text-primary'
                      )}
                    >
                      {isCurrentUser
                        ? 'V'
                        : memberName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p
                        className={cn(
                          'font-medium text-xs truncate',
                          isCurrentUser && 'text-green-700 dark:text-green-400'
                        )}
                      >
                        {isCurrentUser ? 'Você' : memberName}
                        {isCurrentUser && <span className="ml-1">⭐</span>}
                      </p>
                      {role && <span className="text-sm">{role.icon}</span>}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      {schedule.sector_name && (
                        <span className="flex items-center gap-1 truncate">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: schedule.sector_color || undefined }}
                          />
                          {schedule.sector_name}
                        </span>
                      )}
                      {role && (
                        <Badge variant="outline" className={cn('text-[10px] px-1 py-0 shrink-0', role.color)}>
                          {role.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {schedules[0] && (
            <div className="pt-3 border-t border-border/50">
              <SlotRepertoireEditor
                departmentId={schedules[0].department_id}
                date={schedules[0].date}
                timeStart={schedules[0].time_start}
                timeEnd={schedules[0].time_end}
                canEdit={
                  !!userScheduleInSlot?.assignment_role &&
                  REPERTOIRE_EDIT_ROLES.includes(userScheduleInSlot.assignment_role as any)
                }
              />
            </div>
          )}

          {userScheduleInSlot && swap && (
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
