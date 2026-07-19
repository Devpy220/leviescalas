import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";

type Status = "ok" | "warn" | "fail" | "pending";
interface CheckResult {
  name: string;
  status: Status;
  detail?: string;
  ms?: number;
  group: "Build" | "Rotas" | "RPCs" | "Filas";
}

const ROUTES = [
  "/", "/auth", "/dashboard", "/admin", "/kids", "/kids/hub",
  "/kids/admin", "/kids/dashboard", "/kids/checkin", "/kids/parent",
];

const RPCS: Array<{ name: string; args?: Record<string, unknown> }> = [
  { name: "get_user_count" },
  { name: "kids_default_consent_text" },
  { name: "kids_children_require_photo" },
];

const EDGE_FUNCTIONS = [
  "process-whatsapp-queue",
  "send-scheduled-reminders",
  "send-delayed-announcements",
];

export default function HealthCheck() {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  const runAll = async () => {
    setRunning(true);
    setResults([]);
    const out: CheckResult[] = [];
    const push = (r: CheckResult) => {
      out.push(r);
      setResults([...out]);
    };

    // Build
    const t0 = performance.now();
    try {
      const res = await fetch("/index.html", { cache: "no-store" });
      const ok = res.ok;
      push({
        group: "Build",
        name: "Bundle servido (index.html)",
        status: ok ? "ok" : "fail",
        detail: `HTTP ${res.status}`,
        ms: Math.round(performance.now() - t0),
      });
    } catch (e: unknown) {
      push({ group: "Build", name: "Bundle servido", status: "fail", detail: String(e) });
    }

    const swStart = performance.now();
    try {
      const res = await fetch("/sw.js", { cache: "no-store" });
      push({
        group: "Build",
        name: "Service Worker",
        status: res.ok ? "ok" : "warn",
        detail: `HTTP ${res.status}`,
        ms: Math.round(performance.now() - swStart),
      });
    } catch {
      push({ group: "Build", name: "Service Worker", status: "warn", detail: "indisponível" });
    }

    // Rotas — check that the SPA resolves each (HEAD on origin)
    for (const path of ROUTES) {
      const start = performance.now();
      try {
        const res = await fetch(path, { method: "GET", cache: "no-store" });
        push({
          group: "Rotas",
          name: path,
          status: res.ok ? "ok" : "warn",
          detail: `HTTP ${res.status}`,
          ms: Math.round(performance.now() - start),
        });
      } catch (e: unknown) {
        push({ group: "Rotas", name: path, status: "fail", detail: String(e) });
      }
    }

    // RPCs
    for (const rpc of RPCS) {
      const start = performance.now();
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).rpc(rpc.name, rpc.args ?? {});
        push({
          group: "RPCs",
          name: rpc.name,
          status: error ? "fail" : "ok",
          detail: error?.message,
          ms: Math.round(performance.now() - start),
        });
      } catch (e: unknown) {
        push({ group: "RPCs", name: rpc.name, status: "fail", detail: String(e) });
      }
    }

    // Filas / Edge Functions — invoke com ping seguro (deve responder algo, mesmo que 4xx)
    for (const fn of EDGE_FUNCTIONS) {
      const start = performance.now();
      try {
        const { error } = await supabase.functions.invoke(fn, { body: { ping: true } });
        // Consideramos OK se respondeu (mesmo com erro de validação de payload)
        const isAuthOrBoot = error && /boot|network|fetch/i.test(error.message ?? "");
        push({
          group: "Filas",
          name: fn,
          status: !error ? "ok" : isAuthOrBoot ? "fail" : "warn",
          detail: error ? error.message : "respondeu",
          ms: Math.round(performance.now() - start),
        });
      } catch (e: unknown) {
        push({ group: "Filas", name: fn, status: "fail", detail: String(e) });
      }
    }

    // WhatsApp queue backlog
    try {
      const { count, error } = await supabase
        .from("whatsapp_queue" as never)
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      const c = count ?? 0;
      push({
        group: "Filas",
        name: "whatsapp_queue pendentes",
        status: c > 500 ? "fail" : c > 100 ? "warn" : "ok",
        detail: `${c} mensagens`,
      });
    } catch (e: unknown) {
      push({ group: "Filas", name: "whatsapp_queue pendentes", status: "warn", detail: String(e) });
    }

    setRunning(false);
  };

  const groups: Array<CheckResult["group"]> = ["Build", "Rotas", "RPCs", "Filas"];
  const summary = (g: CheckResult["group"]): Status => {
    const items = results.filter((r) => r.group === g);
    if (!items.length) return "pending";
    if (items.some((i) => i.status === "fail")) return "fail";
    if (items.some((i) => i.status === "warn")) return "warn";
    return "ok";
  };

  if (adminLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Acesso restrito.</div>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin"><ArrowLeft className="w-4 h-4 mr-1" /> Admin</Link>
          </Button>
          <Button onClick={runAll} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {running ? "Executando..." : "Executar verificações"}
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold">Health Check</h1>
          <p className="text-sm text-muted-foreground">Build, rotas, RPCs e filas.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {groups.map((g) => {
            const s = summary(g);
            return (
              <Card key={g} className="rounded-2xl">
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="font-semibold">{g}</span>
                  <StatusBadge status={s} />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {groups.map((g) => {
          const items = results.filter((r) => r.group === g);
          if (!items.length) return null;
          return (
            <Card key={g} className="rounded-2xl">
              <CardHeader className="pb-2"><CardTitle className="text-base">{g}</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {items.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusIcon status={r.status} />
                      <span className="font-mono text-sm truncate">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      {r.detail && <span className="truncate max-w-[220px]">{r.detail}</span>}
                      {typeof r.ms === "number" && <span>{r.ms}ms</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        {!results.length && !running && (
          <p className="text-sm text-muted-foreground text-center py-8">Clique em "Executar verificações" para começar.</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "ok") return <Badge className="bg-emerald-600 hover:bg-emerald-600">OK</Badge>;
  if (status === "warn") return <Badge className="bg-amber-500 hover:bg-amber-500">Alerta</Badge>;
  if (status === "fail") return <Badge variant="destructive">Falha</Badge>;
  return <Badge variant="secondary">—</Badge>;
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
  if (status === "warn") return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
  if (status === "fail") return <XCircle className="w-4 h-4 text-destructive shrink-0" />;
  return <Loader2 className="w-4 h-4 animate-spin shrink-0" />;
}
