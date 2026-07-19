import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyKids } from "@/hooks/useMyKids";
import { PillCard } from "@/components/portal-kids/PillCard";
import { HandHeart, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ParentPrayer() {
  const { user } = useAuth();
  const { kids } = useMyKids();
  const [childId, setChildId] = useState<string>("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("kids_prayer_requests")
      .select("id, text, status, created_at, child_id")
      .eq("guardian_user_id", user.id)
      .order("created_at", { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const send = async () => {
    if (!text.trim() || !user) return;
    const target = childId || kids[0]?.id;
    if (!target) return toast({ title: "Cadastre um filho primeiro", variant: "destructive" });
    setBusy(true);
    const { error } = await supabase.from("kids_prayer_requests").insert({
      guardian_user_id: user.id,
      child_id: target,
      text: text.trim(),
    });
    setBusy(false);
    if (error) return toast({ title: "Ops", description: error.message, variant: "destructive" });
    setText(""); setChildId("");
    toast({ title: "🙏 Recebido! Estamos orando com você." });
    load();
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-24">
      <h1 className="pk-title text-2xl pk-heading-gradient mb-4">Pedido de Oração 🙏</h1>

      <PillCard glow="pink" className="space-y-3">
        {kids.length > 0 && (
          <select
            value={childId}
            onChange={(e) => setChildId(e.target.value)}
            className="w-full rounded-2xl border-2 border-white/60 bg-white/70 dark:bg-slate-800/70 px-4 py-2 text-sm font-bold"
          >
            <option value="">Sobre a família</option>
            {kids.map((k) => <option key={k.id} value={k.id}>Sobre {k.full_name}</option>)}
          </select>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder="Compartilhe seu pedido..."
          className="w-full rounded-2xl border-2 border-white/60 bg-white/70 dark:bg-slate-800/70 px-4 py-3 text-sm resize-none"
        />
        <button onClick={send} disabled={busy || !text.trim()} className="pk-btn pk-btn-primary w-full disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Enviar pedido 💜"}
        </button>
      </PillCard>

      <div className="mt-6 space-y-3">
        {items.map((p) => (
          <PillCard key={p.id}>
            <div className="flex items-start gap-2">
              <HandHeart className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm">{p.text}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(p.created_at).toLocaleDateString("pt-BR")} • {p.status === "praying" ? "🙏 Estamos orando" : p.status === "answered" ? "✨ Respondida" : "Recebido"}
                </p>
              </div>
            </div>
          </PillCard>
        ))}
      </div>
    </div>
  );
}
