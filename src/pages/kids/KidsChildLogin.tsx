import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { KidPinPad } from "@/components/portal-kids/KidPinPad";
import { PillCard } from "@/components/portal-kids/PillCard";
import { writeChildSession } from "@/hooks/useKidChildSession";
import { toast } from "@/hooks/use-toast";
import mascot from "@/assets/portal-kids/mascot-child.png";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function KidsChildLogin() {
  const [params] = useSearchParams();
  const preselected = params.get("child");
  const navigate = useNavigate();
  const [childId, setChildId] = useState<string | null>(preselected);
  const [childName, setChildName] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preselected) {
      supabase.from("kids_children").select("full_name").eq("id", preselected).maybeSingle()
        .then(({ data }) => data && setChildName(data.full_name));
    }
  }, [preselected]);

  const onPin = async (pin: string) => {
    if (!childId) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("kids_verify_child_pin", { _child_id: childId, _pin: pin });
    setBusy(false);
    if (error || !data || (data as any[]).length === 0) {
      return toast({ title: "PIN incorreto 😢", description: "Peça ajuda ao seu pai/mãe.", variant: "destructive" });
    }
    const row = (data as any[])[0];
    writeChildSession({
      child_id: row.child_id,
      full_name: row.full_name,
      page_id: row.page_id,
      photo_path: row.photo_path,
      birth_date: row.birth_date,
    });
    toast({ title: `Oi, ${row.full_name.split(" ")[0]}! 💜` });
    navigate("/kids/child", { replace: true });
  };

  return (
    <div className="pk-root">
      <div className="max-w-md mx-auto px-4 py-8 pb-16">
        <button onClick={() => navigate("/kids")} className="flex items-center gap-1 text-sm font-bold mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="text-center mb-6">
          <img src={mascot} alt="" width={120} height={120} className="w-28 h-28 mx-auto pk-float" loading="eager" />
          <h1 className="pk-title text-2xl mt-2 pk-heading-gradient">
            {childName ? `Oi, ${childName.split(" ")[0]}!` : "Entrar como Criança"}
          </h1>
        </div>

        {!childId ? (
          <PillCard className="text-center space-y-3">
            <p className="text-sm">Peça ao seu pai/mãe abrir o app deles e clicar em <b>"Entrar como Criança"</b> no seu card 💜</p>
            <button onClick={() => navigate("/auth?returnUrl=/kids/parent/filhos")} className="pk-btn pk-btn-primary w-full">
              Entrar como responsável
            </button>
          </PillCard>
        ) : busy ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : (
          <PillCard>
            <KidPinPad onComplete={onPin} />
          </PillCard>
        )}
      </div>
    </div>
  );
}
