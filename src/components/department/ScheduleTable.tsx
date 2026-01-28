import { useMemo } from 'react';
import { Clock, Users, Calendar, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { createExtendedMemberColorMap, getMemberBackgroundStyle } from '@/lib/memberColors';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ConfirmationStatus = 'pending' | 'confirmed' | 'declined';

interface Schedule {
  id: string;
  user_id: string;
  date: string;
  time_start: string;
  time_end: string;
  notes: string | null;
  sector_id: string | null;
  confirmation_status?: ConfirmationStatus;
  decline_reason?: string | null;
  profile?: {
    name: string;
    avatar_url: string | null;
  };
  sector?: {
    name: string;
    color: string;
  } | null;
}

interface Member {
  id: string;
  user_id: string;
  role: 'leader' | 'member';
  profile: {
    name: string;
    email: string;
    whatsapp: string;
    avatar_url: string | null;
  };
}

interface ScheduleTableProps {
  schedules: Schedule[];
  members: Member[];
  month?: Date;
  title?: string;
}

export default function ScheduleTable({ schedules, members, month, title }: ScheduleTableProps) {
  // Create extended color map that supports bicolor combinations for 13+ members
  const memberColorMap = useMemo(() => createExtendedMemberColorMap(members), [members]);

  // Get background style (supports both solid and gradient)
  const getMemberBgStyle = (userId: string): React.CSSProperties => {
    return getMemberBackgroundStyle(memberColorMap, userId);
  };

  const getConfirmationBadge = (status?: ConfirmationStatus, declineReason?: string | null) => {
    switch (status) {
      case 'confirmed':
        return (
          <Tooltip>
            <TooltipTrigger>
              <CheckCircle2 className="w-3 h-3 text-green-500" />
            </TooltipTrigger>
            <TooltipContent>Presença confirmada</TooltipContent>
          </Tooltip>
        );
      case 'declined':
        return (
          <Tooltip>
            <TooltipTrigger>
              <XCircle className="w-3 h-3 text-red-500" />
            </TooltipTrigger>
            <TooltipContent>
              Não poderá comparecer{declineReason ? `: ${declineReason}` : ''}
            </TooltipContent>
          </Tooltip>
        );
      default:
        return (
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="w-3 h-3 text-amber-500" />
            </TooltipTrigger>
            <TooltipContent>Aguardando confirmação</TooltipContent>
          </Tooltip>
        );
    }
  };

  const schedulesByDate = useMemo(() => {
    const grouped = new Map<string, Schedule[]>();
    
    schedules.forEach(schedule => {
      const scheduleDate = parseISO(schedule.date);
      
      // Filter by month if provided
      if (month && !isSameMonth(scheduleDate, month)) {
        return;
      }
      
      const dateKey = schedule.date;
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(schedule);
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b));
  }, [schedules, month]);

  if (schedulesByDate.length === 0) {
    return (
      <div className="bg-card border-[3px] border-primary rounded-xl p-6 text-center">
        {title && (
          <div className="flex items-center justify-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground capitalize">{title}</h3>
          </div>
        )}
        <Users className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma escala</p>
      </div>
    );
  }

  return (
    <div className="bg-card border-[3px] border-primary rounded-xl overflow-hidden">
      {title && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground capitalize">{title}</h3>
          <span className="text-xs text-muted-foreground ml-auto">
            {schedulesByDate.length} dia{schedulesByDate.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[100px] text-xs">Data</TableHead>
            <TableHead className="text-xs">Escalados</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedulesByDate.map(([date, daySchedules]) => (
            <TableRow key={date} className="hover:bg-muted/30">
              <TableCell className="font-medium py-2">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">
                    {format(parseISO(date), "dd/MM", { locale: ptBR })}
                  </span>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {format(parseISO(date), "EEE", { locale: ptBR })}
                  </span>
                </div>
              </TableCell>
              <TableCell className="py-2">
                <div className="flex flex-wrap gap-1.5">
                    {daySchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md border ${
                          schedule.confirmation_status === 'confirmed' 
                            ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' 
                            : schedule.confirmation_status === 'declined'
                            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                            : 'bg-muted/50 border-border'
                        }`}
                        style={{ borderLeftWidth: '3px', borderLeftColor: schedule.sector?.color || undefined }}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarFallback 
                            className="text-[10px] font-bold text-white"
                            style={getMemberBgStyle(schedule.user_id)}
                          >
                            {schedule.profile?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'M'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-medium leading-tight">
                              {schedule.profile?.name?.split(' ')[0] || 'Membro'}
                            </span>
                            {getConfirmationBadge(schedule.confirmation_status, schedule.decline_reason)}
                          </div>
                          {schedule.sector && (
                            <div className="flex items-center gap-0.5">
                              <div 
                                className="w-1.5 h-1.5 rounded-full" 
                                style={{ backgroundColor: schedule.sector.color }}
                              />
                              <span 
                                className="text-[8px] font-medium"
                                style={{ color: schedule.sector.color }}
                              >
                                {schedule.sector.name}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-0.5 text-[8px] text-muted-foreground">
                            <Clock className="w-2 h-2" />
                            <span>{schedule.time_start.slice(0, 5)}-{schedule.time_end.slice(0, 5)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}