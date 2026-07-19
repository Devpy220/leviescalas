import { useMyKids, MyKid } from "@/hooks/useMyKids";
import { PillCard } from "@/components/portal-kids/PillCard";
import { KidPinPad } from "@/components/portal-kids/KidPinPad";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Baby, Loader2, KeyRound, LogIn, QrCode, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { writeChildSession } from "@/hooks/useKidChildSession";
import { useNavigate } from "react-router-dom";
import mascotFallback from "@/assets/portal-kids/mascot-child.png";

function KidCard({ kid, onChanged }: { kid: MyKid; onChanged: () => void }) {
  const navigate = useNavigate();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "set-pin" | "verify-pin" | "precheck">("idle");
  const [busy, setBusy] = useState(false);
  const [preCode, setPreCode] = useState<string | null>(null);

  useEffect(() => {
    if (!kid.photo_path) return;
    supabase.storage.from("kids-photos").createSignedUrl(kid.photo_path, 3600)
      .then(({ data }) => setPhotoUrl(data?.signedUrl ?? null));
  }, [kid.photo_path]);

  const generatePreCheck = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("kids_generate_precheckin", { _child_id: kid.id });
    setBusy(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setPreCode(data as string);
    setMode("precheck");
  };

  const setPin = async (pin: string) => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("kids_set_child_pin", { _child_id: kid.id, _pin: pin });
    setBusy(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "PIN salvo! 🔒" });
    setMode("idle");
    onChanged();
  };

  const enterAsChild = async (pin: string) => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("kids_verify_child_pin", { _child_id: kid.id, _pin: pin });
    setBusy(false);
    if (error || !data || (data as any[]).length === 0) {
      return toast({ title: "PIN incorreto", variant: "destructive" });
    }
    const row = (data as any[])[0];
    writeChildSession({
      child_id: row.child_id, full_name: row.full_name, page_id: row.page_id,
      photo_path: row.photo_path, birth_date: row.birth_date,
    });
    navigate("/kids/child");
  };

  return (
    <PillCard glow={kid.has_open_checkin ? "green" : "purple"} className="space-y-3">
      <div className="flex items-center gap-3">
        <img
          src={photoUrl || mascotFallback}
          alt=""
          width={64}
          height={64}
          className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg"
        />
        <div className="flex-1 min-w-0">
          <p className="pk-title text-lg truncate">{kid.full_name}</p>
          <p className="text-xs opacity-70 truncate">
            {kid.current_room_name || "Sem sala definida"}
          </p>
          <span className={"pk-chip mt-1 " + (kid.has_open_checkin ? "!bg-emerald-100 !text-emerald-800" : "!bg-slate-100 !text-slate-700")}>
            {kid.has_open_checkin ? "🟢 Na igreja" : "🏠 Em casa"}
          </span>
        </div>
      </div>

      {mode === "idle" && (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={generatePreCheck} disabled={busy} className="pk-pill p-2 text-xs font-bold flex flex-col items-center gap-1">
            <QrCode className="w-4 h-4" /> Pré check-in
          </button>
          <button onClick={() => setMode("set-pin")} className="pk-pill p-2 text-xs font-bold flex flex-col items-center gap-1">
            <KeyRound className="w-4 h-4" /> {kid.pin_set ? "Trocar PIN" : "Criar PIN"}
          </button>
          <button
            onClick={() => setMode("verify-pin")}
            disabled={!kid.pin_set}
            className="pk-pill p-2 text-xs font-bold flex flex-col items-center gap-1 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" /> Modo Criança
          </button>
        </div>
      )}

      {mode === "precheck" && preCode && (
        <div className="pk-pill p-4 text-center space-y-2">
          <p className="text-xs opacity-70">Mostre este código na recepção</p>
          <p className="pk-title text-4xl pk-heading-gradient tracking-widest">{preCode}</p>
          <button
            onClick={() => { navigator.clipboard.writeText(preCode); toast({ title: "Copiado!" }); }}
            className="text-xs inline-flex items-center gap-1 opacity-70"
          >
            <Copy className="w-3 h-3" /> Copiar
          </button>
          <button onClick={() => setMode("idle")} className="pk-btn pk-btn-primary w-full text-xs">OK</button>
        </div>
      )}

      {mode === "set-pin" && (
        <div className="pk-pill p-4">
          {busy ? <Loader2 className="w-6 h-6 mx-auto animate-spin" /> : <KidPinPad onComplete={setPin} title="Crie um PIN de 4 dígitos" />}
          <button onClick={() => setMode("idle")} className="mt-3 text-xs opacity-70 mx-auto block">cancelar</button>
        </div>
      )}

      {mode === "verify-pin" && (
        <div className="pk-pill p-4">
          {busy ? <Loader2 className="w-6 h-6 mx-auto animate-spin" /> : <KidPinPad onComplete={enterAsChild} title={`PIN de ${kid.full_name.split(" ")[0]}`} />}
          <button onClick={() => setMode("idle")} className="mt-3 text-xs opacity-70 mx-auto block">cancelar</button>
        </div>
      )}
    </PillCard>
  );
}

export default function ParentChildren() {
  const { kids, loading, reload } = useMyKids();

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-24">
      <h1 className="pk-title text-2xl pk-heading-gradient mb-4">Meus Filhos 💜</h1>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : kids.length === 0 ? (
        <PillCard className="text-center">
          <Baby className="w-10 h-10 mx-auto opacity-60" />
          <p className="mt-2 text-sm">Nenhum filho cadastrado ainda.</p>
          <p className="text-xs opacity-70 mt-1">Faça o cadastro pelo QR Code da igreja no check-in.</p>
        </PillCard>
      ) : (
        <div className="space-y-3">
          {kids.map((k) => <KidCard key={k.id} kid={k} onChanged={reload} />)}
        </div>
      )}
    </div>
  );
}
