import { useState, useEffect, useRef } from 'react';

const FULL_TEXT = 'Logística de Escalas para Voluntários da Igreja';

// Indices of the letters that form "LEVI": L(0), E(14), V(26), I(40)
const HIGHLIGHT_INDICES = new Set([0, 13, 26, 41]);

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
    <span className={`inline-flex items-baseline ${className}`}>
      <span className="text-[8px] sm:text-xs text-muted-foreground/70 font-medium tracking-wide whitespace-nowrap">
        {visibleText.split('').map((char, i) => {
          const isHighlight = HIGHLIGHT_INDICES.has(i);
          return (
            <span
              key={i}
              className={isHighlight ? 'font-extrabold text-[10px] sm:text-base' : ''}
              style={isHighlight ? { 
                color: 'hsl(var(--secondary))', 
                textShadow: '0 0 6px hsla(var(--secondary), 0.4)' 
              } : undefined}
            >
              {char}
            </span>
          );
        })}
        <span className="animate-pulse" style={{ color: 'hsl(var(--secondary))' }}>|</span>
      </span>
    </span>
  );
}
