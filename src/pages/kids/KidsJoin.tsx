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

export default function KidsJoin() {
  const { token } = useParams();
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"consent" | "guardian" | "children">("consent");
  const [accepted, setAccepted] = useState(false);
  const [guardian, setGuardian] = useState({ full_name: "", phone: "", birth_date: "", photoFile: null as File | null });
  const [guardianId, setGuardianId] = useState<string | null>(null);
  const [children, setChildren] = useState<Array<{ id?: string; full_name: string; birth_date: string; allergies: string; restrictions: string; notes: string; photoFile: File | null }>>([
    { full_name: "", birth_date: "", allergies: "", restrictions: "", notes: "", photoFile: null }
  ]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await supabase.rpc("kids_lookup_room_by_static_token", { _token: token });
      const row = Array.isArray(data) ? data[0] : null;
      if (row) {
        setRoom({ id: row.room_id, name: row.room_name, color: row.room_color, page_id: row.page_id } as any);
        setPage({ id: row.page_id, name: row.page_name, consent_version: row.consent_version, consent_text: row.consent_text } as any);
      }
      setLoading(false);
    })();
  }, [token]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Existing guardian?
      const { data: g } = await supabase.from("kids_guardians").select("*").eq("user_id", user.id).maybeSingle();
      if (g) {
        setGuardianId(g.id);
        setGuardian({ full_name: g.full_name, phone: g.phone, birth_date: g.birth_date, photoFile: null });
        // Already accepted this page's current version?
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

  if (!room || !page) {
    return <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div><h1 className="text-2xl font-bold mb-2">QR inválido</h1><p className="text-slate-600">Este link de cadastro não é válido.</p></div>
    </div>;
  }

  if (!user) {
    const returnUrl = `/kids/join/${token}`;
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full rounded-3xl border-2">
          <CardHeader><CardTitle>Entre para cadastrar seu(sua) filho(a)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Sala: <b>{room.name}</b> — {page.name}</p>
            <Button onClick={() => nav("/auth", { state: { returnUrl } })} className="w-full rounded-xl">Entrar / Cadastrar</Button>
          </CardContent>
        </Card>
      </div>
    );
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
    if (!user || !guardian.full_name || !guardian.phone || !guardian.birth_date) {
      toast({ title: "Preencha todos os campos" }); return;
    }
    // 18+
    const bd = new Date(guardian.birth_date);
    const age = (Date.now() - bd.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 18) { toast({ title: "É necessário ter 18 anos ou mais.", variant: "destructive" }); return; }
    setBusy(true);
    let photo_path: string | null = null;
    const { data: g, error } = await supabase.from("kids_guardians").upsert({
      user_id: user.id, full_name: guardian.full_name, phone: guardian.phone, birth_date: guardian.birth_date,
    }, { onConflict: "user_id" }).select("id").single();
    if (error || !g) { setBusy(false); toast({ title: "Erro", description: error?.message, variant: "destructive" }); return; }
    if (guardian.photoFile) {
      try {
        photo_path = await uploadKidsPhoto(guardian.photoFile, page!.id, "guardian", g.id);
        await supabase.from("kids_guardians").update({ photo_path }).eq("id", g.id);
      } catch (e) { /* non-fatal */ }
    }
    setGuardianId(g.id);
    setBusy(false);
    setStep("children");
  }

  async function saveChildren() {
    if (!guardianId || !room || !page) return;
    setBusy(true);
    for (const c of children) {
      if (!c.full_name || !c.birth_date) continue;
      // suggested room by age match
      const bd = new Date(c.birth_date);
      const ageYears = Math.floor((Date.now() - bd.getTime()) / (365.25 * 24 * 3600 * 1000));
      const suggested_room_id = (ageYears >= room.age_min && ageYears <= room.age_max) ? room.id : null;

      const { data: child, error } = await supabase.from("kids_children").insert({
        page_id: page.id, suggested_room_id, full_name: c.full_name, birth_date: c.birth_date,
        allergies: c.allergies || null, restrictions: c.restrictions || null, notes: c.notes || null,
        created_by: user!.id,
      }).select("id").single();
      if (error || !child) continue;
      await supabase.from("kids_guardian_children").insert({ guardian_id: guardianId, child_id: child.id });
      if (c.photoFile) {
        try {
          const p = await uploadKidsPhoto(c.photoFile, page.id, "child", child.id);
          await supabase.from("kids_children").update({ photo_path: p }).eq("id", child.id);
        } catch { /* ignore */ }
      }
    }
    setBusy(false);
    toast({ title: "Cadastro concluído!", description: "Você já pode fazer o check-in na sala." });
    nav("/kids/checkin");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-amber-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-sm text-slate-700 text-sm font-semibold mb-3">
            <Baby className="w-4 h-4 text-violet-600" /> {page.name}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Sala: {room.name}</h1>
          <p className="text-sm text-slate-600">Faixa etária: {room.age_min}–{room.age_max} anos</p>
        </div>

        {step === "consent" && (
          <Card className="rounded-3xl border-2">
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Termo de consentimento</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <pre className="p-4 bg-slate-50 rounded-xl text-xs whitespace-pre-wrap max-h-72 overflow-auto">{page.consent_text}</pre>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={accepted} onCheckedChange={v => setAccepted(!!v)} />
                <span className="text-sm text-slate-700">Li e concordo com o Termo de Consentimento e Responsabilidade (versão {page.consent_version}).</span>
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
              <div><Label>Nome completo</Label><Input value={guardian.full_name} onChange={e => setGuardian({ ...guardian, full_name: e.target.value })} /></div>
              <div><Label>WhatsApp</Label><Input value={guardian.phone} onChange={e => setGuardian({ ...guardian, phone: e.target.value })} placeholder="(11) 99999-9999" /></div>
              <div><Label>Data de nascimento (precisa ser 18+)</Label><Input type="date" value={guardian.birth_date} onChange={e => setGuardian({ ...guardian, birth_date: e.target.value })} /></div>
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
                  <div><Label>Nome completo</Label><Input value={c.full_name} onChange={e => { const n = [...children]; n[i].full_name = e.target.value; setChildren(n); }} /></div>
                  <div><Label>Data de nascimento</Label><Input type="date" value={c.birth_date} onChange={e => { const n = [...children]; n[i].birth_date = e.target.value; setChildren(n); }} /></div>
                  <div><Label>Alergias</Label><Input value={c.allergies} onChange={e => { const n = [...children]; n[i].allergies = e.target.value; setChildren(n); }} placeholder="Ex.: amendoim, leite" /></div>
                  <div><Label>Restrições</Label><Input value={c.restrictions} onChange={e => { const n = [...children]; n[i].restrictions = e.target.value; setChildren(n); }} /></div>
                  <div><Label>Observações</Label><Textarea rows={2} value={c.notes} onChange={e => { const n = [...children]; n[i].notes = e.target.value; setChildren(n); }} /></div>
                  <div><Label>Foto (opcional)</Label><Input type="file" accept="image/*" onChange={e => { const n = [...children]; n[i].photoFile = e.target.files?.[0] || null; setChildren(n); }} /></div>
                </div>
              ))}
              <Button variant="outline" onClick={() => setChildren([...children, { full_name: "", birth_date: "", allergies: "", restrictions: "", notes: "", photoFile: null }])} className="w-full rounded-xl">
                <Plus className="w-4 h-4 mr-2" /> Adicionar outro filho
              </Button>
              <Button onClick={saveChildren} disabled={busy} className="w-full rounded-xl">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Finalizar cadastro"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
