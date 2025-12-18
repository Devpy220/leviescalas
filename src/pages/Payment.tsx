import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard, QrCode, Copy, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import pixQrCode from "@/assets/pix-qrcode.jpg";

const PIX_KEY = "00020126580014br.gov.bcb.pix0136e8f0b0c8-1234-5678-9abc-def012345678520400005303986540510.005802BR5925NOME DO RECEBEDOR6009SAO PAULO62070503***6304ABCD";

const Payment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [department, setDepartment] = useState<{ id: string; name: string } | null>(null);
  
  const departmentId = searchParams.get("departmentId");
  const type = searchParams.get("type") || "subscription"; // subscription or support

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Escolha a forma de pagamento
          </h1>
          <p className="text-muted-foreground">
            {department ? `Assinatura para ${department.name}` : "Assinatura do departamento"}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* PIX Option */}
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>PIX</CardTitle>
              <CardDescription>
                Pagamento instantâneo via PIX
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <img 
                  src={pixQrCode} 
                  alt="QR Code PIX" 
                  className="w-48 h-48 rounded-lg border"
                />
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Escaneie o QR Code ou copie a chave PIX
                </p>
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

              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Após o pagamento, envie o comprovante para ativar sua assinatura
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card Option via Stripe */}
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Cartão de Crédito</CardTitle>
              <CardDescription>
                Pagamento seguro via Stripe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Plano mensal</span>
                  <span className="font-medium">R$ 25,00/mês</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Por voluntário</span>
                  <span className="font-medium">R$ 25,00/mês</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Período de teste</span>
                    <span className="font-medium text-green-600">14 dias grátis</span>
                  </div>
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
                    Pagar com Cartão
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/stripe/stripe-plain.svg" alt="Stripe" className="h-4" />
                <span>Pagamento seguro via Stripe</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Dúvidas? Entre em contato conosco pelo suporte.</p>
        </div>
      </div>
    </div>
  );
};

export default Payment;
