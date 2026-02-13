import { useState, useEffect, useCallback } from 'react';
import { Send, Copy, Check, Loader2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const BOT_USERNAME = 'levi_escalas_bot'; // Will be updated when user provides bot info

export function TelegramLinkToggle() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLinked, setIsLinked] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry] = useState<Date | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const checkLink = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('telegram_links' as any)
        .select('id, username, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        setIsLinked(true);
        setTelegramUsername((data as any).username);
      } else {
        setIsLinked(false);
        setTelegramUsername(null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkLink();
  }, [checkLink]);

  // Poll for link status when code is active
  useEffect(() => {
    if (!code || isLinked) return;
    const interval = setInterval(checkLink, 3000);
    return () => clearInterval(interval);
  }, [code, isLinked, checkLink]);

  const generateCode = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      // Generate a 6-digit code
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const { error } = await supabase
        .from('telegram_link_codes' as any)
        .insert({
          user_id: user.id,
          code: newCode,
          expires_at: expiresAt.toISOString(),
        } as any);

      if (error) throw error;

      setCode(newCode);
      setCodeExpiry(expiresAt);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível gerar o código. Tente novamente.',
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyCommand = () => {
    if (!code) return;
    navigator.clipboard.writeText(`/start ${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copiado!', description: 'Comando copiado para a área de transferência.' });
  };

  const unlinkTelegram = async () => {
    if (!user) return;
    setUnlinking(true);
    try {
      await supabase
        .from('telegram_links' as any)
        .update({ is_active: false } as any)
        .eq('user_id', user.id);

      setIsLinked(false);
      setTelegramUsername(null);
      setCode(null);
      toast({ title: 'Desvinculado', description: 'Telegram desvinculado com sucesso.' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível desvincular.' });
    } finally {
      setUnlinking(false);
    }
  };

  const isCodeExpired = codeExpiry && new Date() > codeExpiry;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isLinked ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'
          }`}>
            <Send className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Telegram</CardTitle>
            <CardDescription>
              Receba notificações de escalas pelo Telegram
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLinked ? (
          <>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex-1">
                <p className="font-medium text-foreground">✅ Telegram vinculado</p>
                <p className="text-sm text-muted-foreground">
                  {telegramUsername ? `@${telegramUsername}` : 'Conta vinculada'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={unlinkTelegram}
                disabled={unlinking}
              >
                {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                <span className="ml-2">Desvincular</span>
              </Button>
            </div>
          </>
        ) : (
          <>
            {!code || isCodeExpired ? (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="font-medium text-foreground">Vincular Telegram</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Gere um código de vinculação e envie para o bot do LEVI no Telegram.
                  </p>
                </div>
                <Button onClick={generateCode} disabled={generating} className="w-full">
                  {generating ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Gerando...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Gerar código de vinculação</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="font-medium text-foreground mb-2">Siga os passos:</p>
                  <ol className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">1.</span>
                      Abra o Telegram e procure por <strong>@{BOT_USERNAME}</strong>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">2.</span>
                      Envie o comando abaixo para o bot:
                    </li>
                  </ol>
                  
                  <div className="mt-3 flex items-center gap-2">
                    <code className="flex-1 bg-background px-3 py-2 rounded-md font-mono text-sm border">
                      /start {code}
                    </code>
                    <Button size="sm" variant="outline" onClick={copyCommand}>
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    ⏱ Código válido por 5 minutos
                  </p>
                </div>

                <Button variant="outline" size="sm" onClick={generateCode} disabled={generating}>
                  Gerar novo código
                </Button>
              </div>
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Notificações via Telegram: novas escalas, lembretes e atualizações de trocas.
        </p>
      </CardContent>
    </Card>
  );
}
