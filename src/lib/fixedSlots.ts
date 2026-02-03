import { Sun, Moon, LucideIcon } from 'lucide-react';

export interface FixedSlot {
  dayOfWeek: number;
  timeStart: string;
  timeEnd: string;
  label: string;
  icon: LucideIcon;
  bgColor: string;
  borderColor: string;
  activeColor: string;
}

// Todos os 7 dias da semana com horários padrão
export const FIXED_SLOTS: FixedSlot[] = [
  { 
    dayOfWeek: 0, 
    timeStart: '08:00', 
    timeEnd: '12:00', 
    label: 'Domingo de Manhã',
    icon: Sun,
    bgColor: 'bg-cyan-100/80 dark:bg-cyan-900/30',
    borderColor: 'border-cyan-300 dark:border-cyan-700/50',
    activeColor: 'bg-cyan-500'
  },
  { 
    dayOfWeek: 0, 
    timeStart: '18:00', 
    timeEnd: '22:00', 
    label: 'Domingo de Noite',
    icon: Moon,
    bgColor: 'bg-rose-100/80 dark:bg-rose-900/30',
    borderColor: 'border-rose-300 dark:border-rose-700/50',
    activeColor: 'bg-rose-500'
  },
  { 
    dayOfWeek: 1, 
    timeStart: '19:00', 
    timeEnd: '22:00', 
    label: 'Segunda', 
    icon: Moon,
    bgColor: 'bg-amber-100/80 dark:bg-amber-900/30',
    borderColor: 'border-amber-300 dark:border-amber-700/50',
    activeColor: 'bg-amber-500'
  },
  { 
    dayOfWeek: 2, 
    timeStart: '19:00', 
    timeEnd: '22:00', 
    label: 'Terça', 
    icon: Moon,
    bgColor: 'bg-emerald-100/80 dark:bg-emerald-900/30',
    borderColor: 'border-emerald-300 dark:border-emerald-700/50',
    activeColor: 'bg-emerald-500'
  },
  { 
    dayOfWeek: 3, 
    timeStart: '19:00', 
    timeEnd: '22:00', 
    label: 'Quarta', 
    icon: Moon,
    bgColor: 'bg-violet-100/80 dark:bg-violet-900/30',
    borderColor: 'border-violet-300 dark:border-violet-700/50',
    activeColor: 'bg-violet-500'
  },
  { 
    dayOfWeek: 4, 
    timeStart: '19:00', 
    timeEnd: '22:00', 
    label: 'Quinta', 
    icon: Moon,
    bgColor: 'bg-blue-100/80 dark:bg-blue-900/30',
    borderColor: 'border-blue-300 dark:border-blue-700/50',
    activeColor: 'bg-blue-500'
  },
  { 
    dayOfWeek: 5, 
    timeStart: '19:00', 
    timeEnd: '22:00', 
    label: 'Sexta', 
    icon: Moon,
    bgColor: 'bg-pink-100/80 dark:bg-pink-900/30',
    borderColor: 'border-pink-300 dark:border-pink-700/50',
    activeColor: 'bg-pink-500'
  },
  { 
    dayOfWeek: 6, 
    timeStart: '19:00', 
    timeEnd: '22:00', 
    label: 'Sábado', 
    icon: Moon,
    bgColor: 'bg-orange-100/80 dark:bg-orange-900/30',
    borderColor: 'border-orange-300 dark:border-orange-700/50',
    activeColor: 'bg-orange-500'
  },
];

// Slots simplificados para AddScheduleDialog
export const SIMPLE_SLOTS = FIXED_SLOTS.map(s => ({
  dayOfWeek: s.dayOfWeek,
  timeStart: s.timeStart,
  timeEnd: s.timeEnd,
  label: s.label,
}));

// Slots para SmartScheduleDialog
export interface SmartSlot {
  id: string;
  dayOfWeek: number;
  timeStart: string;
  timeEnd: string;
  label: string;
  defaultMembers: number;
}

export const SMART_SLOTS: SmartSlot[] = FIXED_SLOTS.map(s => ({
  id: `${s.dayOfWeek}-${s.timeStart}`,
  dayOfWeek: s.dayOfWeek,
  timeStart: s.timeStart,
  timeEnd: s.timeEnd,
  label: s.label,
  defaultMembers: s.dayOfWeek === 0 && s.timeStart === '18:00' ? 5 : 3,
}));

export const getSlotKey = (slot: { dayOfWeek: number; timeStart: string; timeEnd: string }) => 
  `${slot.dayOfWeek}-${slot.timeStart}-${slot.timeEnd}`;

export const getAvailableSlotsForDay = (dayOfWeek: number) => 
  SIMPLE_SLOTS.filter(slot => slot.dayOfWeek === dayOfWeek);
