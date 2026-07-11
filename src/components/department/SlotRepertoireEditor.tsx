import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Music2, Save, ExternalLink, Pencil, Loader2, Plus, Trash2,
  ArrowUp, ArrowDown, Paperclip, FileText, Search, Youtube, Upload,
  Library, Music, Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetlistItem {
  title: string;
  url?: string;
  tom?: string;
  bpm?: string;
}

interface Attachment {
  name: string;
  url: string;
  path?: string;
  size?: number;
}

interface Props {
  departmentId: string;
  date: string;          // 'YYYY-MM-DD'
  timeStart: string;     // 'HH:mm' or 'HH:mm:ss'
  timeEnd: string;
  canEdit: boolean;      // líder OU escalado com função "Ministro de Louvor"
}

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

function youtubeSearchUrl(q: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function sanitizeFileName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

export default function SlotRepertoireEditor({
  departmentId, date, timeStart, timeEnd, canEdit,
}: Props) {
  const [content, setContent] = useState('');
  const [setlist, setSetlist] = useState<SetlistItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [original, setOriginal] = useState({ content: '', setlist: [] as SetlistItem[], attachments: [] as Attachment[] });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [repItems, setRepItems] = useState<any[]>([]);
  const [repLoading, setRepLoading] = useState(false);
  const [repSearch, setRepSearch] = useState('');
  const [repFilter, setRepFilter] = useState<'all' | 'musica' | 'video' | 'cifra'>('all');
  const rowIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tStart = timeStart.length === 5 ? `${timeStart}:00` : timeStart;
  const tEnd = timeEnd.length === 5 ? `${timeEnd}:00` : timeEnd;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('slot_notes' as any)
        .select('id, content, setlist, attachments')
        .eq('department_id', departmentId)
        .eq('date', date)
        .eq('time_start', tStart)
        .eq('time_end', tEnd)
        .maybeSingle();
      if (cancelled) return;
      const row = data as any;
      rowIdRef.current = row?.id || null;
      const c = row?.content || '';
      const s: SetlistItem[] = Array.isArray(row?.setlist) ? row.setlist : [];
      const a: Attachment[] = Array.isArray(row?.attachments) ? row.attachments : [];
      setContent(c);
      setSetlist(s);
      setAttachments(a);
      setOriginal({ content: c, setlist: s, attachments: a });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [departmentId, date, tStart, tEnd]);

  const dirty =
    content !== original.content ||
    JSON.stringify(setlist) !== JSON.stringify(original.setlist) ||
    JSON.stringify(attachments) !== JSON.stringify(original.attachments);

  const save = async () => {
    setSaving(true);
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const payload: any = {
      content: content.trimEnd(),
      setlist,
      attachments,
      updated_by: userId,
    };
    let error;
    if (rowIdRef.current) {
      ({ error } = await supabase.from('slot_notes' as any).update(payload).eq('id', rowIdRef.current));
    } else {
      const { data, error: insErr } = await supabase
        .from('slot_notes' as any)
        .insert({
          department_id: departmentId,
          date, time_start: tStart, time_end: tEnd,
          ...payload,
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
    setOriginal({ content: payload.content, setlist, attachments });
    setEditing(false);
    toast.success('Repertório salvo');
  };

  const cancel = () => {
    setContent(original.content);
    setSetlist(original.setlist);
    setAttachments(original.attachments);
    setEditing(false);
  };

  // Setlist ops
  const addSong = () => setSetlist([...setlist, { title: '', url: '', tom: '', bpm: '' }]);
  const updateSong = (i: number, patch: Partial<SetlistItem>) =>
    setSetlist(setlist.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const removeSong = (i: number) => setSetlist(setlist.filter((_, idx) => idx !== i));
  const moveSong = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= setlist.length) return;
    const next = [...setlist];
    [next[i], next[j]] = [next[j], next[i]];
    setSetlist(next);
  };

  // Attachments
  const onPickFile = () => fileInputRef.current?.click();
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 15MB)');
      return;
    }
    setUploading(true);
    const path = `${departmentId}/${date}_${tStart.replace(/:/g, '')}_${Date.now()}_${sanitizeFileName(file.name)}`;
    const { error: upErr } = await supabase.storage.from('slot-attachments').upload(path, file, {
      cacheControl: '3600', upsert: false,
    });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message || 'Erro no upload');
      return;
    }
    const { data: pub } = supabase.storage.from('slot-attachments').getPublicUrl(path);
    setAttachments([...attachments, { name: file.name, url: pub.publicUrl, path, size: file.size }]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.success('Anexo enviado');
  };
  const removeAttachment = async (i: number) => {
    const att = attachments[i];
    if (att.path) {
      await supabase.storage.from('slot-attachments').remove([att.path]);
    }
    setAttachments(attachments.filter((_, idx) => idx !== i));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando repertório...
      </div>
    );
  }

  const isEmpty = !original.content && original.setlist.length === 0 && original.attachments.length === 0;

  // Sem conteúdo e sem permissão = esconde
  if (isEmpty && !canEdit && !editing) return null;

  // ============== READ MODE ==============
  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Music2 className="w-4 h-4 text-violet-500" />
            Repertório de Hoje
            {original.setlist.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {original.setlist.length} música(s)
              </Badge>
            )}
            {original.attachments.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {original.attachments.length} anexo(s)
              </Badge>
            )}
          </div>
          {canEdit && (
            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5" /> {isEmpty ? 'Adicionar' : 'Editar'}
            </Button>
          )}
        </div>

        {original.setlist.length > 0 && (
          <ol className="space-y-1.5 list-none">
            {original.setlist.map((s, i) => (
              <li key={i} className="rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-muted-foreground mt-0.5">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium break-words">{s.title || <span className="italic text-muted-foreground">(sem título)</span>}</div>
                    <div className="flex flex-wrap gap-1.5 mt-0.5 text-[11px]">
                      {s.tom && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">Tom: {s.tom}</span>}
                      {s.bpm && <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400">{s.bpm} BPM</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary underline break-all">
                          <ExternalLink className="w-3 h-3" /> Abrir link
                        </a>
                      )}
                      {s.title && (
                        <a href={youtubeSearchUrl(s.title)} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-rose-600 underline">
                          <Youtube className="w-3 h-3" /> YouTube
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {original.attachments.length > 0 && (
          <div className="space-y-1">
            {original.attachments.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs hover:bg-muted/60">
                <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <span className="truncate flex-1">{a.name}</span>
                <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}

        {original.content && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words">
            {renderWithLinks(original.content)}
          </div>
        )}
      </div>
    );
  }

  // ============== EDIT MODE ==============
  return (
    <div className="space-y-3 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Music2 className="w-4 h-4 text-violet-500" />
        Repertório de Hoje
      </div>

      {/* Setlist */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">Setlist (ordem das músicas)</div>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1" onClick={addSong}>
            <Plus className="w-3.5 h-3.5" /> Música
          </Button>
        </div>
        {setlist.length === 0 && (
          <p className="text-[11px] italic text-muted-foreground">Nenhuma música ainda.</p>
        )}
        {setlist.map((s, i) => (
          <div key={i} className="rounded-md border bg-background p-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
              <Input
                placeholder="Título da música"
                value={s.title}
                onChange={(e) => updateSong(i, { title: e.target.value })}
                className="h-8 text-sm flex-1"
              />
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveSong(i, -1)} disabled={i === 0}>
                <ArrowUp className="w-3.5 h-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveSong(i, 1)} disabled={i === setlist.length - 1}>
                <ArrowDown className="w-3.5 h-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeSong(i)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-[1fr_70px_70px] gap-1.5 ml-6">
              <Input
                placeholder="Link (YouTube, Spotify, Deezer, cifra, PDF...)"
                value={s.url || ''}
                onChange={(e) => updateSong(i, { url: e.target.value })}
                className="h-7 text-xs"
                inputMode="url"
              />
              <Input
                placeholder="Tom"
                value={s.tom || ''}
                onChange={(e) => updateSong(i, { tom: e.target.value })}
                className="h-7 text-xs"
              />
              <Input
                placeholder="BPM"
                value={s.bpm || ''}
                onChange={(e) => updateSong(i, { bpm: e.target.value })}
                className="h-7 text-xs"
                inputMode="numeric"
              />
            </div>
            {s.title && (
              <a href={youtubeSearchUrl(s.title)} target="_blank" rel="noopener noreferrer"
                className="ml-6 inline-flex items-center gap-1 text-[11px] text-rose-600 hover:underline">
                <Search className="w-3 h-3" /> Buscar "{s.title}" no YouTube
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Attachments */}
      <div className="space-y-1.5 pt-1 border-t border-violet-500/15">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" /> Anexos (cifras PDF, ordem do culto)
          </div>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1" onClick={onPickFile} disabled={uploading}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*,.doc,.docx"
            className="hidden"
            onChange={onFileChange}
          />
        </div>
        {attachments.length === 0 ? (
          <p className="text-[11px] italic text-muted-foreground">Nenhum anexo.</p>
        ) : (
          <div className="space-y-1">
            {attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs">
                <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate flex-1 text-primary hover:underline">
                  {a.name}
                </a>
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeAttachment(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5 pt-1 border-t border-violet-500/15">
        <div className="text-xs font-medium text-muted-foreground">Observações / recados</div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Recados para a equipe escalada — links extras (Spotify, Deezer, Apple Music), tom alternativo, lembretes, ordem do culto..."
          className="min-h-[80px] text-sm"
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Todos os escalados neste horário verão o repertório no app e receberão músicas, links e anexos no WhatsApp.
      </p>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={cancel} disabled={saving || uploading}>
          Cancelar
        </Button>
        <Button size="sm" onClick={save} disabled={saving || uploading || !dirty} className="gap-1">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
