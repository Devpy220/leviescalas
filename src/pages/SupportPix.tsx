import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, Heart, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { LeviLogo } from "@/components/LeviLogo";
import { SEO } from "@/components/SEO";
import Footer from "@/components/Footer";

const PIX_KEY = "leviescalas@gmail.com";
const TITULAR = "EDUARDO LINO DA SILVA";
const BANCO = "Banco BMG";
const STRIPE_DONATION_URL = "https://donate.stripe.com/9B63cw3ekcsy2wG6dw4AU00";

const SupportPix = () => {
  const [copied, setCopied] = useState(false);

  const copyPixKey = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopied(true);
      toast.success("Chave PIX copiada!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = PIX_KEY;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        toast.success("Chave PIX copiada!");
        setTimeout(() => setCopied(false), 3000);
      } catch {
        toast.error("Não foi possível copiar. Selecione e copie manualmente.");
      }
      document.body.removeChild(ta);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO title="Apoiar o LEVI — Doação via PIX" description="Apoie o LEVI com uma doação via PIX e ajude a manter o projeto gratuito para igrejas." path="/apoiar" />
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <LeviLogo size="lg" />
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold">Apoie o LEVI</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Sua contribuição mantém o projeto gratuito para todas as igrejas.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <Heart className="w-3.5 h-3.5 text-primary" fill="currentColor" />
              <span className="text-xs font-medium text-primary">
                Sugestão: R$ 25,00 (qualquer valor é bem-vindo)
              </span>
            </div>
          </div>

          <Card className="border-primary/20">
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground text-center">
                  Chave PIX (E-mail)
                </p>
                <div className="bg-muted rounded-lg px-3 py-2 text-center font-mono text-sm break-all">
                  {PIX_KEY}
                </div>
              </div>

              <Button
                onClick={copyPixKey}
                className="w-full h-12 text-base"
                size="lg"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 mr-2" />
                    Copiar chave PIX
                  </>
                )}
              </Button>

              <div className="text-center text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">Titular: </span>
                  <span className="font-medium">{TITULAR}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Banco: </span>
                  <span className="font-medium">{BANCO}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(STRIPE_DONATION_URL, "_blank")}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Pagar com cartão
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            🙏 Obrigado pelo seu carinho e apoio!
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SupportPix;
