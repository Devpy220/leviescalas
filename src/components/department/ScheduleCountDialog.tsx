import { useMemo, useState } from 'react';
import { BarChart2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Member {
  id: string;
  user_id: string;
  role: 'leader' | 'member';
  profile: {
    name: string;
    avatar_url: string | null;
  };
}

interface Schedule {
  id: string;
  user_id: string;
  date: string;
}

interface ScheduleCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedules: Schedule[];
  members: Member[];
}

type WorkloadStatus = 'overload' | 'warning' | 'normal' | 'low';

interface MemberCount {
  userId: string;
  name: string;
  avatarUrl: string | null;
  count: number;
  status: WorkloadStatus;
}

function getWorkloadStatus(count: number, average: number): WorkloadStatus {
  if (average === 0) return 'normal';
  
  const percentAboveAverage = ((count - average) / average) * 100;
  
  if (percentAboveAverage > 50) return 'overload';
  if (percentAboveAverage > 25) return 'warning';
  if (count < average * 0.5) return 'low';
  return 'normal';
}

function getStatusBadge(status: WorkloadStatus) {
  switch (status) {
    case 'overload':
      return { label: 'Sobrecarga', className: 'bg-red-500/20 text-red-500 border-red-500/30' };
    case 'warning':
      return { label: 'Atenção', className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' };
    case 'normal':
      return { label: 'Normal', className: 'bg-green-500/20 text-green-500 border-green-500/30' };
    case 'low':
      return { label: 'Disponível', className: 'bg-muted text-muted-foreground border-border' };
  }
}

function getProgressColor(status: WorkloadStatus) {
  switch (status) {
    case 'overload':
      return 'bg-red-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'normal':
      return 'bg-green-500';
    case 'low':
      return 'bg-muted-foreground/50';
  }
}

export default function ScheduleCountDialog({
  open,
  onOpenChange,
  schedules,
  members,
}: ScheduleCountDialogProps) {
  const isMobile = useIsMobile();

  // Get available months from schedules
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    schedules.forEach(s => {
      const monthKey = s.date.substring(0, 7); // 'YYYY-MM'
      monthSet.add(monthKey);
    });
    const sorted = Array.from(monthSet).sort();
    // Add "all" option
    return ['all', ...sorted];
  }, [schedules]);

  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Find current index for navigation
  const currentIndex = availableMonths.indexOf(selectedMonth);

  const goToPrev = () => {
    if (currentIndex > 0) {
      setSelectedMonth(availableMonths[currentIndex - 1]);
    }
  };

  const goToNext = () => {
    if (currentIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentIndex + 1]);
    }
  };

  // Filter schedules by selected month
  const filteredSchedules = useMemo(() => {
    if (selectedMonth === 'all') return schedules;
    return schedules.filter(s => s.date.startsWith(selectedMonth));
  }, [schedules, selectedMonth]);

  const { memberCounts, average, maxCount } = useMemo(() => {
    const countMap = new Map<string, number>();
    filteredSchedules.forEach(schedule => {
      const current = countMap.get(schedule.user_id) || 0;
      countMap.set(schedule.user_id, current + 1);
    });

    const totalSchedules = filteredSchedules.length;
    const totalMembers = members.length;
    const avg = totalMembers > 0 ? totalSchedules / totalMembers : 0;

    const counts: MemberCount[] = members.map(member => {
      const count = countMap.get(member.user_id) || 0;
      return {
        userId: member.user_id,
        name: member.profile.name,
        avatarUrl: member.profile.avatar_url,
        count,
        status: getWorkloadStatus(count, avg),
      };
    });

    counts.sort((a, b) => b.count - a.count);
    const max = counts.length > 0 ? Math.max(...counts.map(c => c.count), 1) : 1;

    return { memberCounts: counts, average: avg, maxCount: max };
  }, [filteredSchedules, members]);

  const getMonthLabel = (month: string) => {
    if (month === 'all') return 'Todos';
    const date = parseISO(month + '-01');
    return format(date, 'MMM yyyy', { locale: ptBR });
  };

  const content = (
    <div className="space-y-4">
      {/* Month navigation */}
      {availableMonths.length > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={goToPrev}
            disabled={currentIndex <= 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium capitalize">
            {getMonthLabel(selectedMonth)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={goToNext}
            disabled={currentIndex >= availableMonths.length - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Average indicator */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
        <BarChart2 className="w-5 h-5 text-primary" />
        <span className="text-sm text-muted-foreground">
          Média: <span className="font-semibold text-foreground">{average.toFixed(1)}</span> escalas por membro
          {selectedMonth !== 'all' && (
            <span className="text-xs ml-1 capitalize">({getMonthLabel(selectedMonth)})</span>
          )}
        </span>
      </div>

      {/* Member list */}
      <ScrollArea className="h-[300px] sm:h-[400px]">
        <div className="space-y-2 pr-4">
          {memberCounts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum membro encontrado
            </p>
          ) : (
            memberCounts.map((member) => {
              const badge = getStatusBadge(member.status);
              const progressColor = getProgressColor(member.status);
              const progressValue = maxCount > 0 ? (member.count / maxCount) * 100 : 0;

              return (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 hover:bg-accent/50 transition-colors"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={member.avatarUrl || undefined} alt={member.name} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {member.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {member.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-foreground tabular-nums">
                          {member.count}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn('text-xs px-2 py-0', badge.className)}
                        >
                          {badge.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn('h-full transition-all duration-300', progressColor)}
                        style={{ width: `${progressValue}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span>&gt;50% acima</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <span>25-50% acima</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50" />
          <span>&lt;50% da média</span>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="pb-6">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2 text-lg font-display">
              <BarChart2 className="w-5 h-5 text-primary" />
              Resumo da Equipe
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <BarChart2 className="w-5 h-5 text-primary" />
            Resumo da Equipe
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
