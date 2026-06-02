import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Save, ExternalLink, Pencil, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  departmentId: string;
  date: string;          // 'YYYY-MM-DD'
  timeStart: string;     // 'HH:mm' or 'HH:mm:ss'
  timeEnd: string;
  canEdit: boolean;      // true se usuário é líder OU escalado neste slot
}

// Extrai URLs do texto para renderizar como links clicáveis no modo leitura.
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function renderWithLinks(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2 break-all hover:text-primary/80"
        >
          {part}
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function SlotNotesEditor({
  departmentId, date, timeStart, timeEnd, canEdit,
}: Props) {
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const rowIdRef = useRef<string | null>(null);

  // Normaliza HH:mm:ss
  const tStart = timeStart.length === 5 ? `${timeStart}:00` : timeStart;
  const tEnd = timeEnd.length === 5 ? `${timeEnd}:00` : timeEnd;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('slot_notes' as any)
        .select('id, content')
        .eq('department_id', departmentId)
        .eq('date', date)
        .eq('time_start', tStart)
        .eq('time_end', tEnd)
        .maybeSingle();
      if (cancelled) return;
      const row = data as any;
      rowIdRef.current = row?.id || null;
      setContent(row?.content || '');
      setOriginal(row?.content || '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [departmentId, date, tStart, tEnd]);

  const save = async () => {
    setSaving(true);
    const trimmed = content.trimEnd();
    let error;
    if (rowIdRef.current) {
      ({ error } = await supabase
        .from('slot_notes' as any)
        .update({ content: trimmed, updated_by: (await supabase.auth.getUser()).data.user?.id })
        .eq('id', rowIdRef.current));
    } else {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { data, error: insErr } = await supabase
        .from('slot_notes' as any)
        .insert({
          department_id: departmentId,
          date, time_start: tStart, time_end: tEnd,
          content: trimmed, updated_by: userId,
        })
        .select('id')
        .single();
      error = insErr;
      if (data) rowIdRef.current = (data as any).id;
    }
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Erro ao salvar');
      return;
    }
    setOriginal(trimmed);
    setContent(trimmed);
    setEditing(false);
    toast.success('Observações salvas');
  };

  const dirty = content !== original;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando observações...
      </div>
    );
  }

  // Sem conteúdo e sem permissão = esconde
  if (!original && !canEdit) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="w-4 h-4 text-primary" />
          Repertório de Hoje
          {!editing && original && (
            <Badge variant="secondary" className="text-[10px]">
              {original.match(URL_REGEX)?.length || 0} link(s)
            </Badge>
          )}
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setEditing(true)}>
            <Pencil className="w-3.5 h-3.5" /> {original ? 'Editar' : 'Adicionar'}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Cole aqui o repertório de hoje: links do YouTube, Spotify, Drive, PDF ou escreva instruções. Tudo isso será enviado no WhatsApp para a equipe escalada neste horário."
            className="min-h-[120px] text-sm font-mono"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            Todos os voluntários escalados neste horário verão e receberão isto no WhatsApp junto com a escala.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setContent(original); setEditing(false); }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !dirty} className="gap-1">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar
            </Button>
          </div>
        </div>
      ) : original ? (
        <div className={cn(
          'rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words',
        )}>
          {renderWithLinks(original)}
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          Nenhuma observação adicionada ainda.
        </p>
      )}
    </div>
  );
}
