import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface LeviTypewriterProps {
  className?: string;
}

// Find indices in `text` that spell out "LEVI" in order (case-insensitive),
// preferring word-initial letters when possible.
function findLeviIndices(text: string): Set<number> {
  const target = ['L', 'E', 'V', 'I'];
  const upper = text.toUpperCase();
  const result: number[] = [];
  let cursor = 0;

  for (const letter of target) {
    // Prefer a letter at the start of a word from `cursor` onward
    let foundIdx = -1;
    for (let i = cursor; i < upper.length; i++) {
      if (upper[i] !== letter) continue;
      const prev = i === 0 ? ' ' : upper[i - 1];
      if (!/[A-Z\u00C0-\u017F]/.test(prev)) {
        foundIdx = i;
        break;
      }
    }
    // Fallback: any occurrence
    if (foundIdx === -1) {
      foundIdx = upper.indexOf(letter, cursor);
    }
    if (foundIdx === -1) return new Set();
    result.push(foundIdx);
    cursor = foundIdx + 1;
  }
  return new Set(result);
}

export function LeviTypewriter({ className = '' }: LeviTypewriterProps) {
  const { t, i18n } = useTranslation();
  const fullText = t('landing.typewriterFull');
  const highlightIndices = useMemo(() => findLeviIndices(fullText), [fullText]);

  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pause' | 'deleting'>('typing');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Reset animation when language (and thus text) changes
  useEffect(() => {
    setCharCount(0);
    setPhase('typing');
  }, [i18n.language, fullText]);

  useEffect(() => {
    if (phase === 'typing') {
      if (charCount >= fullText.length) {
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
  }, [charCount, phase, fullText]);

  const visibleText = fullText.slice(0, charCount);

  return (
    <span className={`inline-flex items-baseline ${className}`}>
      <span className="text-[8px] sm:text-xs text-muted-foreground/70 font-medium tracking-wide whitespace-nowrap">
        {visibleText.split('').map((char, i) => {
          const isHighlight = highlightIndices.has(i);
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
