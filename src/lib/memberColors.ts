// Color palette for members - optimized for maximum visual distinction
// 12 highly distinct colors with no similar tones/shades
export const memberColors = [
  // Primary distinct colors (most commonly used)
  { bg: '#EF4444', dot: '#EF4444', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/50', name: 'Vermelho' },
  { bg: '#2563EB', dot: '#2563EB', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/50', name: 'Azul Royal' },
  { bg: '#16A34A', dot: '#16A34A', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/50', name: 'Verde' },
  { bg: '#EA580C', dot: '#EA580C', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/50', name: 'Laranja' },
  { bg: '#9333EA', dot: '#9333EA', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/50', name: 'Roxo' },
  { bg: '#CA8A04', dot: '#CA8A04', text: 'text-yellow-700 dark:text-yellow-500', border: 'border-yellow-600/50', name: 'Dourado' },
  
  // Secondary distinct colors
  { bg: '#DB2777', dot: '#DB2777', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/50', name: 'Rosa' },
  { bg: '#0D9488', dot: '#0D9488', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/50', name: 'Turquesa' },
  { bg: '#92400E', dot: '#92400E', text: 'text-amber-800 dark:text-amber-600', border: 'border-amber-700/50', name: 'Marrom' },
  { bg: '#1E40AF', dot: '#1E40AF', text: 'text-blue-800 dark:text-blue-500', border: 'border-blue-700/50', name: 'Azul Marinho' },
  { bg: '#F97316', dot: '#F97316', text: 'text-orange-500 dark:text-orange-400', border: 'border-orange-400/50', name: 'Coral' },
  { bg: '#4F46E5', dot: '#4F46E5', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/50', name: 'Índigo' },
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
