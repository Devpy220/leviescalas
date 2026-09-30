import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Baby, Building2, ChevronDown, Church, Loader2, RefreshCw, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

interface Member { id: string; user_id: string; role: string; name: string | null; whatsapp: string | null }
interface Dept { id: string; name: string; members: Member[] }
interface Kids { id: string; name: string; slug: string; rooms: number; children: number; leaders: number }
interface ChurchRow {
  id: string; name: string; city: string | null; state: string | null; country: string | null; code: string;
  departments: Dept[]; kids: Kids | null;
}

type Pending =
  | { kind: "church"; id: string; label: string }
  | { kind: "dept"; id: string; label: string }
  | { kind: "member"; id: string; label: string }
  | { kind: "kids"; id: string; label: string }
  | { kind: "all-members"; ids: string[]; label: string };

const roleLabel: Record<string, string> = { leader: "Líder", coleader: "Co-líder", member: "Membro" };

export default function AdminChurches() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [rows, setRows] = useState<ChurchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_church_overview" as never);
    if (error) toast.error(error.message);
    else setRows((data as unknown as ChurchRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((c) =>
      c.name.toLowerCase().includes(t) ||
      c.departments.some((d) => d.name.toLowerCase().includes(t) || d.members.some((m) => (m.name ?? "").toLowerCase().includes(t))));
  }, [rows, q]);

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const call = (fn: string, args: Record<string, string>) => supabase.rpc(fn as never, args as never);
      let res;
      if (pending.kind === "church") res = await call("admin_delete_church", { church_id: pending.id });
      else if (pending.kind === "dept") res = await call("admin_delete_department", { dept_id: pending.id });
      else if (pending.kind === "member") res = await call("admin_delete_member", { member_id: pending.id });
      else if (pending.kind === "kids") res = await call("admin_delete_kids_page", { page_id: pending.id });
      else {
        for (const id of pending.ids) {
          const r = await call("admin_delete_member", { member_id: id });
          if (r.error) { res = r; break; }
        }
      }
      if (res?.error) throw res.error;
      toast.success("Excluído com sucesso");
      setPending(null);
      await load();
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Erro ao excluir");
    } finally { setBusy(false); }
  };

  if (authLoading || adminLoading) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!user || !isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label="Voltar"><ArrowLeft className="w-4 h-4" /></Link></Button>
          <h1 className="text-xl font-bold flex items-center gap-2"><Church className="w-5 h-5 text-primary" />Painel de igrejas</h1>
          <Button variant="outline" size="icon" className="ml-auto" onClick={load} aria-label="Atualizar"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar igreja, departamento ou pessoa" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {loading ? <div className="grid place-items-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{filtered.length} igreja(s)</p>
            {filtered.map((c) => {
              const total = c.departments.reduce((s, d) => s + d.members.length, 0);
              return (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base truncate">{c.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {[c.city, c.state, c.country].filter(Boolean).join(" · ")} · código {c.code}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="secondary"><Building2 className="w-3 h-3 mr-1" />{c.departments.length} dept.</Badge>
                          <Badge variant="secondary"><Users className="w-3 h-3 mr-1" />{total} membros</Badge>
                          <Badge variant={c.kids ? "default" : "outline"}><Baby className="w-3 h-3 mr-1" />{c.kids ? "LeviKids ativo" : "Sem LeviKids"}</Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => setPending({ kind: "church", id: c.id, label: `a igreja "${c.name}" e TUDO dela (departamentos, membros, escalas e LeviKids)` })}>
                        <Trash2 className="w-4 h-4 mr-1" />Excluir tudo
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {c.kids && (
                      <div className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                        <Baby className="w-4 h-4 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{c.kids.name}</p>
                          <p className="text-xs text-muted-foreground">{c.kids.rooms} salas · {c.kids.children} crianças · {c.kids.leaders} líderes</p>
                        </div>
                        <Button size="icon" variant="ghost" aria-label="Excluir LeviKids" onClick={() => setPending({ kind: "kids", id: c.kids!.id, label: `o LeviKids "${c.kids!.name}" (salas, crianças e check-ins)` })}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                    {c.departments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum departamento.</p>}
                    {c.departments.map((d) => (
                      <Collapsible key={d.id} className="rounded-lg border">
                        <div className="flex items-center gap-1 p-2">
                          <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0 text-left text-sm">
                            <ChevronDown className="w-4 h-4 shrink-0" />
                            <span className="font-medium truncate">{d.name}</span>
                            <span className="text-xs text-muted-foreground">({d.members.length})</span>
                          </CollapsibleTrigger>
                          <Button size="icon" variant="ghost" aria-label="Excluir departamento" onClick={() => setPending({ kind: "dept", id: d.id, label: `o departamento "${d.name}" com membros e escalas` })}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                        <CollapsibleContent className="border-t p-2 space-y-1">
                          {d.members.length > 0 && (
                            <Button size="sm" variant="outline" className="w-full text-destructive" onClick={() => setPending({ kind: "all-members", ids: d.members.map((m) => m.id), label: `todos os ${d.members.length} membros de "${d.name}"` })}>
                              Remover todos os membros
                            </Button>
                          )}
                          {d.members.map((m) => (
                            <div key={m.id} className="flex items-center gap-2 text-sm">
                              <span className="flex-1 min-w-0 truncate">{m.name ?? "Sem nome"}</span>
                              <Badge variant="outline" className="text-[10px]">{roleLabel[m.role] ?? m.role}</Badge>
                              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remover membro" onClick={() => setPending({ kind: "member", id: m.id, label: `${m.name ?? "este membro"} do departamento "${d.name}"` })}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Você vai excluir {pending?.label}. Isso não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); run(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
