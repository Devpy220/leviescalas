import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Copy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { LeviLogo } from "@/components/LeviLogo";
import { SEO } from "@/components/SEO";
import Footer from "@/components/Footer";

const PIX_KEY = "7ab64b21-1d99-4c7c-bff6-6696cdeeddec";

const Apoiar = () => {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      toast.success("Chave PIX copiada!");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO title="Apoiar o LEVI — PIX" description="Apoie o LEVI com uma doação via PIX." path="/apoiar" />
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
            <CardContent className="p-6 space-y-4 text-center">
              <p className="text-sm font-semibold">Chave PIX (aleatória)</p>
              <p className="font-mono text-sm break-all rounded-lg bg-muted px-3 py-3">{PIX_KEY}</p>
              <Button className="w-full h-12" onClick={copy}>
                <Copy className="w-4 h-4" /> Copiar chave PIX
              </Button>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Banco: Celcoin</p>
                <p>Titular: ELSD</p>
              </div>
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
