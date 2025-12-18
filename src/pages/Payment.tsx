import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard, QrCode, Copy, Check, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import pixQrCode from "@/assets/pix-qrcode-10.jpg";

const PIX_KEY = "b8bb0848-844b-467b-8422-382720b1e980";
const SUPPORT_EMAIL = "leviescalas@gmail.com";

type PaymentMethod = "select" | "pix" | "card";
type CardType = "credit" | "debit";

const Payment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [department, setDepartment] = useState<{ id: string; name: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("select");
  const [cardType, setCardType] = useState<CardType>("credit");
  
  const departmentId = searchParams.get("departmentId");
  const type = searchParams.get("type") || "subscription";

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchDepartment = async () => {
      if (!departmentId) return;
      
      const { data, error } = await supabase
        .rpc('get_department_basic', { dept_id: departmentId });
      
      if (!error && data && data.length > 0) {
        setDepartment({ id: data[0].id, name: data[0].name });
      }
    };

    fetchDepartment();
  }, [departmentId]);

  const handleStripeCheckout = async () => {
    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    setLoading(true);
    try {
      const functionName = type === "support" ? "create-support-checkout" : "create-checkout";
      const body = type === "support" 
        ? { priceId: "price_support" } 
        : { departmentName: department?.name || "Departamento", departmentDescription: "" };

      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error("Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  };

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

  const sendReceipt = () => {
    const subject = encodeURIComponent("Comprovante PIX - Apoio ao Levi");
    const body = encodeURIComponent(`Olá,\n\nSegue em anexo o comprovante de pagamento PIX no valor de R$ 10,00.\n\nDepartamento: ${department?.name || "N/A"}\nEmail: ${user?.email || "N/A"}\n\nAtenciosamente.`);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
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
      <div className="max-w-2xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => {
            if (paymentMethod !== "select") {
              setPaymentMethod("select");
            } else if (departmentId) {
              navigate(`/department/${departmentId}`);
            } else {
              navigate("/dashboard");
            }
          }}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Apoio ao Levi
          </h1>
          <p className="text-muted-foreground">
            Escolha a forma de pagamento
          </p>
          <p className="text-2xl font-bold text-primary mt-2">R$ 10,00</p>
        </div>

        {paymentMethod === "select" && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card 
              className="border-2 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => setPaymentMethod("pix")}
            >
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <QrCode className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">PIX</CardTitle>
                <CardDescription>
                  Pagamento instantâneo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Selecionar PIX
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="border-2 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => setPaymentMethod("card")}
            >
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <CreditCard className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Cartão</CardTitle>
                <CardDescription>
                  Crédito ou Débito via Stripe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Selecionar Cartão
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {paymentMethod === "pix" && (
          <Card className="border-2 border-primary/30">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Apoio ao Levi</CardTitle>
              <CardDescription>
                Abra o app do seu banco e escaneie o QR code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <img 
                  src={pixQrCode} 
                  alt="QR Code PIX" 
                  className="w-56 h-56 rounded-lg border"
                />
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

              <div className="border-t pt-6 space-y-4">
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                    Após o pagamento, envie o comprovante para ativar
                  </p>
                </div>
                
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={sendReceipt}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar Comprovante por Email
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  O email será enviado para: <strong>{SUPPORT_EMAIL}</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {paymentMethod === "card" && (
          <Card className="border-2 border-primary/30">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Apoio ao Levi</CardTitle>
              <CardDescription>
                Escolha o tipo de cartão
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup 
                value={cardType} 
                onValueChange={(value) => setCardType(value as CardType)}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem 
                    value="credit" 
                    id="credit" 
                    className="peer sr-only" 
                  />
                  <Label
                    htmlFor="credit"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <CreditCard className="mb-3 h-6 w-6" />
                    <span className="text-sm font-medium">Crédito</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem 
                    value="debit" 
                    id="debit" 
                    className="peer sr-only" 
                  />
                  <Label
                    htmlFor="debit"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <CreditCard className="mb-3 h-6 w-6" />
                    <span className="text-sm font-medium">Débito</span>
                  </Label>
                </div>
              </RadioGroup>

              <div className="space-y-3 py-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-medium">R$ 10,00</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="font-medium">{cardType === "credit" ? "Cartão de Crédito" : "Cartão de Débito"}</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                size="lg"
                onClick={handleStripeCheckout}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pagar com {cardType === "credit" ? "Crédito" : "Débito"}
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Pagamento seguro via Stripe</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Dúvidas? Entre em contato: {SUPPORT_EMAIL}</p>
        </div>
      </div>
    </div>
  );
};

export default Payment;
