import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, CheckCircle2, ExternalLink, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LeviLogo } from "@/components/LeviLogo";
import { SEO } from "@/components/SEO";
import Footer from "@/components/Footer";

interface Offer {
  id: string;
  amount_cents: number;
  mode: "one_time" | "subscription";
  label: string;
  checkout_url: string;
  sort_order: number;
}

const Apoiar = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"one_time" | "subscription">("one_time");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  const status = searchParams.get("status");

  useEffect(() => {
    if (status === "success") toast.success("Pagamento recebido! Obrigado pelo apoio 💜");
    if (status === "cancel") toast.info("Pagamento cancelado. Volte quando quiser apoiar.");
  }, [status]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("cakto_offers")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) {
        toast.error("Não foi possível carregar as opções de apoio.");
      } else {
        setOffers((data || []) as Offer[]);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = offers.filter((o) => o.mode === mode);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO title="Apoiar o LEVI — PIX e Cartão via Cakto" description="Apoie o LEVI com doação única ou assinatura mensal. PIX ou cartão de crédito." path="/apoiar" />
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
              <span className="text-xs font-medium text-primary">Sugestão: R$ 25,00</span>
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
                  Escolha um valor — você será levado ao checkout seguro da Cakto (PIX ou Cartão).
                </TabsContent>
                <TabsContent value="subscription" className="mt-4 text-center text-xs text-muted-foreground">
                  Cobrança mensal automática. Cancele quando quiser direto na Cakto.
                </TabsContent>
              </Tabs>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-6">
                  Nenhuma opção disponível no momento.
                </p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((o) => (
                    <a
                      key={o.id}
                      href={o.checkout_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        className="w-full h-14 text-base justify-between"
                        size="lg"
                        variant={o.amount_cents === 2500 && o.mode === "one_time" ? "default" : "outline"}
                      >
                        <span className="flex items-center gap-2">
                          <Heart className="w-5 h-5" fill="currentColor" />
                          Apoiar com {o.label}
                          {o.mode === "subscription" && (
                            <span className="text-xs text-muted-foreground">(recorrente)</span>
                          )}
                        </span>
                        <ExternalLink className="w-4 h-4 opacity-60" />
                      </Button>
                    </a>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Pagamento processado pela Cakto Pay (PIX e Cartão).
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">
                <ArrowLeft className="w-4 h-4" />
                Voltar para o dashboard
              </Link>
            </Button>
          </div>

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
