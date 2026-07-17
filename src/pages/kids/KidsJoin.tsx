import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Baby, Plus, Trash2, ShieldCheck } from "lucide-react";
import { uploadKidsPhoto } from "@/lib/kidsStorage";

interface Room { id: string; name: string; color: string; age_min: number; age_max: number; page_id: string; }
interface Page { id: string; name: string; consent_version: string; consent_text: string; }

// CPF: 11 dígitos com dígitos verificadores válidos
function isValidCPF(raw: string): boolean {
  const cpf = (raw || "").replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * (factor - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(cpf.slice(0, 9), 10) === parseInt(cpf[9], 10)
      && calc(cpf.slice(0, 10), 11) === parseInt(cpf[10], 10);
}
function maskCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export default function KidsJoin() {
  const { token } = useParams();
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"page" | "room" | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"consent" | "guardian" | "children">("consent");
  const [accepted, setAccepted] = useState(false);
  const [guardian, setGuardian] = useState({ full_name: "", phone: "", birth_date: "", cpf: "", photoFile: null as File | null });
  const [guardianId, setGuardianId] = useState<string | null>(null);
  const [children, setChildren] = useState<Array<{ id?: string; full_name: string; birth_date: string; allergies: string; restrictions: string; notes: string; photoFile: File | null }>>([
    { full_name: "", birth_date: "", allergies: "", restrictions: "", notes: "", photoFile: null }
  ]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      // 1) tenta como token de sala (compat) — vai deixar de existir aos poucos
      const { data: roomData } = await (supabase.rpc as any)("kids_lookup_room_by_static_token", { _token: token });
      const roomRow = Array.isArray(roomData) ? roomData[0] : null;
      if (roomRow) {
        setMode("room");
        setRoom({ id: roomRow.room_id, name: roomRow.room_name, color: roomRow.room_color, page_id: roomRow.page_id } as any);
        setPage({ id: roomRow.page_id, name: roomRow.page_name, consent_version: roomRow.consent_version, consent_text: roomRow.consent_text } as any);
        setLoading(false); return;
      }
      // 2) fallback: token de página (QR único da igreja)
      const { data: pageData } = await (supabase.rpc as any)("kids_lookup_page_by_token", { _token: token });
      const pageRow = Array.isArray(pageData) ? pageData[0] : null;
      if (pageRow) {
        setMode("page");
        setPage({ id: pageRow.page_id, name: pageRow.page_name, consent_version: pageRow.consent_version, consent_text: pageRow.consent_text } as any);
      }
      setLoading(false);
    })();
  }, [token]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: g } = await supabase.from("kids_guardians").select("*").eq("user_id", user.id).maybeSingle();
      if (g) {
        setGuardianId(g.id);
        setGuardian({ full_name: g.full_name, phone: g.phone, birth_date: g.birth_date, cpf: (g as any).cpf || "", photoFile: null });
        if (page) {
          const { data: c } = await supabase.from("kids_consents").select("id")
            .eq("user_id", user.id).eq("page_id", page.id).eq("version", page.consent_version).maybeSingle();
          if (c) { setStep("children"); return; }
        }
        setStep("consent");
      }
    })();
  }, [user, page]);

  if (loading || authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (!page) {
    return <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div><h1 className="text-2xl font-bold mb-2">QR inválido</h1><p className="text-slate-600">Este link de cadastro não é válido.</p></div>
    </div>;
  }

  if (!user) {
    return <InlineAuth pageName={page.name} roomLabel={mode === "room" && room ? room.name : null} />;
  }

  async function acceptConsent() {
    if (!accepted || !user || !page) return;
    setBusy(true);
    const { error } = await supabase.from("kids_consents").insert({
      user_id: user.id, page_id: page.id, version: page.consent_version,
      user_agent: navigator.userAgent,
    });
    setBusy(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setStep(guardianId ? "children" : "guardian");
  }

  async function saveGuardian() {
    if (!user || !guardian.full_name || !guardian.phone || !guardian.birth_date || !guardian.cpf) {
      toast({ title: "Preencha todos os campos (incluindo CPF)" }); return;
    }
    if (!isValidCPF(guardian.cpf)) {
      toast({ title: "CPF inválido", variant: "destructive" }); return;
    }
    const bd = new Date(guardian.birth_date);
    const age = (Date.now() - bd.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 18) { toast({ title: "É necessário ter 18 anos ou mais.", variant: "destructive" }); return; }
    setBusy(true);
    const cpfDigits = guardian.cpf.replace(/\D/g, "");
    const { data: g, error } = await supabase.from("kids_guardians").upsert({
      user_id: user.id, full_name: guardian.full_name, phone: guardian.phone,
      birth_date: guardian.birth_date, cpf: cpfDigits,
    } as any, { onConflict: "user_id" }).select("id").single();
    if (error || !g) { setBusy(false); toast({ title: "Erro", description: error?.message, variant: "destructive" }); return; }
    if (guardian.photoFile) {
      try {
        const path = await uploadKidsPhoto(guardian.photoFile, page!.id, "guardian", g.id);
        await supabase.from("kids_guardians").update({ photo_path: path }).eq("id", g.id);
      } catch { /* non-fatal */ }
    }
    setGuardianId(g.id);
    setBusy(false);
    setStep("children");
  }

  async function saveChildren() {
    if (!guardianId || !page) return;
    const missing = children.filter(c => c.full_name && c.birth_date && !c.photoFile);
    if (missing.length > 0) {
      toast({ title: "Foto obrigatória", description: `Adicione uma foto de: ${missing.map(m=>m.full_name).join(", ")}`, variant: "destructive" });
      return;
    }
    setBusy(true);
    for (const c of children) {
      if (!c.full_name || !c.birth_date || !c.photoFile) continue;
      const tempPath = `pending/${crypto.randomUUID()}`;
      const { data: child, error } = await supabase.from("kids_children").insert({
        page_id: page.id,
        full_name: c.full_name, birth_date: c.birth_date,
        allergies: c.allergies || null, restrictions: c.restrictions || null, notes: c.notes || null,
        photo_path: tempPath, created_by: user!.id,
      } as any).select("id").single();
      if (error || !child) { console.warn(error); continue; }
      await supabase.from("kids_guardian_children").insert({ guardian_id: guardianId, child_id: child.id });
      try {
        const p = await uploadKidsPhoto(c.photoFile, page.id, "child", child.id);
        await supabase.from("kids_children").update({ photo_path: p }).eq("id", child.id);
      } catch (e) {
        await supabase.from("kids_children").delete().eq("id", child.id);
        toast({ title: "Falha no upload da foto", description: (e as Error).message, variant: "destructive" });
      }
    }
    setBusy(false);
    toast({ title: "Cadastro concluído!", description: "Agora é só fazer o check-in." });
    // volta pro check-in já com o token (sala ou página) para completar a entrada
    nav(`/kids/checkin?token=${encodeURIComponent(token!)}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-amber-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-sm text-slate-700 text-sm font-semibold mb-3">
            <Baby className="w-4 h-4 text-violet-600" /> {page.name}
          </div>
          {mode === "room" && room ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900">Sala: {room.name}</h1>
              <p className="text-sm text-slate-600">Faixa etária: {room.age_min}–{room.age_max} anos</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900">Cadastro <LeviKidsWordmark /></h1>
              <p className="text-sm text-slate-600">A sala é escolhida automaticamente pela idade da criança.</p>
            </>
          )}
        </div>

        {step === "consent" && (
          <Card className="rounded-3xl border-2">
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Termo de consentimento</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <pre className="p-4 bg-card border-2 border-border rounded-xl text-sm leading-relaxed text-foreground dark:text-white whitespace-pre-wrap max-h-72 overflow-auto font-sans">{page.consent_text}</pre>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={accepted} onCheckedChange={v => setAccepted(!!v)} />
                <span className="text-sm text-foreground">Li e concordo com o Termo de Consentimento e Responsabilidade (versão {page.consent_version}).</span>
              </label>
              <Button onClick={acceptConsent} disabled={!accepted || busy} className="w-full rounded-xl">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aceitar e continuar"}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "guardian" && (
          <Card className="rounded-3xl border-2">
            <CardHeader><CardTitle>Seus dados (responsável)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Nome completo *</Label><Input value={guardian.full_name} onChange={e => setGuardian({ ...guardian, full_name: e.target.value })} /></div>
              <div><Label>WhatsApp *</Label><Input value={guardian.phone} onChange={e => setGuardian({ ...guardian, phone: e.target.value })} placeholder="(11) 99999-9999" /></div>
              <div>
                <Label>CPF *</Label>
                <Input inputMode="numeric" value={guardian.cpf} onChange={e => setGuardian({ ...guardian, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" maxLength={14} />
                <p className="text-[10px] text-slate-500 mt-1">Necessário apenas para a área Kids (segurança na retirada da criança).</p>
              </div>
              <div><Label>Data de nascimento (precisa ser 18+) *</Label><Input type="date" value={guardian.birth_date} onChange={e => setGuardian({ ...guardian, birth_date: e.target.value })} /></div>
              <div><Label>Foto (opcional)</Label><Input type="file" accept="image/*" onChange={e => setGuardian({ ...guardian, photoFile: e.target.files?.[0] || null })} /></div>
              <Button onClick={saveGuardian} disabled={busy} className="w-full rounded-xl">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continuar"}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "children" && (
          <Card className="rounded-3xl border-2">
            <CardHeader><CardTitle>Cadastro de filhos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {children.map((c, i) => (
                <div key={i} className="p-4 rounded-2xl border-2 border-violet-100 space-y-2 relative">
                  {children.length > 1 && (
                    <button onClick={() => setChildren(children.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-red-500"><Trash2 className="w-4 h-4" /></button>
                  )}
                  <div><Label>Nome completo *</Label><Input value={c.full_name} onChange={e => { const n = [...children]; n[i].full_name = e.target.value; setChildren(n); }} /></div>
                  <div><Label>Data de nascimento *</Label><Input type="date" value={c.birth_date} onChange={e => { const n = [...children]; n[i].birth_date = e.target.value; setChildren(n); }} /><p className="text-[10px] text-slate-500 mt-1">A idade define automaticamente a sala no check-in.</p></div>
                  <div><Label>Alergias</Label><Input value={c.allergies} onChange={e => { const n = [...children]; n[i].allergies = e.target.value; setChildren(n); }} placeholder="Ex.: amendoim, leite" /></div>
                  <div><Label>Restrições</Label><Input value={c.restrictions} onChange={e => { const n = [...children]; n[i].restrictions = e.target.value; setChildren(n); }} /></div>
                  <div><Label>Observações</Label><Textarea rows={2} value={c.notes} onChange={e => { const n = [...children]; n[i].notes = e.target.value; setChildren(n); }} /></div>
                  <div><Label className="text-red-600">Foto da criança *</Label><Input type="file" accept="image/*" required onChange={e => { const n = [...children]; n[i].photoFile = e.target.files?.[0] || null; setChildren(n); }} /><p className="text-[10px] text-slate-500 mt-1">Obrigatória para identificação no check-in.</p></div>
                </div>
              ))}
              <Button variant="outline" onClick={() => setChildren([...children, { full_name: "", birth_date: "", allergies: "", restrictions: "", notes: "", photoFile: null }])} className="w-full rounded-xl">
                <Plus className="w-4 h-4 mr-2" /> Adicionar outro filho
              </Button>
              <Button onClick={saveChildren} disabled={busy} className="w-full rounded-xl">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Finalizar e ir para o check-in"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Cadastro / Login inline (sem exigir código de convite de igreja)
// ─────────────────────────────────────────────
function InlineAuth({ pageName, roomLabel }: { pageName: string; roomLabel: string | null }) {
  const [tab, setTab] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function doSignup() {
    if (!name.trim() || !email.trim() || password.length < 6 || whatsapp.replace(/\D/g, "").length < 10) {
      toast({ title: "Preencha todos os campos", description: "Senha com 6+ caracteres e WhatsApp válido.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.href,
        data: { name: name.trim(), whatsapp: whatsapp.replace(/\D/g, "") },
      },
    });
    setBusy(false);
    if (error) { toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" }); return; }
    // tenta login automático (email confirm off / ou sessão imediata)
    const { error: le } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (le) {
      toast({ title: "Confirme seu email", description: "Enviamos um link de confirmação. Depois faça login aqui." });
      setTab("login");
    }
  }

  async function doLogin() {
    if (!email.trim() || !password) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { toast({ title: "Falha no login", description: error.message, variant: "destructive" }); return; }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-violet-50 via-white to-amber-50">
      <Card className="max-w-md w-full rounded-3xl border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Baby className="w-5 h-5 text-violet-600"/> <LeviKidsWordmark /> — {pageName}</CardTitle>
          {roomLabel && <p className="text-xs text-slate-500">Sala: <b>{roomLabel}</b></p>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button onClick={() => setTab("signup")} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab==="signup" ? "bg-white shadow" : "text-slate-600"}`}>Criar conta</button>
            <button onClick={() => setTab("login")} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab==="login" ? "bg-white shadow" : "text-slate-600"}`}>Já tenho conta</button>
          </div>

          {tab === "signup" ? (
            <>
              <p className="text-xs text-slate-500">Cadastro do responsável pelas crianças. Nos próximos check-ins seu celular já vai lembrar do login.</p>
              <div><Label>Nome completo</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div><Label>WhatsApp</Label><Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" /></div>
              <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div><Label>Senha</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" /></div>
              <Button onClick={doSignup} disabled={busy} className="w-full rounded-xl">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar conta e continuar"}
              </Button>
            </>
          ) : (
            <>
              <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div><Label>Senha</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
              <Button onClick={doLogin} disabled={busy} className="w-full rounded-xl">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
