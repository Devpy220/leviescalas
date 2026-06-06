import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Music, Video, FileText, FileBox, LinkIcon, Plus, Search,
  ExternalLink, Pencil, Trash2, Music2, X, Youtube, Upload, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getYouTubeEmbedUrl, getYouTubeThumbnail } from '@/lib/youtube';
import CipherViewer from './CipherViewer';

function youtubeSearchUrl(q: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function sanitizeFileName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

type TipoRep = 'musica' | 'video' | 'cifra' | 'documento' | 'link';

interface RepItem {
  id: string;
  departamento_id: string;
  titulo: string;
  tipo: TipoRep;
  url: string | null;
  cifra: string | null;
  tom: string | null;
  bpm: number | null;
  tags: string[] | null;
  observacoes: string | null;
  pdf_url: string | null;
  criado_por: string;
  criado_em: string;
  ativo: boolean;
}

interface Props {
  departmentId: string;
  isLeader: boolean;
  currentUserId: string;
}

const TIPO_META: Record<TipoRep, { label: string; Icon: typeof Music; color: string; bg: string }> = {
  musica:    { label: 'Música',    Icon: Music,    color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  video:     { label: 'Vídeo',     Icon: Video,    color: 'text-rose-500',   bg: 'bg-rose-500/10' },
  cifra:     { label: 'Cifra',     Icon: Music2,   color: 'text-violet-500', bg: 'bg-violet-500/10' },
  documento: { label: 'Documento', Icon: FileText, color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  link:      { label: 'Link',      Icon: LinkIcon, color: 'text-emerald-500',bg: 'bg-emerald-500/10' },
};

const TAG_SUGGESTIONS = ['Adoração', 'Abertura', 'Comunhão', 'Santa Ceia'];

export default function RepertoireView({ departmentId, isLeader, currentUserId }: Props) {
  const [items, setItems] = useState<RepItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | TipoRep>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RepItem | null>(null);
  const [cifraView, setCifraView] = useState<RepItem | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('repertorio' as any)
      .select('*')
      .eq('departamento_id', departmentId)
      .eq('ativo', true)
      .order('criado_em', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar repertório');
    } else {
      setItems((data || []) as any);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [departmentId]);

  const filtered = useMemo(() => {
    return items.filter(it => {
      if (filter !== 'all' && it.tipo !== filter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const inTitle = it.titulo.toLowerCase().includes(q);
        const inTags = (it.tags || []).some(t => t.toLowerCase().includes(q));
        if (!inTitle && !inTags) return false;
      }
      return true;
    });
  }, [items, filter, search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este item do repertório?')) return;
    const { error } = await supabase.from('repertorio' as any).delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover');
    } else {
      toast.success('Removido');
      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Repertório</h2>
          <p className="text-sm text-muted-foreground">Biblioteca de músicas, vídeos, cifras e documentos do departamento.</p>
        </div>
        {isLeader && (
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all','musica','video','cifra','documento','link'] as const).map(f => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
              className="shrink-0"
            >
              {f === 'all' ? 'Todos' : TIPO_META[f].label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nenhum item no repertório ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(item => {
            const meta = TIPO_META[item.tipo];
            const Icon = meta.Icon;
            const ytEmbed = getYouTubeEmbedUrl(item.url);
            const ytThumb = getYouTubeThumbnail(item.url);
            return (
              <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {ytEmbed && (
                  <div className="relative w-full aspect-video bg-black">
                    <iframe
                      src={ytEmbed}
                      title={item.titulo}
                      loading="lazy"
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                )}
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={cn('p-2.5 rounded-xl shrink-0', meta.bg)}>
                      <Icon className={cn('w-5 h-5', meta.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold leading-tight truncate">{item.titulo}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {meta.label}{ytEmbed && ' · YouTube'}
                      </p>
                    </div>
                  </div>

                  {(item.tom || item.bpm) && (
                    <div className="flex gap-2 text-xs">
                      {item.tom && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                          Tom: {item.tom}
                        </span>
                      )}
                      {item.bpm && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                          {item.bpm} BPM
                        </span>
                      )}
                    </div>
                  )}

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                      ))}
                    </div>
                  )}

                  {item.observacoes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.observacoes}</p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.url && !ytEmbed && (
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" /> Abrir link
                        </a>
                      </Button>
                    )}
                    {ytEmbed && (
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <a href={item.url!} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" /> Abrir no YouTube
                        </a>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline" className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30">
                      <a href={youtubeSearchUrl(item.titulo)} target="_blank" rel="noopener noreferrer">
                        <Youtube className="w-3.5 h-3.5" /> Buscar YouTube
                      </a>
                    </Button>
                    {item.pdf_url && (
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <a href={item.pdf_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="w-3.5 h-3.5" /> PDF
                        </a>
                      </Button>
                    )}
                    {item.cifra && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCifraView(item)}>
                        <Music2 className="w-3.5 h-3.5" /> Ver cifra
                      </Button>
                    )}
                    {isLeader && (
                      <div className="ml-auto flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(item); setShowForm(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <RepertoireFormDialog
          open={showForm}
          onClose={() => { setShowForm(false); setEditing(null); }}
          departmentId={departmentId}
          currentUserId={currentUserId}
          editing={editing}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}

      <CipherViewer
        open={!!cifraView}
        onClose={() => setCifraView(null)}
        title={cifraView?.titulo || ''}
        cifra={cifraView?.cifra || ''}
        tom={cifraView?.tom}
        bpm={cifraView?.bpm}
      />
    </div>
  );
}

interface FormProps {
  open: boolean;
  onClose: () => void;
  departmentId: string;
  currentUserId: string;
  editing: RepItem | null;
  onSaved: () => void;
}

function RepertoireFormDialog({ open, onClose, departmentId, currentUserId, editing, onSaved }: FormProps) {
  const [tipo, setTipo] = useState<TipoRep>(editing?.tipo || 'musica');
  const [titulo, setTitulo] = useState(editing?.titulo || '');
  const [url, setUrl] = useState(editing?.url || '');
  const [tom, setTom] = useState(editing?.tom || '');
  const [bpm, setBpm] = useState<string>(editing?.bpm?.toString() || '');
  const [cifra, setCifra] = useState(editing?.cifra || '');
  const [tags, setTags] = useState<string[]>(editing?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [observacoes, setObservacoes] = useState(editing?.observacoes || '');
  const [pdfUrl, setPdfUrl] = useState<string>(editing?.pdf_url || '');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const showTom = tipo === 'musica';
  const showBpm = tipo === 'musica';
  const showCifra = tipo === 'musica' || tipo === 'cifra';

  const addTag = (t: string) => {
    const v = t.trim();
    if (!v || tags.includes(v)) return;
    setTags([...tags, v]);
    setTagInput('');
  };

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast.error('Informe o título');
      return;
    }
    setSaving(true);
    const payload: any = {
      departamento_id: departmentId,
      titulo: titulo.trim(),
      tipo,
      url: url.trim() || null,
      tom: showTom ? (tom.trim() || null) : null,
      bpm: showBpm && bpm ? parseInt(bpm, 10) : null,
      cifra: showCifra ? (cifra.trim() || null) : null,
      tags,
      observacoes: observacoes.trim() || null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from('repertorio' as any).update(payload).eq('id', editing.id));
    } else {
      payload.criado_por = currentUserId;
      ({ error } = await supabase.from('repertorio' as any).insert(payload));
    }

    if (error) {
      toast.error(error.message || 'Erro ao salvar');
    } else {
      toast.success(editing ? 'Atualizado' : 'Adicionado ao repertório');
      onSaved();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar item' : 'Adicionar ao Repertório'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRep)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="musica">Música</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="cifra">Cifra</SelectItem>
                <SelectItem value="documento">Documento</SelectItem>
                <SelectItem value="link">Link</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Em Espírito, em Verdade" />
          </div>

          <div className="space-y-2">
            <Label>Link (qualquer URL)</Label>
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Cole aqui qualquer link (YouTube, Drive, Spotify, PDF, site...)"
              inputMode="url"
              type="url"
            />
            <p className="text-xs text-muted-foreground">
              Aceita qualquer link. Se for do YouTube, o vídeo será exibido automaticamente no card.
            </p>
          </div>

          {showTom && (
            <div className="space-y-2">
              <Label>Tom</Label>
              <Input value={tom} onChange={e => setTom(e.target.value)} placeholder="Ex: Lá menor" />
            </div>
          )}

          {showBpm && (
            <div className="space-y-2">
              <Label>BPM</Label>
              <Input type="number" value={bpm} onChange={e => setBpm(e.target.value)} placeholder="Ex: 72" />
            </div>
          )}

          {showCifra && (
            <div className="space-y-2">
              <Label>Cifra</Label>
              <Textarea value={cifra} onChange={e => setCifra(e.target.value)} rows={8} className="font-mono text-sm" placeholder="Cole aqui a cifra..." />
            </div>
          )}

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button type="button" onClick={() => setTags(tags.filter(x => x !== t))}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }}}
                placeholder="Adicionar tag e Enter"
              />
              <Button type="button" variant="outline" onClick={() => addTag(tagInput)}>+</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TAG_SUGGESTIONS.filter(s => !tags.includes(s)).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addTag(s)}
                  className="text-xs px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:bg-accent"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : (editing ? 'Salvar' : 'Adicionar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
