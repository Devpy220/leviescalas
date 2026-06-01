import { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const VERSES: { text: string; ref: string }[] = [
  {
    text: 'Portanto, quer comais quer bebais, ou façais qualquer outra coisa, fazei tudo para glória de Deus.',
    ref: '1 Coríntios 10:31',
  },
  {
    text: 'Tudo o que fizerem, façam de todo o coração, como para o Senhor, e não para os homens, sabendo que receberão do Senhor a herança como recompensa.',
    ref: 'Colossenses 3:23-24',
  },
  {
    text: 'Se, porém, não agrada a vocês servir ao Senhor, escolham hoje a quem irão servir... Eu, porém, e a minha família serviremos ao Senhor.',
    ref: 'Josué 24:15',
  },
];

interface BibleVerseTypewriterProps {
  className?: string;
}

export function BibleVerseTypewriter({ className }: BibleVerseTypewriterProps) {
  const [verseIdx, setVerseIdx] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pause' | 'deleting'>('typing');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const current = VERSES[verseIdx];
  const full = current.text;

  useEffect(() => {
    if (phase === 'typing') {
      if (charCount >= full.length) {
        timerRef.current = setTimeout(() => setPhase('pause'), 3500);
      } else {
        timerRef.current = setTimeout(() => setCharCount((c) => c + 1), 35);
      }
    } else if (phase === 'pause') {
      timerRef.current = setTimeout(() => setPhase('deleting'), 600);
    } else {
      if (charCount <= 0) {
        setVerseIdx((i) => (i + 1) % VERSES.length);
        setPhase('typing');
      } else {
        timerRef.current = setTimeout(() => setCharCount((c) => c - 1), 12);
      }
    }
    return () => clearTimeout(timerRef.current);
  }, [charCount, phase, full]);

  const visible = full.slice(0, charCount);
  const showRef = phase === 'pause' || (phase === 'typing' && charCount >= full.length);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/15 dark:border-white/10',
        'bg-white/40 dark:bg-white/5 backdrop-blur-xl shadow-lg',
        'px-4 py-3 sm:px-5 sm:py-4 max-w-xl w-full min-h-[120px]',
        className,
      )}
      role="region"
      aria-label="Versículo bíblico"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 0% 0%, hsl(var(--primary) / 0.10), transparent 60%), radial-gradient(circle at 100% 100%, hsl(var(--secondary) / 0.10), transparent 60%)',
        }}
      />
      <div className="relative flex items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-1.5 text-primary">
          <BookOpen className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm leading-relaxed text-foreground/90 italic font-medium min-h-[2.5em]">
            “{visible}
            <span className="ml-0.5 inline-block w-[2px] h-[1em] align-middle bg-primary/80 animate-pulse" />
            ”
          </p>
          <p
            className={cn(
              'mt-1 text-[10px] sm:text-xs font-semibold tracking-wide text-primary transition-opacity duration-300',
              showRef ? 'opacity-100' : 'opacity-0',
            )}
          >
            — {current.ref}
          </p>
        </div>
      </div>
    </div>
  );
}
