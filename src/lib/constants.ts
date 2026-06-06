// Local Storage Keys
export const STORAGE_KEYS = {} as const;

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
  },
  worship_minister: {
    label: 'Ministro de Louvor',
    description: 'Pode editar o Repertório de Hoje (setlist, cifras e observações)',
    icon: '🎤',
    color: 'text-violet-600 dark:text-violet-400'
  }
} as const;

export type AssignmentRole = keyof typeof ASSIGNMENT_ROLES;

// Roles autorizados a editar o "Repertório de Hoje" do slot
export const REPERTOIRE_EDIT_ROLES: AssignmentRole[] = ['worship_minister'];
