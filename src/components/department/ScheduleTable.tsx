import { useMemo } from 'react';
import { Clock, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO } from 'date-fns';
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
}

export default function ScheduleTable({ schedules, members }: ScheduleTableProps) {
  // Color palette for members
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

  // Group schedules by date and sort by date
  const schedulesByDate = useMemo(() => {
    const grouped = new Map<string, Schedule[]>();
    
    schedules.forEach(schedule => {
      const dateKey = schedule.date;
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(schedule);
    });

    // Sort entries by date
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([date]) => {
        const scheduleDate = parseISO(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return scheduleDate >= today;
      });
  }, [schedules]);

  if (schedulesByDate.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">Nenhuma escala futura encontrada</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[140px]">Data</TableHead>
            <TableHead>Escalados</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedulesByDate.map(([date, daySchedules]) => (
            <TableRow key={date} className="hover:bg-muted/30">
              <TableCell className="font-medium">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">
                    {format(parseISO(date), "dd/MM", { locale: ptBR })}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {format(parseISO(date), "EEEE", { locale: ptBR })}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  {daySchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50 border border-border"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback 
                          className="text-[10px] text-white"
                          style={{ backgroundColor: getMemberColor(schedule.user_id) }}
                        >
                          {schedule.profile?.name?.charAt(0) || 'M'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium leading-tight">
                          {schedule.profile?.name?.split(' ')[0] || 'Membro'}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="w-2.5 h-2.5" />
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
