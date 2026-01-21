// Color palette for members - optimized for maximum visual distinction
// Colors are ordered so that the most commonly used (first assigned) are highly distinct
export const memberColors = [
  // Group 1 - Highly distinct primary colors (assigned first)
  { bg: '#EF4444', dot: '#EF4444', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/50', name: 'Vermelho' },
  { bg: '#3B82F6', dot: '#3B82F6', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/50', name: 'Azul' },
  { bg: '#22C55E', dot: '#22C55E', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/50', name: 'Verde' },
  { bg: '#F97316', dot: '#F97316', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/50', name: 'Laranja' },
  { bg: '#A855F7', dot: '#A855F7', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/50', name: 'Roxo' },
  { bg: '#FACC15', dot: '#FACC15', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500/50', name: 'Amarelo' },
  
  // Group 2 - Distinct secondary colors
  { bg: '#EC4899', dot: '#EC4899', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/50', name: 'Rosa' },
  { bg: '#14B8A6', dot: '#14B8A6', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/50', name: 'Turquesa' },
  { bg: '#78350F', dot: '#78350F', text: 'text-amber-900 dark:text-amber-600', border: 'border-amber-700/50', name: 'Marrom' },
  { bg: '#1E3A5F', dot: '#1E3A5F', text: 'text-slate-700 dark:text-slate-400', border: 'border-slate-600/50', name: 'Azul Marinho' },
  
  // Group 3 - Additional colors for larger departments
  { bg: '#84CC16', dot: '#84CC16', text: 'text-lime-600 dark:text-lime-400', border: 'border-lime-500/50', name: 'Lima' },
  { bg: '#06B6D4', dot: '#06B6D4', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/50', name: 'Ciano' },
  { bg: '#6B21A8', dot: '#6B21A8', text: 'text-purple-800 dark:text-purple-500', border: 'border-purple-700/50', name: 'Púrpura' },
  { bg: '#BE185D', dot: '#BE185D', text: 'text-pink-700 dark:text-pink-500', border: 'border-pink-600/50', name: 'Magenta' },
  { bg: '#065F46', dot: '#065F46', text: 'text-emerald-800 dark:text-emerald-500', border: 'border-emerald-700/50', name: 'Verde Escuro' },
  { bg: '#7C3AED', dot: '#7C3AED', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/50', name: 'Violeta' },
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
