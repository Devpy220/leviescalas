// Local Storage Keys
export const STORAGE_KEYS = {
  SUPPORT_NOTIFICATION_LAST_SHOWN: 'levi_support_notification_last_shown',
} as const;

// Assignment Roles - Função do membro na escala
export const ASSIGNMENT_ROLES = {
  on_duty: { 
    label: 'Plantão', 
    description: 'Fica o tempo todo (não participa do culto)',
    icon: '🚗',
    color: 'text-amber-600 dark:text-amber-400'
  },
  participant: { 
    label: 'Culto', 
    description: 'Pode participar do culto',
    icon: '⛪',
    color: 'text-green-600 dark:text-green-400'
  }
} as const;

export type AssignmentRole = keyof typeof ASSIGNMENT_ROLES;
