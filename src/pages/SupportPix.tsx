import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, Heart, CreditCard } from "lucide-react";
import { toast } from "sonner";
import pixQrCode from "@/assets/pix-qrcode-levi.jpg";
import { LeviLogo } from "@/components/LeviLogo";
import Footer from "@/components/Footer";

const PIX_KEY = "suport@leviescalas.com.br";
const TITULAR = "EDUARDO LINO DA SILVA";

const SupportPix = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyPixKey = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopied(true);
      toast.success("Chave PIX copiada!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
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
          </div>

          <Card className="border-primary/20">
            <CardContent className="p-6 space-y-5">
              <div className="flex justify-center">
                <img
                  src={pixQrCode}
                  alt="QR Code PIX para apoiar o LEVI"
                  className="w-48 h-48 rounded-lg border"
                />
              </div>

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

              <div className="text-center text-sm">
                <span className="text-muted-foreground">Titular: </span>
                <span className="font-medium">{TITULAR}</span>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/payment")}
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
