// Color palette for members - vibrant colors (enough variety for large departments)
export const memberColors = [
  { bg: '#6366F1', dot: '#6366F1', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/50', name: 'Índigo' },
  { bg: '#22C55E', dot: '#22C55E', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/50', name: 'Verde' },
  { bg: '#F97316', dot: '#F97316', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/50', name: 'Laranja' },
  { bg: '#EC4899', dot: '#EC4899', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/50', name: 'Rosa' },
  { bg: '#14B8A6', dot: '#14B8A6', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/50', name: 'Turquesa' },
  { bg: '#A855F7', dot: '#A855F7', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/50', name: 'Roxo' },
  { bg: '#EF4444', dot: '#EF4444', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/50', name: 'Vermelho' },
  { bg: '#3B82F6', dot: '#3B82F6', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/50', name: 'Azul' },
  { bg: '#FACC15', dot: '#FACC15', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500/50', name: 'Amarelo' },
  { bg: '#06B6D4', dot: '#06B6D4', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/50', name: 'Ciano' },
  { bg: '#8B5CF6', dot: '#8B5CF6', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/50', name: 'Violeta' },
  { bg: '#10B981', dot: '#10B981', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/50', name: 'Esmeralda' },
  { bg: '#F43F5E', dot: '#F43F5E', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/50', name: 'Rosa Intenso' },
  { bg: '#0EA5E9', dot: '#0EA5E9', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/50', name: 'Céu' },
  { bg: '#D946EF', dot: '#D946EF', text: 'text-fuchsia-600 dark:text-fuchsia-400', border: 'border-fuchsia-500/50', name: 'Fúcsia' },
  { bg: '#84CC16', dot: '#84CC16', text: 'text-lime-600 dark:text-lime-400', border: 'border-lime-500/50', name: 'Lima' },
];

export type MemberColor = typeof memberColors[number];

interface Member {
  id: string;
  user_id: string;
  role?: 'leader' | 'member';
  profile?: {
    name: string;
    avatar_url?: string | null;
  };
}

/**
 * Creates a map of member user_id to a unique color index.
 * Colors are assigned based on member order but guaranteed unique within the department
 * (as long as there are fewer members than colors available).
 */
export function createMemberColorMap(members: Member[]): Map<string, number> {
  const map = new Map<string, number>();
  const usedColors = new Set<number>();
  
  members.forEach((member) => {
    // Find the next available color that hasn't been used
    let colorIndex = 0;
    while (usedColors.has(colorIndex) && colorIndex < memberColors.length) {
      colorIndex++;
    }
    
    // If all colors are used, start reusing (for very large departments)
    if (colorIndex >= memberColors.length) {
      // Use modulo to cycle through colors for members beyond color count
      const memberIndex = members.indexOf(member);
      colorIndex = memberIndex % memberColors.length;
    } else {
      usedColors.add(colorIndex);
    }
    
    map.set(member.user_id, colorIndex);
  });
  
  return map;
}

/**
 * Get the color configuration for a specific member by user_id
 */
export function getMemberColor(colorMap: Map<string, number>, userId: string): MemberColor {
  const colorIndex = colorMap.get(userId) ?? 0;
  return memberColors[colorIndex];
}

/**
 * Get just the hex color for a member (simpler interface for some use cases)
 */
export function getMemberHexColor(colorMap: Map<string, number>, userId: string): string {
  return getMemberColor(colorMap, userId).bg;
}
