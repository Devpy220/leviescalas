import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Download, ShieldCheck, Trash2, Loader2, MessageSquare } from "lucide-react";

const OPT_IN_TEXT =
  "Autorizo o LEVI a enviar-me mensagens por WhatsApp sobre escalas, avisos e comunicados da minha igreja. Posso cancelar a qualquer momento respondendo SAIR.";

interface RequestRow {
  id: string;
  kind: string;
  status: string;
  requested_at: string;
  deadline: string;
  resolved_at: string | null;
}

export default function MeusDados() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [optIn, setOptIn] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: profile }, { data: reqs }] = await Promise.all([
        supabase.from("profiles").select("whatsapp_opt_in_at, whatsapp_opt_out_at").eq("id", user.id).maybeSingle(),
        supabase.from("data_subject_requests").select("id, kind, status, requested_at, deadline, resolved_at")
          .order("requested_at", { ascending: false }),
      ]);
      if (cancelled) return;
      const p = profile as { whatsapp_opt_in_at: string | null; whatsapp_opt_out_at: string | null } | null;
      setOptIn(!!p?.whatsapp_opt_in_at && !p?.whatsapp_opt_out_at);
      setRequests((reqs as RequestRow[]) || []);
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function toggleConsent(next: boolean) {
    setSavingConsent(true);
    const { error } = await supabase.rpc("record_whatsapp_consent", {
      _action: next ? "opt_in" : "opt_out",
      _consent_text: next ? OPT_IN_TEXT : "Cancelamento pedido na área 'Os meus dados'.",
      _source: "web",
    });
    setSavingConsent(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setOptIn(next);
    toast({ title: next ? "Consentimento registado" : "Cancelamento registado" });
  }

  async function exportData() {
    setExporting(true);
    const { data, error } = await supabase.rpc("export_my_data");
    await supabase.rpc("create_data_subject_request", { _kind: "portabilidade", _details: "Exportação efetuada pelo próprio titular." });
    setExporting(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `levi-dados-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportação concluída", description: "O ficheiro foi transferido para o seu dispositivo." });
  }

  async function deleteAccount() {
    setDeleting(true);
    await supabase.rpc("create_data_subject_request", { _kind: "apagamento", _details: "Apagamento pedido pelo próprio titular." });
    const { error } = await supabase.rpc("delete_my_account");
    setDeleting(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await supabase.auth.signOut();
    toast({ title: "Conta apagada", description: "Os seus dados foram eliminados." });
    navigate("/");
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">Inicie sessão para gerir os seus dados.</p>
        <Button asChild><Link to="/auth">Entrar</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Os meus dados e direitos | LEVI Escalas"
        description="Exporte, corrija ou apague os seus dados pessoais e faça a gestão do consentimento de mensagens no LEVI Escalas."
        path="/privacidade/meus-dados"
      />

      <main className="flex-1 container mx-auto max-w-2xl px-4 py-8 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Os meus dados e direitos</h1>
          <p className="text-sm text-muted-foreground">
            Exerça os direitos previstos no RGPD. Os pedidos são tratados no prazo máximo de 30 dias.{" "}
            <Link className="underline" to="/privacidade">Ver política de privacidade</Link>
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" /> Mensagens por WhatsApp
            </CardTitle>
            <CardDescription>{OPT_IN_TEXT}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="optin" className="text-sm">Aceito receber mensagens</Label>
            <Switch id="optin" checked={optIn} disabled={savingConsent} onCheckedChange={toggleConsent} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" /> Acesso e portabilidade
            </CardTitle>
            <CardDescription>Transfira uma cópia legível de todos os dados associados à sua conta.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportData} disabled={exporting} size="sm">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Exportar os meus dados (JSON)"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Retificação
            </CardTitle>
            <CardDescription>Pode corrigir nome, e-mail e telefone no seu perfil a qualquer momento.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline"><Link to="/dashboard">Abrir o meu perfil</Link></Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" /> Apagamento da conta
            </CardTitle>
            <CardDescription>
              Elimina definitivamente o seu perfil, escalas, disponibilidades, preferências e histórico de mensagens.
              Esta ação é irreversível.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deleting}>
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apagar a minha conta"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar definitivamente a conta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os seus dados serão eliminados e não poderão ser recuperados. Recomendamos exportar os dados antes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteAccount}>Apagar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {requests.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de pedidos</CardTitle>
              <CardDescription>Registo com prazo legal de resposta (30 dias).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm border-b border-border pb-2 last:border-0">
                  <span className="capitalize">{r.kind}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.requested_at).toLocaleDateString("pt-PT")} · prazo {new Date(r.deadline).toLocaleDateString("pt-PT")}
                  </span>
                  <Badge variant={r.status === "concluido" ? "secondary" : "outline"}>{r.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}
