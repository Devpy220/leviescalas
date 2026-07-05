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
        'w-full max-w-2xl mx-auto text-center px-4',
        className,
      )}
      role="region"
      aria-label="Versículo bíblico"
    >
      <p className="text-sm sm:text-base leading-relaxed text-foreground/90 italic font-medium min-h-[3em]">
        “{visible}
        <span className="ml-0.5 inline-block w-[2px] h-[1em] align-middle bg-primary/80 animate-pulse" />
        ”
      </p>
      <p
        className={cn(
          'mt-2 text-xs sm:text-sm font-semibold tracking-wide text-primary transition-opacity duration-300',
          showRef ? 'opacity-100' : 'opacity-0',
        )}
      >
        — {current.ref}
      </p>
    </div>
  );
}

