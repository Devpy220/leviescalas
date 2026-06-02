// Helper to fetch and format a schedule's setlist (repertório) for WhatsApp.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TIPO_EMOJI: Record<string, string> = {
  musica: '🎵',
  video: '🎬',
  cifra: '🎼',
  documento: '📄',
  link: '🔗',
};

export async function fetchSetlistBlock(
  supabaseUrl: string,
  serviceRoleKey: string,
  scheduleId: string,
): Promise<string> {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase
      .from('escala_repertorio')
      .select('ordem, repertorio:repertorio_id(titulo, tipo, tom, bpm, url)')
      .eq('escala_id', scheduleId)
      .order('ordem', { ascending: true });

    if (error || !data || data.length === 0) return '';

    const lines = data
      .map((row: any) => row.repertorio)
      .filter(Boolean)
      .map((it: any, idx: number) => {
        const emoji = TIPO_EMOJI[it.tipo] || '🎵';
        const meta: string[] = [];
        if (it.tom) meta.push(`Tom: ${it.tom}`);
        if (it.bpm) meta.push(`${it.bpm} BPM`);
        const metaSuffix = meta.length ? ` _(${meta.join(' · ')})_` : '';
        const urlLine = it.url ? `\n   ${it.url}` : '';
        return `${idx + 1}. ${emoji} *${it.titulo}*${metaSuffix}${urlLine}`;
      });

    if (!lines.length) return '';

    return `\n━━━━━━━━━━━━━━━━━━━━\n🎶 *Repertório*\n${lines.join('\n')}\n━━━━━━━━━━━━━━━━━━━━\n`;
  } catch (e) {
    console.error('fetchSetlistBlock error:', e);
    return '';
  }
}
