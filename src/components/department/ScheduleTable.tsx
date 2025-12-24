import { useMemo } from 'react';
import { Clock, Users, Calendar } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

interface Schedule {
  id: string;
  user_id: string;
  date: string;
  time_start: string;
  time_end: string;
  notes: string | null;
  sector_id: string | null;
  profile?: {
    name: string;
    avatar_url: string | null;
  };
  sector?: {
    name: string;
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
  const memberColors = [
    '#6366F1', '#22C55E', '#F97316', '#EC4899', '#14B8A6',
    '#A855F7', '#EF4444', '#3B82F6', '#FACC15', '#06B6D4',
  ];

  const memberColorMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member, index) => {
      map.set(member.user_id, memberColors[index % memberColors.length]);
    });
    return map;
  }, [members]);

  const getMemberColor = (userId: string) => memberColorMap.get(userId) || memberColors[0];

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
                      className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-muted/50 border border-border"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarFallback 
                          className="text-[8px] text-white"
                          style={{ backgroundColor: getMemberColor(schedule.user_id) }}
                        >
                          {schedule.profile?.name?.charAt(0) || 'M'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium leading-tight">
                          {schedule.profile?.name?.split(' ')[0] || 'Membro'}
                        </span>
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