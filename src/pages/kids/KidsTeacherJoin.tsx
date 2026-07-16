import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, GraduationCap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";

interface Row { page_id: string; page_name: string; room_id: string; room_name: string; age_min: number; age_max: number; }

export default function KidsTeacherJoin() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await (supabase.rpc as any)("kids_lookup_page_rooms_by_token", { _token: token });
      setRows((data || []) as Row[]);
      setLoading(false);
    })();
  }, [token]);

  async function pickRoom(room_id: string) {
    if (!token) return;
    setBusy(room_id);
    const { error } = await (supabase.rpc as any)("kids_self_register_teacher", { _page_token: token, _room_id: room_id });
    setBusy(null);
    if (error) {
      toast({ title: "Não foi possível concluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cadastro concluído!", description: "Você foi adicionado(a) como professor(a)." });
    setDone(true);
    setTimeout(() => nav("/kids/dashboard"), 1200);
  }

  if (loading || authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (!rows.length) {
    return <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div><h1 className="text-2xl font-bold mb-2">Link inválido</h1><p className="text-slate-600">Este link para professores não é válido.</p></div>
    </div>;
  }

  const page = { id: rows[0].page_id, name: rows[0].page_name };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full rounded-3xl border-2">
          <SEO title={`Ser professor(a) — ${page.name}`} description="Cadastre-se como professor(a) no LeviKids." path={`/kids/teacher-join/${token}`} />
          <CardHeader><CardTitle>Ser professor(a) no {page.name}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Entre ou crie sua conta para continuar. Menores de 18 anos precisam de autorização do responsável.</p>
            <Button className="w-full" onClick={() => nav("/auth", { state: { returnUrl: `/kids/teacher-join/${token}` } })}>Entrar / Cadastrar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-amber-50 p-4">
      <SEO title={`Ser professor(a) — ${page.name}`} description="Escolha sua sala no LeviKids." path={`/kids/teacher-join/${token}`} />
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-sm text-slate-700 text-sm font-semibold">
            <GraduationCap className="w-4 h-4 text-violet-600" /> {page.name}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">Escolha a sala que você vai servir</h1>
          <p className="text-sm text-slate-600">Você pode ser adicionado(a) a mais de uma sala repetindo o processo.</p>
        </div>

        {done && <Alert><AlertDescription>Redirecionando…</AlertDescription></Alert>}

        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.room_id} className="rounded-2xl border-2">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.room_name}</p>
                  <p className="text-xs text-slate-500">Faixa etária: {r.age_min}–{r.age_max} anos</p>
                </div>
                <Button onClick={() => pickRoom(r.room_id)} disabled={!!busy}>
                  {busy === r.room_id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Servir aqui"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-center text-slate-500">
          Menor de 18? Peça ao seu responsável para acessar <Link to="/authorize-minor" className="underline">/authorize-minor</Link> e autorizar.
        </p>
      </div>
    </div>
  );
}
