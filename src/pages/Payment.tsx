import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useSidebarExpanded } from '@/contexts/SidebarContext';
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, QrCode, Copy, Check, Heart, Sparkles, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import pixQrCode from "@/assets/pix-qrcode-levi.jpg";
import Footer from "@/components/Footer";

const PIX_KEY = "suport@leviescalas.com.br";

const Payment = () => {
  const navigate = useNavigate();
  const { loading: authLoading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { shouldShowInstallPrompt, install } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const { expanded: sidebarExpanded } = useSidebarExpanded();
  const [cardAmount, setCardAmount] = useState("");
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const copyPixKey = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopied(true);
      toast.success("Chave PIX copiada!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar chave PIX");
    }
  };

  const handleStripeCheckout = async () => {
    const amount = Math.round(parseFloat(cardAmount.replace(",", ".")) * 100);
    if (isNaN(amount) || amount < 100) {
      toast.error("Valor mínimo: R$ 1,00");
      return;
    }

    setLoadingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-donation-checkout", {
        body: { amount },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("URL de checkout não retornada");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao iniciar pagamento");
    } finally {
      setLoadingCheckout(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col">
      <DashboardSidebar
        isAdmin={isAdmin}
        shouldShowInstallPrompt={shouldShowInstallPrompt()}
        onInstallClick={install}
        onSignOut={handleSignOut}
      />
      <div className={`${sidebarExpanded ? 'ml-56' : 'ml-16'} flex-1 flex flex-col transition-all duration-300`}>
        <div className="flex-1 py-8 px-4">
          <div className="max-w-lg mx-auto">

            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 relative">
                <Heart className="h-8 w-8 text-primary" fill="hsl(var(--primary))" />
                <Heart className="h-4 w-4 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" fill="#fbbf24" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Apoie o Projeto
              </h1>
              <p className="text-muted-foreground mb-4">
                Sua contribuição voluntária ajuda a manter o projeto gratuito para todos
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  Informe o valor que deseja contribuir
                </span>
              </div>
            </div>

            {/* Cartão - Stripe */}
            <Card className="border-2 border-primary/30 mb-6">
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Cartão de Crédito/Débito</CardTitle>
                <CardDescription>Pagamento seguro via Stripe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Valor (R$)</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="10,00"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleStripeCheckout}
                  disabled={loadingCheckout}
                >
                  {loadingCheckout ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Apoiar via cartão
                </Button>
              </CardContent>
            </Card>

            {/* PIX */}
            <Card className="border-2 border-rose-500/30">
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mb-2">
                  <QrCode className="h-6 w-6 text-rose-500" />
                </div>
                <CardTitle>PIX</CardTitle>
                <CardDescription>Escaneie o QR code com o app do seu banco</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <img
                    src={pixQrCode}
                    alt="QR Code PIX - Apoio Voluntário"
                    className="w-64 h-64 rounded-lg border object-contain bg-white"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">EDUARDO LINO DA SILVA</p>
                  <p className="text-xs text-muted-foreground">Obrigado pelo seu apoio! Deus abençoe!</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center font-medium">Chave PIX (E-mail):</p>
                  <div className="bg-muted/50 p-3 rounded-lg text-center">
                    <code className="text-xs break-all">{PIX_KEY}</code>
                  </div>
                  <Button variant="outline" className="w-full" onClick={copyPixKey}>
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar chave PIX
                      </>
                    )}
                  </Button>
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground text-center">
                    Este QR Code não possui valor definido. Informe qualquer valor no momento do pagamento.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
};

export default Payment;
