import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Heart, CreditCard, QrCode, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LeviLogo } from "@/components/LeviLogo";
import { SEO } from "@/components/SEO";
import Footer from "@/components/Footer";

const PRESETS = [10, 25, 50, 100];

const Apoiar = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"one_time" | "subscription">("one_time");
  const [method, setMethod] = useState<"pix" | "credit_card">("pix");
  const [amount, setAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorWhats, setDonorWhats] = useState("");
  const [loading, setLoading] = useState(false);

  const status = searchParams.get("status");

  useEffect(() => {
    if (status === "success") toast.success("Pagamento recebido! Obrigado pelo apoio 💜");
    if (status === "cancel") toast.info("Pagamento cancelado. Volte quando quiser apoiar.");
  }, [status]);

  const effectiveAmount = customAmount ? Math.max(5, Math.round(Number(customAmount.replace(",", ".")) || 0)) : amount;

  const handleSupport = async () => {
    if (!effectiveAmount || effectiveAmount < 5) {
      toast.error("Valor mínimo R$ 5,00");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cakto-create-payment", {
        body: {
          amount: effectiveAmount,
          mode,
          payment_method: method,
          donor_name: donorName.trim() || undefined,
          donor_email: donorEmail.trim() || undefined,
          donor_whatsapp: donorWhats.replace(/\D/g, "") || undefined,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Checkout não retornou URL");
      window.location.href = data.url as string;
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível iniciar o pagamento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO title="Apoiar o LEVI — PIX e Cartão via Cakto" description="Apoie o LEVI com doação única ou assinatura mensal. PIX automático ou cartão de crédito." path="/apoiar" />
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <LeviLogo size="lg" />
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" fill="currentColor" />
              <h1 className="text-2xl font-bold">Apoie o LEVI</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Sua contribuição mantém o LEVI gratuito para todas as igrejas.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <Heart className="w-3.5 h-3.5 text-primary" fill="currentColor" />
              <span className="text-xs font-medium text-primary">
                Sugestão: R$ 25,00
              </span>
            </div>
          </div>

          <Card>
            <CardContent className="p-6 space-y-5">
              <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="one_time">Doação única</TabsTrigger>
                  <TabsTrigger value="subscription">Assinatura mensal</TabsTrigger>
                </TabsList>
                <TabsContent value="one_time" className="mt-4 text-center text-xs text-muted-foreground">
                  Um único pagamento de qualquer valor.
                </TabsContent>
                <TabsContent value="subscription" className="mt-4 text-center text-xs text-muted-foreground">
                  Cobrança mensal automática (PIX recorrente ou cartão). Você pode cancelar quando quiser.
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESETS.map((v) => (
                    <Button
                      key={v}
                      variant={!customAmount && amount === v ? "default" : "outline"}
                      onClick={() => { setAmount(v); setCustomAmount(""); }}
                      type="button"
                    >R$ {v}</Button>
                  ))}
                </div>
                <Input
                  placeholder="Outro valor (ex: 75)"
                  value={customAmount}
                  inputMode="numeric"
                  onChange={(e) => setCustomAmount(e.target.value.replace(/[^\d,\.]/g, ""))}
                />
              </div>

              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <RadioGroup value={method} onValueChange={(v) => setMethod(v as any)} className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 border rounded-md p-3 cursor-pointer ${method === "pix" ? "border-primary bg-primary/5" : ""}`}>
                    <RadioGroupItem value="pix" />
                    <QrCode className="w-4 h-4" />
                    <span className="text-sm font-medium">PIX{mode === "subscription" ? " automático" : ""}</span>
                  </label>
                  <label className={`flex items-center gap-2 border rounded-md p-3 cursor-pointer ${method === "credit_card" ? "border-primary bg-primary/5" : ""}`}>
                    <RadioGroupItem value="credit_card" />
                    <CreditCard className="w-4 h-4" />
                    <span className="text-sm font-medium">Cartão</span>
                  </label>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Input placeholder="Seu nome (opcional)" value={donorName} onChange={(e) => setDonorName(e.target.value)} />
                <Input placeholder="E-mail (opcional)" value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} type="email" />
                <Input placeholder="WhatsApp com DDD (opcional)" value={donorWhats} onChange={(e) => setDonorWhats(e.target.value)} />
              </div>

              <Button
                onClick={handleSupport}
                className="w-full h-12 text-base"
                size="lg"
                disabled={loading || effectiveAmount < 5}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Abrindo checkout…</>
                ) : (
                  <><Heart className="w-5 h-5 mr-2" fill="currentColor" /> Apoiar com R$ {effectiveAmount}{mode === "subscription" ? "/mês" : ""}</>
                )}
              </Button>

              <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Pagamento processado pela Cakto Pay (PIX e Cartão).
              </p>
            </CardContent>
          </Card>

          <p className="text-xs text-center text-muted-foreground">
            🙏 Obrigado pelo seu carinho e apoio!
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Apoiar;
