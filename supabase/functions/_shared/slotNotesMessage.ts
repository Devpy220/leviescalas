// Helper to fetch and format the unified "Repertório de Hoje" block
// (setlist + attachments + free-text notes) for WhatsApp.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

function formatNotes(content: string): string {
  const trimmed = (content || '').trim();
  if (!trimmed) return '';
  // Pull URLs apart so each sits on its own line (clean preview/copy on WhatsApp).
  const urls = trimmed.match(URL_REGEX) || [];
  const textOnly = trimmed.replace(URL_REGEX, '').trim();
  const parts: string[] = [];
  if (textOnly) parts.push(textOnly);
  if (urls.length) parts.push(urls.join('\n'));
  return parts.join('\n\n');
}

interface SetlistItem {
  title?: string;
  url?: string;
  tom?: string;
  bpm?: string | number;
}

interface Attachment {
  name?: string;
  url?: string;
}

export async function fetchSlotNotesBlock(
  supabaseUrl: string,
  serviceRoleKey: string,
  departmentId: string,
  date: string,
  timeStart: string,
  timeEnd: string,
): Promise<string> {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase
      .from('slot_notes')
      .select('content, setlist, attachments')
      .eq('department_id', departmentId)
      .eq('date', date)
      .eq('time_start', normalizeTime(timeStart))
      .eq('time_end', normalizeTime(timeEnd))
      .maybeSingle();

    if (error || !data) return '';

    const row = data as any;
    const setlist: SetlistItem[] = Array.isArray(row.setlist) ? row.setlist : [];
    const attachments: Attachment[] = Array.isArray(row.attachments) ? row.attachments : [];
    const notes = formatNotes(row.content || '');

    const sections: string[] = [];

    if (setlist.length) {
      const songs = setlist
        .filter(s => (s.title || '').toString().trim() || (s.url || '').toString().trim())
        .map((s, i) => {
          const title = (s.title || '').toString().trim() || '(sem título)';
          const meta: string[] = [];
          if (s.tom) meta.push(`Tom: ${s.tom}`);
          if (s.bpm) meta.push(`${s.bpm} BPM`);
          const metaSuffix = meta.length ? ` _(${meta.join(' · ')})_` : '';
          const urlLine = s.url ? `\n   ${s.url}` : '';
          return `${i + 1}. 🎵 *${title}*${metaSuffix}${urlLine}`;
        });
      if (songs.length) sections.push(`🎶 *Setlist*\n${songs.join('\n')}`);
    }

    if (attachments.length) {
      const att = attachments
        .filter(a => a.url)
        .map(a => `📎 ${a.name || 'Anexo'}\n   ${a.url}`);
      if (att.length) sections.push(`*Anexos*\n${att.join('\n')}`);
    }

    if (notes) sections.push(`*Observações*\n${notes}`);

    if (!sections.length) return '';

    return `\n━━━━━━━━━━━━━━━━━━━━\n🎤 *Repertório de Hoje*\n\n${sections.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━\n`;
  } catch (e) {
    console.error('fetchSlotNotesBlock error:', e);
    return '';
  }
}
