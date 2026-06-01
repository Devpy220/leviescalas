import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Type, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  cifra: string;
  tom?: string | null;
  bpm?: number | null;
}

const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#',
};

function normalizeRoot(root: string): string {
  if (FLAT_TO_SHARP[root]) return FLAT_TO_SHARP[root];
  return root;
}

function transposeChord(chord: string, semitones: number): string {
  return chord.replace(/([A-G])(b|#)?([^/\s]*)(\/([A-G])(b|#)?)?/g, (m, r, acc, rest, _slash, br, bacc) => {
    const root = normalizeRoot((r || '') + (acc || ''));
    const idx = SHARP_SCALE.indexOf(root);
    if (idx === -1) return m;
    const newRoot = SHARP_SCALE[(idx + semitones + 120) % 12];
    let result = newRoot + (rest || '');
    if (br) {
      const broot = normalizeRoot((br || '') + (bacc || ''));
      const bidx = SHARP_SCALE.indexOf(broot);
      if (bidx !== -1) {
        result += '/' + SHARP_SCALE[(bidx + semitones + 120) % 12];
      }
    }
    return result;
  });
}

const CHORD_LINE_RE = /^[\s]*([A-G](b|#)?(m|maj|min|sus|dim|aug|add)?\d*(\/[A-G](b|#)?)?[\s]*)+$/;

function transposeCifra(cifra: string, semitones: number): string {
  if (!semitones) return cifra;
  return cifra
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (CHORD_LINE_RE.test(line)) {
        return line.replace(/[A-G](b|#)?[A-Za-z0-9]*(\/[A-G](b|#)?)?/g, (m) => transposeChord(m, semitones));
      }
      return line.replace(/\[([^\]]+)\]/g, (_m, inner) => `[${transposeChord(inner, semitones)}]`);
    })
    .join('\n');
}

export default function CipherViewer({ open, onClose, title, cifra, tom, bpm }: Props) {
  const [semitones, setSemitones] = useState(0);
  const [fontSize, setFontSize] = useState(16);

  const transposed = useMemo(() => transposeCifra(cifra || '', semitones), [cifra, semitones]);

  const transposedTom = useMemo(() => {
    if (!tom) return null;
    return transposeChord(tom, semitones);
  }, [tom, semitones]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          'p-0 gap-0 bg-zinc-950 text-zinc-100 border-zinc-800',
          'max-w-none w-screen h-[100dvh] sm:h-[92vh] sm:w-[92vw] sm:max-w-5xl',
          'rounded-none sm:rounded-2xl overflow-hidden flex flex-col',
        )}
        style={{ background: '#0a0a0f' }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3 bg-zinc-900/60 backdrop-blur">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate text-base sm:text-lg">{title}</h2>
            <div className="flex gap-2 mt-1 text-xs">
              {transposedTom && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 font-medium">
                  Tom: {transposedTom}{semitones !== 0 && <span className="ml-1 opacity-60">({semitones > 0 ? '+' : ''}{semitones})</span>}
                </span>
              )}
              {bpm && (
                <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 font-medium">
                  {bpm} BPM
                </span>
              )}
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 shrink-0">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-4 py-2 border-b border-zinc-800 flex flex-wrap gap-3 items-center bg-zinc-900/40">
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-400 mr-1">Tom</span>
            <Button size="icon" variant="outline" className="h-8 w-8 bg-zinc-900 border-zinc-700 hover:bg-zinc-800" onClick={() => setSemitones(s => s - 1)}>
              <Minus className="w-4 h-4" />
            </Button>
            <span className="w-10 text-center text-sm tabular-nums">{semitones > 0 ? `+${semitones}` : semitones}</span>
            <Button size="icon" variant="outline" className="h-8 w-8 bg-zinc-900 border-zinc-700 hover:bg-zinc-800" onClick={() => setSemitones(s => s + 1)}>
              <Plus className="w-4 h-4" />
            </Button>
            {semitones !== 0 && (
              <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-zinc-100 h-8" onClick={() => setSemitones(0)}>
                Reset
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <Type className="w-4 h-4 text-zinc-400 mr-1" />
            <Button size="icon" variant="outline" className="h-8 w-8 bg-zinc-900 border-zinc-700 hover:bg-zinc-800" onClick={() => setFontSize(s => Math.max(12, s - 2))}>
              <Minus className="w-4 h-4" />
            </Button>
            <span className="w-10 text-center text-sm tabular-nums">{fontSize}px</span>
            <Button size="icon" variant="outline" className="h-8 w-8 bg-zinc-900 border-zinc-700 hover:bg-zinc-800" onClick={() => setFontSize(s => Math.min(40, s + 2))}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto scroll-smooth">
          <pre
            className="font-mono whitespace-pre p-6 leading-relaxed text-zinc-100"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
          >
            {transposed}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
