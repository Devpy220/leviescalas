import { useMemo } from 'react';
import { Check, X, Shield, KeyRound, AlertTriangle, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PasswordStrengthIndicatorProps {
  password: string;
  showSecurityTips?: boolean;
}

interface StrengthCriteria {
  label: string;
  test: (password: string) => boolean;
  required: boolean;
}

const criteria: StrengthCriteria[] = [
  { label: 'Mínimo 8 caracteres', test: (p) => p.length >= 8, required: true },
  { label: 'Letra maiúscula', test: (p) => /[A-Z]/.test(p), required: true },
  { label: 'Letra minúscula', test: (p) => /[a-z]/.test(p), required: true },
  { label: 'Número', test: (p) => /\d/.test(p), required: true },
  { label: 'Caractere especial (!@#$%^&*)', test: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'`~]/.test(p), required: true },
];

const securityTips = [
  {
    icon: KeyRound,
    text: 'Utilize um gerenciador de senhas para armazenar e gerar senhas seguras.',
  },
  {
    icon: AlertTriangle,
    text: 'Evite reutilizar senhas em diferentes sites e aplicativos.',
  },
  {
    icon: Shield,
    text: 'Evite usar informações pessoais em senhas (nome, data de nascimento, etc.).',
  },
  {
    icon: Smartphone,
    text: 'Ative a autenticação multifator (2FA) para maior segurança.',
  },
];

// Validates password meets all required criteria
export function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  criteria.forEach((c) => {
    if (c.required && !c.test(password)) {
      errors.push(c.label);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function PasswordStrengthIndicator({ password, showSecurityTips = true }: PasswordStrengthIndicatorProps) {
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

  const allRequiredMet = useMemo(() => {
    return criteria.every((c, idx) => !c.required || passedCriteria[idx]);
  }, [passedCriteria]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Security Tips - Always visible */}
      {showSecurityTips && (
        <Alert className="bg-primary/5 border-primary/20">
          <Shield className="h-4 w-4 text-primary" />
          <AlertDescription className="text-xs space-y-1.5 mt-1">
            <p className="font-medium text-foreground mb-2">Dicas de segurança:</p>
            {securityTips.map((tip, index) => (
              <div key={index} className="flex items-start gap-2 text-muted-foreground">
                <tip.icon className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary/70" />
                <span>{tip.text}</span>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {password.length > 0 && (
        <>
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
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Requisitos obrigatórios:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {criteria.map((c, index) => (
                <div
                  key={c.label}
                  className={cn(
                    'flex items-center gap-1.5 text-xs transition-colors',
                    passedCriteria[index] ? 'text-emerald-600' : 'text-destructive'
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

          {/* Status message */}
          {!allRequiredMet && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              A senha deve atender todos os requisitos acima.
            </p>
          )}
        </>
      )}
    </div>
  );
}
