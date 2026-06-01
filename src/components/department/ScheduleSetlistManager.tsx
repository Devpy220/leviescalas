import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Music, Video, FileText, Music2, LinkIcon, ListMusic, Plus,
  ArrowUp, ArrowDown, Trash2, ExternalLink, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getYouTubeEmbedUrl, getYouTubeId } from '@/lib/youtube';
import CipherViewer from './CipherViewer';

type TipoRep = 'musica' | 'video' | 'cifra' | 'documento' | 'link';

interface RepItem {
  id: string;
  titulo: string;
  tipo: TipoRep;
  url: string | null;
  cifra: string | null;
  tom: string | null;
  bpm: number | null;
}

interface SetlistRow {
  id: string;
  escala_id: string;
  repertorio_id: string;
  ordem: number;
  repertorio: RepItem | null;
}

interface Props {
  scheduleId: string;
  departmentId: string;
  canEdit: boolean;
}

const TIPO_ICON: Record<TipoRep, typeof Music> = {
  musica: Music, video: Video, cifra: Music2, documento: FileText, link: LinkIcon,
};
const TIPO_COLOR: Record<TipoRep, string> = {
  musica: 'text-amber-500', video: 'text-rose-500', cifra: 'text-violet-500',
  documento: 'text-blue-500', link: 'text-emerald-500',
};

export default function ScheduleSetlistManager({ scheduleId, departmentId, canEdit }: Props) {
  const [items, setItems] = useState<SetlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [cipher, setCipher] = useState<RepItem | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('escala_repertorio' as any)
      .select('id, escala_id, repertorio_id, ordem, repertorio:repertorio_id(id, titulo, tipo, url, cifra, tom, bpm)')
      .eq('escala_id', scheduleId)
      .order('ordem', { ascending: true });
    if (error) {
      console.error(error);
    } else {
      setItems(((data || []) as any[]).filter(r => r.repertorio));
    }
    setLoading(false);
  };

  useEffect(() => { if (scheduleId) load(); }, [scheduleId]);

  const persistOrder = async (rows: SetlistRow[]) => {
    await Promise.all(
      rows.map((r, i) =>
        supabase.from('escala_repertorio' as any).update({ ordem: i }).eq('id', r.id),
      ),
    );
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    await persistOrder(next);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('escala_repertorio' as any).delete().eq('id', id);
    if (error) toast.error('Erro ao remover'); else {
      setItems(prev => prev.filter(r => r.id !== id));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ListMusic className="w-4 h-4 text-primary" />
          Músicas da Escala
          {items.length > 0 && <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>}
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setShowPicker(true)}>
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-2">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2 italic">
          {canEdit ? 'Nenhuma música vinculada. Clique em adicionar.' : 'Nenhuma música vinculada.'}
        </div>
      ) : (
        <ol className="space-y-1.5">
          {items.map((row, idx) => {
            const it = row.repertorio!;
            const Icon = TIPO_ICON[it.tipo];
            return (
              <li
                key={row.id}
                className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
              >
                <span className="w-6 text-center text-xs font-bold text-muted-foreground tabular-nums">
                  {idx + 1}.
                </span>
                <Icon className={cn('w-4 h-4 shrink-0', TIPO_COLOR[it.tipo])} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.titulo}</div>
                  <div className="flex gap-1.5 text-[10px] text-muted-foreground">
                    {it.tom && <span>Tom: {it.tom}</span>}
                    {it.bpm && <span>· {it.bpm} BPM</span>}
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {it.cifra && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCipher(it)} title="Ver cifra">
                      <Music2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {it.url && (
                    <Button asChild size="icon" variant="ghost" className="h-7 w-7" title="Abrir">
                      <a href={it.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  )}
                  {canEdit && (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(idx, -1)} disabled={idx === 0}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(idx, 1)} disabled={idx === items.length - 1}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(row.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {showPicker && (
        <PickerDialog
          open={showPicker}
          onClose={() => setShowPicker(false)}
          departmentId={departmentId}
          scheduleId={scheduleId}
          existingIds={items.map(i => i.repertorio_id)}
          startOrder={items.length}
          onAdded={() => { setShowPicker(false); load(); }}
        />
      )}

      <CipherViewer
        open={!!cipher}
        onClose={() => setCipher(null)}
        title={cipher?.titulo || ''}
        cifra={cipher?.cifra || ''}
        tom={cipher?.tom}
        bpm={cipher?.bpm}
      />
    </div>
  );
}

function PickerDialog({
  open, onClose, departmentId, scheduleId, existingIds, startOrder, onAdded,
}: {
  open: boolean; onClose: () => void; departmentId: string; scheduleId: string;
  existingIds: string[]; startOrder: number; onAdded: () => void;
}) {
  const [all, setAll] = useState<RepItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('repertorio' as any)
        .select('id, titulo, tipo, url, cifra, tom, bpm')
        .eq('departamento_id', departmentId)
        .eq('ativo', true)
        .order('titulo');
      setAll(((data || []) as any[]).filter(it => !existingIds.includes(it.id)));
      setLoading(false);
    })();
  }, [departmentId]);

  const filtered = all.filter(it =>
    !search.trim() || it.titulo.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const toggle = (id: string) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleAdd = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    const rows = selected.map((repId, i) => ({
      escala_id: scheduleId,
      repertorio_id: repId,
      ordem: startOrder + i,
    }));
    const { error } = await supabase.from('escala_repertorio' as any).insert(rows);
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Erro ao adicionar');
    } else {
      toast.success(`${selected.length} ${selected.length === 1 ? 'música adicionada' : 'músicas adicionadas'}`);
      onAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar do Repertório</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[50vh] -mx-2 px-2">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {all.length === 0 ? 'Repertório vazio. Cadastre itens primeiro.' : 'Nada encontrado.'}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(it => {
                const Icon = TIPO_ICON[it.tipo];
                const checked = selected.includes(it.id);
                return (
                  <label
                    key={it.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-accent',
                      checked && 'bg-primary/10 border-primary/40',
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(it.id)} />
                    <Icon className={cn('w-4 h-4 shrink-0', TIPO_COLOR[it.tipo])} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{it.titulo}</div>
                      <div className="flex gap-1.5 text-[10px] text-muted-foreground">
                        {it.tom && <span>{it.tom}</span>}
                        {it.bpm && <span>· {it.bpm} BPM</span>}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleAdd} disabled={selected.length === 0 || saving}>
            {saving ? 'Adicionando...' : `Adicionar (${selected.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
