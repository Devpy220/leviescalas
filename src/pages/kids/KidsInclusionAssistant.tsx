import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Save, Baby } from "lucide-react";
import { Link } from "react-router-dom";

interface Child {
  id: string; full_name: string; birth_date: string; allergies: string | null; restrictions: string | null; notes: string | null;
}

export default function KidsInclusionAssistant() {
  const { user } = useAuth();
  const [inclusionRooms, setInclusionRooms] = useState<Array<{ id: string; name: string; page_id: string }>>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<Child | null>(null);
  const [focus, setFocus] = useState("");
  const [suggestions, setSuggestions] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

  async function load() {
    // Salas de inclusão que o usuário lidera ou ensina
    const { data: rooms } = await supabase.from("kids_rooms").select("id, name, page_id").eq("is_inclusion", true);
    setInclusionRooms((rooms || []) as any);
    if (rooms && rooms.length) {
      const roomIds = rooms.map((r: any) => r.id);
      // crianças hoje presentes nessas salas
      const { data: cis } = await supabase.from("kids_checkins")
        .select("kids_children(id, full_name, birth_date, allergies, restrictions, notes)")
        .in("room_id", roomIds)
        .is("checkout_at", null);
      const kids: Child[] = (cis || []).map((r: any) => r.kids_children).filter(Boolean);
      // se ninguém presente, carrega todas de current_room_id na sala de inclusão
      if (kids.length === 0) {
        const { data: allk } = await supabase.from("kids_children")
          .select("id, full_name, birth_date, allergies, restrictions, notes, current_room_id")
          .in("current_room_id", roomIds);
        setChildren((allk || []) as any);
      } else {
        setChildren(kids);
      }
    }
  }

  async function ask() {
    if (!selected) return;
    setLoading(true); setSuggestions("");
    const age = Math.floor((Date.now() - new Date(selected.birth_date).getTime()) / (365.25*24*3600*1000));
    const { data, error } = await supabase.functions.invoke("kids-inclusion-ai", {
      body: {
        child_name: selected.full_name.split(" ")[0],
        age,
        allergies: selected.allergies,
        restrictions: selected.restrictions,
        notes: selected.notes,
        focus: focus || undefined,
      }
    });
    setLoading(false);
    if (error) { toast({ title: "Erro na IA", description: error.message, variant: "destructive" }); return; }
    setSuggestions((data as any)?.suggestions || "");
  }

  async function saveNote() {
    if (!selected || !suggestions.trim() || !user) return;
    setSaving(true);
    const { error } = await (supabase.from as any)("kids_inclusion_notes").insert({
      child_id: selected.id,
      author_id: user.id,
      title: focus ? `Sugestões IA — ${focus}` : "Sugestões IA",
      content: suggestions,
    });
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Sugestões salvas no perfil da criança" });
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Sparkles className="w-6 h-6 text-violet-600" /> Sala de Inclusão · Assistente IA</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">Sugestões práticas para acolher cada criança durante o culto.</p>
          </div>
          <Button asChild variant="outline" className="rounded-xl"><Link to="/kids/dashboard">← Voltar</Link></Button>
        </div>

        {inclusionRooms.length === 0 && (
          <Card className="rounded-3xl border-2"><CardContent className="p-8 text-center text-slate-600 dark:text-slate-300">Nenhuma sala de inclusão configurada. Peça ao líder para marcar uma sala como "Sala de inclusão".</CardContent></Card>
        )}

        {children.length > 0 && (
          <Card className="rounded-3xl border-2">
            <CardHeader><CardTitle className="text-base">Escolha uma criança</CardTitle></CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-2">
                {children.map(c => (
                  <button key={c.id} onClick={() => { setSelected(c); setSuggestions(""); }}
                    className={`text-left p-3 rounded-xl border-2 hover:bg-violet-50 ${selected?.id===c.id?"border-violet-400 bg-violet-50":"border-slate-200"}`}>
                    <p className="font-semibold flex items-center gap-2"><Baby className="w-4 h-4 text-violet-500"/>{c.full_name}</p>
                    {c.restrictions && <p className="text-xs text-amber-700 mt-1">⚠ {c.restrictions}</p>}
                    {c.notes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{c.notes}</p>}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {selected && (
          <Card className="rounded-3xl border-2">
            <CardHeader><CardTitle className="text-base">Perfil de {selected.full_name}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Foco principal (opcional)</Label>
                <Input placeholder="Ex.: autismo, TDAH, síndrome de Down, cadeirante…" value={focus} onChange={e=>setFocus(e.target.value)} />
              </div>
              <Button onClick={ask} disabled={loading} className="w-full rounded-xl">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2"/>Pensando…</> : <><Sparkles className="w-4 h-4 mr-2"/>Pedir ideias à IA</>}
              </Button>

              {suggestions && (
                <div className="space-y-2">
                  <Textarea rows={14} value={suggestions} onChange={e=>setSuggestions(e.target.value)} className="font-mono text-sm" />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={()=>setSuggestions("")} className="rounded-xl">Limpar</Button>
                    <Button onClick={saveNote} disabled={saving} className="rounded-xl">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Save className="w-4 h-4 mr-1"/>Salvar no perfil</>}
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Sugestões geradas por IA. Nunca substituem orientação médica ou pedagógica profissional.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
