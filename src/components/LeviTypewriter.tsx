import { useState, useEffect } from 'react';

const FULL_TEXT = 'Logística de Escalas para Voluntários da Igreja';
const HIGHLIGHT_LETTERS = new Set(['L', 'E', 'V', 'I']);

interface LeviTypewriterProps {
  className?: string;
}

export function LeviTypewriter({ className = '' }: LeviTypewriterProps) {
  const [charCount, setCharCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (charCount >= FULL_TEXT.length) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => setCharCount(c => c + 1), 45);
    return () => clearTimeout(t);
  }, [charCount]);

  const visibleText = FULL_TEXT.slice(0, charCount);

  return (
    <span className={`inline-flex items-baseline gap-0 ${className}`}>
      <span className="font-display font-bold text-destructive tracking-tight text-lg sm:text-xl mr-1.5">
        LEVI
      </span>
      <span className="text-[10px] sm:text-xs text-muted-foreground/70 font-medium tracking-wide hidden sm:inline">
        {visibleText.split('').map((char, i) => {
          const isUpper = HIGHLIGHT_LETTERS.has(char);
          return (
            <span
              key={i}
              className={isUpper ? 'font-bold text-destructive/80' : ''}
            >
              {char}
            </span>
          );
        })}
        {!done && <span className="animate-pulse text-destructive">|</span>}
      </span>
    </span>
  );
}
