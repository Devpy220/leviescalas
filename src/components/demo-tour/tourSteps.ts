import { 
  Calendar, 
  Users, 
  Bell, 
  Clock,
  FileText,
  Layers,
  Church,
  Sparkles,
  LucideIcon
} from 'lucide-react';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao LEVI!',
    description: 'Sistema gratuito de escalas para voluntários de igrejas. Veja como é simples organizar seu ministério.',
    icon: Sparkles,
  },
  {
    id: 'church',
    title: 'Sistema por Igrejas',
    description: 'Cada igreja tem seu código exclusivo. Os membros acessam pelo código da igreja e encontram todos os departamentos.',
    icon: Church,
  },
  {
    id: 'departments',
    title: 'Seus Departamentos',
    description: 'Participe de múltiplos departamentos como líder ou membro. Veja suas escalas de todos os ministérios em um só lugar.',
    icon: Users,
  },
  {
    id: 'calendar',
    title: 'Calendário de Escalas',
    description: 'Visualize todas as escalas do mês com cores diferenciadas para cada voluntário. Líderes podem adicionar e gerenciar escalas.',
    icon: Calendar,
  },
  {
    id: 'availability',
    title: 'Disponibilidade',
    description: 'Membros podem informar os dias que estão disponíveis. Líderes visualizam a disponibilidade de toda a equipe.',
    icon: Clock,
  },
  {
    id: 'sectors',
    title: 'Setores e Funções',
    description: 'Organize seu departamento em setores (ex: Bateria, Vocal, Teclado). Atribua membros a funções específicas.',
    icon: Layers,
  },
  {
    id: 'notifications',
    title: 'Notificações por Email',
    description: 'Voluntários recebem emails automáticos: ao serem escalados, 48h antes e 2h antes do compromisso.',
    icon: Bell,
  },
  {
    id: 'export',
    title: 'Exportar Escalas',
    description: 'Exporte suas escalas em PDF ou Excel para impressão ou compartilhamento com a equipe.',
    icon: FileText,
  },
];

export const mockDepartments = [
  { name: 'Louvor', members: 8, isLeader: true, color: 'violet' },
  { name: 'Mídia', members: 5, isLeader: false, color: 'emerald' },
];

export const mockSectors = [
  { name: 'Vocal', members: 4 },
  { name: 'Bateria', members: 2 },
  { name: 'Teclado', members: 2 },
];
