import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface StrengthCriteria {
  label: string;
  test: (password: string) => boolean;
}

const criteria: StrengthCriteria[] = [
  { label: 'Mínimo 8 caracteres', test: (p) => p.length >= 8 },
  { label: 'Letra maiúscula', test: (p) => /[A-Z]/.test(p) },
  { label: 'Letra minúscula', test: (p) => /[a-z]/.test(p) },
  { label: 'Número', test: (p) => /\d/.test(p) },
  { label: 'Caractere especial', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { score, passedCriteria } = useMemo(() => {
    const passed = criteria.map((c) => c.test(password));
    const score = passed.filter(Boolean).length;
    return { score, passedCriteria: passed };
  }, [password]);

  const strengthLabel = useMemo(() => {
    if (password.length === 0) return '';
    if (score <= 1) return 'Muito fraca';
    if (score === 2) return 'Fraca';
    if (score === 3) return 'Média';
    if (score === 4) return 'Forte';
    return 'Muito forte';
  }, [score, password.length]);

  const strengthColor = useMemo(() => {
    if (score <= 1) return 'bg-destructive';
    if (score === 2) return 'bg-orange-500';
    if (score === 3) return 'bg-yellow-500';
    if (score === 4) return 'bg-emerald-500';
    return 'bg-emerald-600';
  }, [score]);

  if (password.length === 0) return null;

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Força da senha</span>
          <span className={cn(
            'text-xs font-medium',
            score <= 1 && 'text-destructive',
            score === 2 && 'text-orange-500',
            score === 3 && 'text-yellow-600',
            score >= 4 && 'text-emerald-600'
          )}>
            {strengthLabel}
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <div
              key={level}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all duration-300',
                level <= score ? strengthColor : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      {/* Criteria checklist */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {criteria.map((c, index) => (
          <div
            key={c.label}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors',
              passedCriteria[index] ? 'text-emerald-600' : 'text-muted-foreground'
            )}
          >
            {passedCriteria[index] ? (
              <Check className="w-3 h-3" />
            ) : (
              <X className="w-3 h-3" />
            )}
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
