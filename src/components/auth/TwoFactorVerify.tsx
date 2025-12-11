import { useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TwoFactorVerifyProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function TwoFactorVerify({ onSuccess, onCancel }: TwoFactorVerifyProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState('');
  const { toast } = useToast();

  const handleVerify = async () => {
    if (code.length !== 6) return;

    setIsLoading(true);
    try {
      // List factors to get the TOTP factor
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const totpFactor = factors?.totp?.[0];
      if (!totpFactor) {
        throw new Error('Nenhum fator TOTP encontrado');
      }

      // Create challenge
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });
      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) throw verifyError;

      toast({
        title: 'Verificação concluída',
        description: 'Login realizado com sucesso.',
      });
      
      onSuccess();
    } catch (error: any) {
      const message = error.message?.includes('Invalid')
        ? 'Código inválido. Tente novamente.'
        : error.message || 'Erro na verificação.';
      
      toast({
        variant: 'destructive',
        title: 'Erro na verificação',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Verificação 2FA</h2>
        <p className="text-muted-foreground">
          Digite o código do seu aplicativo autenticador para continuar.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="2fa-code">Código de verificação</Label>
        <Input
          id="2fa-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="text-center text-2xl tracking-widest font-mono h-14"
          autoFocus
        />
        <p className="text-xs text-muted-foreground text-center">
          Abra seu aplicativo autenticador e insira o código de 6 dígitos.
        </p>
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleVerify}
          disabled={isLoading || code.length !== 6}
          className="w-full h-12 gradient-vibrant text-white shadow-glow-sm hover:shadow-glow transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Verificando...
            </>
          ) : (
            'Verificar'
          )}
        </Button>
        
        <Button
          variant="ghost"
          onClick={onCancel}
          className="w-full"
          disabled={isLoading}
        >
          Voltar ao login
        </Button>
      </div>
    </div>
  );
}
