import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, QrCode, Copy, Check, ArrowLeft, Heart } from "lucide-react";
import { toast } from "sonner";
import pixQrCode from "@/assets/pix-qrcode-levi.jpg";

const PIX_KEY = "b8bb0848-844b-467b-8422-382720b1e980";
const SUPPORT_EMAIL = "leviescalas@gmail.com";

const Payment = () => {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [copied, setCopied] = useState(false);

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Apoio ao Levi
          </h1>
          <p className="text-muted-foreground">
            Sua contribuição voluntária ajuda a manter o projeto
          </p>
        </div>

        <Card className="border-2 border-primary/30">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <QrCode className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>PIX</CardTitle>
            <CardDescription>
              Escaneie o QR code com o app do seu banco
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <img 
                src={pixQrCode} 
                alt="QR Code PIX - Apoio ao Levi" 
                className="w-64 h-64 rounded-lg border object-contain bg-white"
              />
            </div>
            
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">EDUARDO LINO DA SILVA</p>
              <p className="text-xs text-muted-foreground">Levi agradece, Deus abençoe!</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center font-medium">
                Chave PIX (UUID):
              </p>
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <code className="text-xs break-all">{PIX_KEY}</code>
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={copyPixKey}
              >
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
                Este QR Code não possui valor definido. Informe o valor que desejar no momento do pagamento.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Dúvidas? Entre em contato: {SUPPORT_EMAIL}</p>
        </div>
      </div>
    </div>
  );
};

export default Payment;
