import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Typed wrapper for the beta supabase.auth.oauth namespace
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauthApi = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Requisição de autorização inválida (authorization_id ausente).");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/auth?redirect=${encodeURIComponent(next)}`;
        return;
      }
      try {
        const { data, error } = await oauthApi.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) {
          setError(error.message);
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        setError(e?.message ?? "Falha ao carregar autorização.");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error } = approve
        ? await oauthApi.approveAuthorization(authorizationId)
        : await oauthApi.denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("Servidor de autorização não retornou um redirect.");
        return;
      }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Falha ao concluir autorização.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full p-6 space-y-4">
        {error && (
          <div className="text-sm text-destructive">
            Não foi possível carregar esta autorização: {error}
          </div>
        )}
        {!error && !details && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {!error && details && (
          <>
            <h1 className="text-xl font-semibold">
              Conectar {details.client?.name ?? "aplicativo"} à sua conta LEVI
            </h1>
            <p className="text-sm text-muted-foreground">
              Isso permite que {details.client?.name ?? "o cliente"} acesse o LEVI em seu nome
              (departamentos, escalas e avisos).
            </p>
            <div className="flex gap-2 pt-2">
              <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
                Aprovar
              </Button>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => decide(false)}
                className="flex-1"
              >
                Recusar
              </Button>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
