import { useState, useEffect, useRef } from 'react';

const FULL_TEXT = 'Logística de Escalas para Voluntários da Igreja';
const HIGHLIGHT_LETTERS = new Set(['L', 'E', 'V', 'I']);

interface LeviTypewriterProps {
  className?: string;
}

export function LeviTypewriter({ className = '' }: LeviTypewriterProps) {
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pause' | 'deleting'>('typing');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (phase === 'typing') {
      if (charCount >= FULL_TEXT.length) {
        timerRef.current = setTimeout(() => setPhase('pause'), 2000);
      } else {
        timerRef.current = setTimeout(() => setCharCount(c => c + 1), 45);
      }
    } else if (phase === 'pause') {
      timerRef.current = setTimeout(() => setPhase('deleting'), 500);
    } else if (phase === 'deleting') {
      if (charCount <= 0) {
        timerRef.current = setTimeout(() => setPhase('typing'), 400);
      } else {
        timerRef.current = setTimeout(() => setCharCount(c => c - 1), 25);
      }
    }
    return () => clearTimeout(timerRef.current);
  }, [charCount, phase]);

  const visibleText = FULL_TEXT.slice(0, charCount);

  return (
    <span className={`inline-flex items-baseline gap-0 ${className}`}>
      <span className="font-display font-bold text-amber-400 tracking-tight text-lg sm:text-xl mr-1.5 drop-shadow-[0_0_6px_hsl(45_100%_50%/0.4)]">
        LEVI
      </span>
      <span className="text-[10px] sm:text-xs text-muted-foreground/70 font-medium tracking-wide hidden sm:inline">
        {visibleText.split('').map((char, i) => {
          const isHighlight = HIGHLIGHT_LETTERS.has(char);
          return (
            <span
              key={i}
              className={isHighlight ? 'font-bold text-amber-400' : ''}
            >
              {char}
            </span>
          );
        })}
        <span className="animate-pulse text-amber-400">|</span>
      </span>
    </span>
  );
}
