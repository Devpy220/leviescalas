import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Check, QrCode, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/hooks/use-toast';

export default function Payment() {
  const [copiedPix, setCopiedPix] = useState(false);
  const { toast } = useToast();

  // PIX key - you can update this with the actual PIX key
  const pixKey = "sua-chave-pix@email.com";

  const copyPixKey = async () => {
    await navigator.clipboard.writeText(pixKey);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
    
    toast({
      title: 'Chave PIX copiada!',
      description: 'Cole no seu app de pagamento.',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-vibrant flex items-center justify-center shadow-glow-sm">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold text-foreground">
                  Pagamento
                </h1>
                <p className="text-xs text-muted-foreground">
                  Apoie o LEVI
                </p>
              </div>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* PIX Payment Card */}
          <Card className="border-primary/20">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl gradient-vibrant flex items-center justify-center shadow-glow mb-4">
                <QrCode className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Pagamento via PIX</CardTitle>
              <CardDescription>
                Escaneie o QR Code ou copie a chave PIX para fazer o pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* QR Code Placeholder - Replace with actual QR code image */}
              <div className="flex justify-center">
                <div className="w-64 h-64 bg-white rounded-2xl p-4 shadow-lg">
                  {/* Replace this div with an img tag pointing to your QR code */}
                  <div className="w-full h-full bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-border">
                    <div className="text-center text-muted-foreground">
                      <QrCode className="w-12 h-12 mx-auto mb-2" />
                      <p className="text-sm">QR Code PIX</p>
                      <p className="text-xs">(Envie a imagem)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PIX Key */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Ou copie a chave PIX:
                </p>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <code className="flex-1 text-sm font-mono truncate text-center">
                    {pixKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyPixKey}
                    className="shrink-0"
                  >
                    {copiedPix ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-3 pt-4 border-t border-border">
                <p className="text-sm font-medium text-foreground">Como pagar:</p>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Abra o app do seu banco</li>
                  <li>Escolha a opção PIX</li>
                  <li>Escaneie o QR Code ou cole a chave PIX</li>
                  <li>Confirme o pagamento</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Benefits Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">O que você ganha</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm">Acesso completo ao sistema</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm">Membros ilimitados no departamento</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm">Notificações por email</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm">Exportação para PDF e Excel</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm">Suporte prioritário</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
