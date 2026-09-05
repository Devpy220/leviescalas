import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

export default function ConsentimentoResponsavel() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "invalid">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setState("invalid"); return; }
      const { data, error } = await supabase.rpc("confirm_guardian_consent", { _token: token });
      if (cancelled) return;
      setState(!error && data === true ? "ok" : "invalid");
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Consentimento do responsável | LEVI"
        description="Confirmação do consentimento do titular das responsabilidades parentais para tratamento de dados de menores no LEVI."
        path="/consentimento-responsavel"
      />
      <main className="flex-1 container mx-auto max-w-lg px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {state === "loading" && <Loader2 className="w-5 h-5 animate-spin" />}
              {state === "ok" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {state === "invalid" && <ShieldAlert className="w-5 h-5 text-destructive" />}
              Consentimento do responsável
            </CardTitle>
            <CardDescription>
              Ao confirmar, autoriza o tratamento dos dados pessoais do menor pelo LEVI, nos termos da política de
              privacidade.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {state === "loading" && <p className="text-muted-foreground">A validar a ligação...</p>}
            {state === "ok" && <p>Consentimento confirmado. A conta do menor já pode ser utilizada.</p>}
            {state === "invalid" && (
              <p className="text-muted-foreground">
                Ligação inválida ou já utilizada. Peça ao líder da igreja para enviar uma nova ligação de confirmação.
              </p>
            )}
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline"><Link to="/privacidade">Política de privacidade</Link></Button>
              <Button asChild size="sm"><Link to="/">Ir para o início</Link></Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
