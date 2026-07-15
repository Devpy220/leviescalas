import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyKidsPage } from "@/hooks/useKidsPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, UserX, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function KidsReports() {
  const { page, role, loading } = useMyKidsPage();
  const [visitors, setVisitors] = useState<any[]>([]);
  const [needs, setNeeds] = useState<any[]>([]);
  const [dropoff, setDropoff] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!page) return;
    (async () => {
      setBusy(true);
      const [v, n, d] = await Promise.all([
        (supabase.rpc as any)("kids_report_visitors", { _page_id: page.id }),
        (supabase.rpc as any)("kids_report_needs", { _page_id: page.id }),
        (supabase.rpc as any)("kids_report_dropoff", { _page_id: page.id }),
      ]);
      setVisitors(v.data || []); setNeeds(n.data || []); setDropoff(d.data || []);
      setBusy(false);
    })();
  }, [page]);

  function csv(rows: any[], filename: string) {
    if (!rows.length) return;
    const cols = Object.keys(rows[0]);
    const body = [cols.join(",")].concat(rows.map(r => cols.map(c => JSON.stringify(r[c] ?? "")).join(","))).join("\n");
    const blob = new Blob([body], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin"/></div>;
  if (role !== "leader") return <div className="min-h-screen flex items-center justify-center text-slate-600 p-6 text-center">Somente líderes têm acesso aos relatórios.</div>;
  if (!page) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-amber-50 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Relatórios · {page.name}</h1>
          <Button asChild variant="outline" className="rounded-xl"><Link to="/kids/admin">← Painel</Link></Button>
        </div>

        <Tabs defaultValue="dropoff">
          <TabsList className="grid grid-cols-3 rounded-2xl">
            <TabsTrigger value="dropoff" className="rounded-xl"><UserX className="w-4 h-4 mr-1"/>Desistências</TabsTrigger>
            <TabsTrigger value="visitors" className="rounded-xl"><Users className="w-4 h-4 mr-1"/>Visitantes</TabsTrigger>
            <TabsTrigger value="needs" className="rounded-xl"><AlertTriangle className="w-4 h-4 mr-1"/>Necessidades</TabsTrigger>
          </TabsList>

          <TabsContent value="dropoff">
            <Card className="rounded-3xl border-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Famílias que pararam de frequentar</CardTitle>
                <Button size="sm" variant="outline" onClick={()=>csv(dropoff, "kids-desistencias.csv")}>Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-3">Crianças com pelo menos 3 check-ins entre 30 e 90 dias atrás, mas 0 check-ins nos últimos 30 dias.</p>
                {busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : dropoff.length === 0 ? <p className="text-sm text-center text-slate-500 py-6">🎉 Nenhuma família desistindo.</p> : (
                  <div className="space-y-2">
                    {dropoff.map((r:any) => (
                      <div key={r.child_id} className="p-3 rounded-xl border bg-white flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{r.full_name}</p>
                          <p className="text-xs text-slate-500 truncate">Resp.: {r.guardian_name || "—"} · {r.checkins_prev} presenças anteriores</p>
                          <p className="text-[11px] text-slate-400">Última visita: {r.last_visit ? new Date(r.last_visit).toLocaleDateString("pt-BR") : "—"}</p>
                        </div>
                        {r.guardian_phone && (
                          <a href={`https://wa.me/55${r.guardian_phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="text-xs px-3 py-2 rounded-xl bg-emerald-600 text-white font-semibold">WhatsApp</a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="visitors">
            <Card className="rounded-3xl border-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Prováveis visitantes</CardTitle>
                <Button size="sm" variant="outline" onClick={()=>csv(visitors, "kids-visitantes.csv")}>Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-3">Crianças com 1 ou 2 check-ins nos últimos 90 dias.</p>
                {busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : visitors.length === 0 ? <p className="text-sm text-center text-slate-500 py-6">Sem visitantes recentes.</p> : (
                  <div className="space-y-2">
                    {visitors.map((r:any) => (
                      <div key={r.child_id} className="p-3 rounded-xl border bg-white flex justify-between items-center">
                        <p className="font-semibold text-sm">{r.full_name}</p>
                        <Badge variant="outline">{r.checkins} visita(s)</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="needs">
            <Card className="rounded-3xl border-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Alergias e restrições</CardTitle>
                <Button size="sm" variant="outline" onClick={()=>csv(needs, "kids-necessidades.csv")}>Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                {busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : needs.length === 0 ? <p className="text-sm text-center text-slate-500 py-6">Nenhuma alergia ou restrição cadastrada.</p> : (
                  <div className="space-y-2">
                    {needs.map((r:any) => (
                      <div key={r.child_id} className="p-3 rounded-xl border bg-white">
                        <p className="font-semibold text-sm">{r.full_name} <span className="text-xs text-slate-500 font-normal">· {r.current_room || "sem sala"}</span></p>
                        {r.allergies && <p className="text-xs text-red-700 mt-1">🚨 Alergia: {r.allergies}</p>}
                        {r.restrictions && <p className="text-xs text-amber-700 mt-1">⚠ Restrição: {r.restrictions}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
