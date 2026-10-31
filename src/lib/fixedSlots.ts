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
    bgColor: 'bg-sky-100/80 dark:bg-sky-800/50',
    borderColor: 'border-sky-300 dark:border-sky-700/50',
    activeColor: 'bg-sky-500'
  },
  { 
    dayOfWeek: 0, 
    timeStart: '18:00', 
    timeEnd: '22:00', 
    label: 'Domingo de Noite',
    icon: Moon,
    bgColor: 'bg-yellow-100/80 dark:bg-yellow-800/50',
    borderColor: 'border-yellow-300 dark:border-yellow-700/50',
    activeColor: 'bg-yellow-500'
  },
  { 
    dayOfWeek: 1, 
    timeStart: '19:00', 
    timeEnd: '22:00', 
    label: 'Segunda', 
    icon: Moon,
    bgColor: 'bg-green-100/80 dark:bg-green-800/50',
    borderColor: 'border-green-300 dark:border-green-700/50',
    activeColor: 'bg-green-500'
  },
  { 
    dayOfWeek: 2, 
    timeStart: '19:00', 
    timeEnd: '22:00', 
    label: 'Terça', 
    icon: Moon,
    bgColor: 'bg-red-100/80 dark:bg-red-800/50',
    borderColor: 'border-red-300 dark:border-red-700/50',
    activeColor: 'bg-red-500'
  },
  { 
    dayOfWeek: 3, 
    timeStart: '19:00', 
    timeEnd: '22:00', 
    label: 'Quarta', 
    icon: Moon,
    bgColor: 'bg-violet-100/80 dark:bg-violet-800/50',
    borderColor: 'border-violet-300 dark:border-violet-700/50',
    activeColor: 'bg-violet-500'
  },
  { 
    dayOfWeek: 4, 
    timeStart: '19:00', 
    timeEnd: '22:00', 
    label: 'Quinta', 
    icon: Moon,
    bgColor: 'bg-teal-100/80 dark:bg-teal-800/50',
    borderColor: 'border-teal-300 dark:border-teal-700/50',
    activeColor: 'bg-teal-500'
  },
  { 
    dayOfWeek: 5, 
    timeStart: '19:00', 
    timeEnd: '22:00', 
    label: 'Sexta', 
    icon: Moon,
    bgColor: 'bg-pink-100/80 dark:bg-pink-800/50',
    borderColor: 'border-pink-300 dark:border-pink-700/50',
    activeColor: 'bg-pink-500'
  },
  { 
    dayOfWeek: 6, 
    timeStart: '19:00', 
    timeEnd: '22:00', 
    label: 'Sábado', 
    icon: Moon,
    bgColor: 'bg-lime-100/80 dark:bg-lime-800/50',
    borderColor: 'border-lime-300 dark:border-lime-700/50',
    activeColor: 'bg-lime-500'
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

// Normalize time to HH:mm format (database may return HH:mm:ss)
export const normalizeTime = (time: string) => time?.slice(0, 5);

// Find a fixed slot by day of week and time (handles HH:mm:ss from database)
export const findSlotByDayAndTime = (dayOfWeek: number, timeStart: string): FixedSlot | undefined => {
  const normalizedTime = normalizeTime(timeStart);
  return FIXED_SLOTS.find(s => s.dayOfWeek === dayOfWeek && s.timeStart === normalizedTime);
};

// Cor do dia para horários fora do padrão (domingo: manhã antes das 14h, noite depois)
export const getDayColorSlot = (dayOfWeek: number, timeStart: string): FixedSlot | undefined => {
  const t = normalizeTime(timeStart);
  if (dayOfWeek === 0) {
    return FIXED_SLOTS.find(s => s.dayOfWeek === 0 && s.timeStart === (t < '14:00' ? '08:00' : '18:00'));
  }
  return FIXED_SLOTS.find(s => s.dayOfWeek === dayOfWeek);
};
