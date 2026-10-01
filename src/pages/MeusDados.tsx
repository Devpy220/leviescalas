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
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";

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
  const { t, i18n } = useTranslation();
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
        <p className="text-sm text-muted-foreground">{t("myData.loginRequired")}</p>
        <Button asChild><Link to="/auth">{t("myData.login")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={`${t("myData.title")} | LEVI Escalas`}
        description={t("myData.description")}
        path="/privacidade/meus-dados"
      />

      <main className="flex-1 container mx-auto max-w-2xl px-4 py-8 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold tracking-tight">{t("myData.title")}</h1><LanguageSelector /></div>
          <p className="text-sm text-muted-foreground">
            {t("myData.description")} {" "}
            <Link className="underline" to="/privacidade">{t("myData.privacy")}</Link>
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" /> {t("myData.whatsapp")}
            </CardTitle>
            <CardDescription>{t("myData.consent")}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="optin" className="text-sm">{t("myData.accept")}</Label>
            <Switch id="optin" checked={optIn} disabled={savingConsent} onCheckedChange={toggleConsent} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" /> {t("myData.access")}
            </CardTitle>
            <CardDescription>{t("myData.accessDetail")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportData} disabled={exporting} size="sm">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("myData.export")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> {t("myData.correction")}
            </CardTitle>
            <CardDescription>{t("myData.correctionDetail")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline"><Link to="/dashboard">{t("myData.openProfile")}</Link></Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" /> {t("myData.deletion")}
            </CardTitle>
            <CardDescription>
              {t("myData.deletionDetail")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deleting}>
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("myData.delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("myData.confirmDelete")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os seus dados serão eliminados e não poderão ser recuperados. Recomendamos exportar os dados antes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("myData.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteAccount}>{t("myData.erase")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {requests.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("myData.history")}</CardTitle>
              <CardDescription>{t("myData.historyDetail")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm border-b border-border pb-2 last:border-0">
                  <span className="capitalize">{r.kind}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.requested_at).toLocaleDateString(i18n.language)} · {t("myData.deadline")} {new Date(r.deadline).toLocaleDateString(i18n.language)}
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
