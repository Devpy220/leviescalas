import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Navigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, RefreshCw, ArrowLeft, Heart, Copy, ExternalLink, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Offer {
  id: string;
  amount_cents: number;
  mode: string;
  label: string;
  checkout_url: string;
  sort_order: number;
  active: boolean;
}

interface Donation {
  id: string;
  amount_cents: number;
  mode: string;
  status: string;
  payment_method: string | null;
  donor_name: string | null;
  donor_email: string | null;
  donor_whatsapp: string | null;
  created_at: string;
  paid_at: string | null;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Pago", variant: "default" },
  approved: { label: "Aprovado", variant: "default" },
  active: { label: "Assinatura ativa", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  waiting_payment: { label: "Aguardando", variant: "secondary" },
  refused: { label: "Recusado", variant: "destructive" },
  failed: { label: "Falhou", variant: "destructive" },
  refunded: { label: "Reembolsado", variant: "outline" },
  chargeback: { label: "Chargeback", variant: "destructive" },
  canceled: { label: "Cancelado", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "outline" },
};
const PAID = ["paid", "approved", "active"];

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminDonations() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    const [o, d] = await Promise.all([
      supabase.from("cakto_offers").select("*").order("sort_order"),
      supabase.from("donations").select("id,amount_cents,mode,status,payment_method,donor_name,donor_email,donor_whatsapp,created_at,paid_at").order("created_at", { ascending: false }).limit(500),
    ]);
    if (o.error || d.error) toast.error("Erro ao carregar dados de doações.");
    setOffers((o.data || []) as Offer[]);
    setDonations((d.data || []) as Donation[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const toggleOffer = async (offer: Offer) => {
    const { error } = await supabase.from("cakto_offers").update({ active: !offer.active }).eq("id", offer.id);
    if (error) return toast.error("Não foi possível alterar a opção.");
    setOffers((prev) => prev.map((x) => (x.id === offer.id ? { ...x, active: !x.active } : x)));
    toast.success(offer.active ? "Opção ocultada da página Apoiar" : "Opção visível na página Apoiar");
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copiado");
  };

  const filtered = useMemo(() => {
    const f = search.toLowerCase();
    return donations.filter((d) => {
      if (statusFilter === "paid" && !PAID.includes(d.status)) return false;
      if (statusFilter === "pending" && !["pending", "waiting_payment"].includes(d.status)) return false;
      if (statusFilter === "problem" && (PAID.includes(d.status) || ["pending", "waiting_payment"].includes(d.status))) return false;
      if (!f) return true;
      return [d.donor_name, d.donor_email, d.donor_whatsapp].some((v) => (v ?? "").toLowerCase().includes(f));
    });
  }, [donations, search, statusFilter]);

  const stats = useMemo(() => {
    const paid = donations.filter((d) => PAID.includes(d.status));
    return {
      total: paid.reduce((s, d) => s + d.amount_cents, 0),
      count: paid.length,
      subs: paid.filter((d) => d.mode === "subscription").length,
      pending: donations.filter((d) => ["pending", "waiting_payment"].includes(d.status)).length,
    };
  }, [donations]);

  if (authLoading || adminLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const publicUrl = "https://leviescalas.com.br/apoiar";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link to="/admin"><ArrowLeft className="w-5 h-5" /></Link></Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><Heart className="w-6 h-6 text-primary" fill="currentColor" /> Doações</h1>
              <p className="text-sm text-muted-foreground">Opções de valor, links de checkout e pagamentos recebidos</p>
            </div>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["Total recebido", brl(stats.total)],
            ["Pagamentos confirmados", String(stats.count)],
            ["Assinaturas", String(stats.subs)],
            ["Pendentes", String(stats.pending)],
          ].map(([l, v]) => (
            <Card key={l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p></CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Opções de valor e checkout</CardTitle>
            <CardDescription className="flex items-center gap-2 flex-wrap">
              Página pública: <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{publicUrl}</a>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => copy(publicUrl)}><Copy className="w-3.5 h-3.5" /></Button>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {offers.length === 0 && !loading && <p className="text-sm text-muted-foreground">Nenhuma opção cadastrada.</p>}
            {offers.map((o) => (
              <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl border">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{brl(o.amount_cents)} <span className="text-xs font-normal text-muted-foreground">· {o.mode === "subscription" ? "Mensal" : "Avulsa"}</span></p>
                  <p className="text-xs text-muted-foreground truncate">{o.checkout_url}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => copy(o.checkout_url)} aria-label="Copiar link"><Copy className="w-4 h-4" /></Button>
                <Button asChild size="icon" variant="ghost" aria-label="Abrir checkout"><a href={o.checkout_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a></Button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground hidden sm:inline">{o.active ? "Visível" : "Oculta"}</span>
                  <Switch checked={o.active} onCheckedChange={() => toggleOffer(o)} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de pagamentos</CardTitle>
            <div className="flex gap-2 flex-wrap pt-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar por nome, e-mail ou WhatsApp" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {[["all", "Todos"], ["paid", "Pagos"], ["pending", "Pendentes"], ["problem", "Falhas/Reembolsos"]].map(([v, l]) => (
                <Button key={v} size="sm" variant={statusFilter === v ? "default" : "outline"} onClick={() => setStatusFilter(v)}>{l}</Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-8">Nenhum pagamento encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground border-b">
                    <tr><th className="py-2 pr-3">Data</th><th className="pr-3">Doador</th><th className="pr-3">Valor</th><th className="pr-3">Tipo</th><th className="pr-3">Método</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => {
                      const s = statusMap[d.status] ?? { label: d.status, variant: "outline" as const };
                      return (
                        <tr key={d.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 whitespace-nowrap">{format(new Date(d.paid_at ?? d.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
                          <td className="pr-3"><p>{d.donor_name || "Anônimo"}</p><p className="text-xs text-muted-foreground">{d.donor_email || d.donor_whatsapp || ""}</p></td>
                          <td className="pr-3 font-semibold whitespace-nowrap">{brl(d.amount_cents)}</td>
                          <td className="pr-3">{d.mode === "subscription" ? "Mensal" : "Avulsa"}</td>
                          <td className="pr-3 uppercase text-xs">{d.payment_method || "—"}</td>
                          <td><Badge variant={s.variant}>{s.label}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
