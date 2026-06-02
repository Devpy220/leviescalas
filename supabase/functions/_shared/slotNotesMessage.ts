// Helper to fetch the "Repertório de Hoje" / observation note from slot_notes
// and format it as a WhatsApp block. Each URL inside the note is shown on its
// own line so WhatsApp auto-previews/auto-links them, making it easy to copy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

function formatBody(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '';
  // Pull all URLs apart so each sits on its own line for clean preview/copy.
  const urls = trimmed.match(URL_REGEX) || [];
  const textOnly = trimmed.replace(URL_REGEX, '').trim();
  const parts: string[] = [];
  if (textOnly) parts.push(textOnly);
  if (urls.length) parts.push(urls.join('\n'));
  return parts.join('\n\n');
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
      .select('content')
      .eq('department_id', departmentId)
      .eq('date', date)
      .eq('time_start', normalizeTime(timeStart))
      .eq('time_end', normalizeTime(timeEnd))
      .maybeSingle();

    if (error || !data) return '';
    const body = formatBody((data as any).content || '');
    if (!body) return '';
    return `\n━━━━━━━━━━━━━━━━━━━━\n🎤 *Repertório de Hoje*\n${body}\n━━━━━━━━━━━━━━━━━━━━\n`;
  } catch (e) {
    console.error('fetchSlotNotesBlock error:', e);
    return '';
  }
}
