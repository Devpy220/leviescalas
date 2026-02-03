import { Calendar, Clock, Bell } from 'lucide-react';

const notifications = [
  { title: 'Nova escala criada', desc: 'Você foi escalado para Domingo, 09:00', time: 'Agora', icon: Calendar },
  { title: 'Lembrete 48h', desc: 'Sua escala é em 2 dias', time: '48h antes', icon: Clock },
  { title: 'Lembrete final', desc: 'Sua escala começa em 2 horas', time: '2h antes', icon: Bell },
];

export function NotificationsStep() {
  return (
    <div className="space-y-3">
      {notifications.map((notif, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <notif.icon className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{notif.title}</p>
              <span className="text-xs text-muted-foreground">{notif.time}</span>
            </div>
            <p className="text-xs text-muted-foreground">{notif.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
