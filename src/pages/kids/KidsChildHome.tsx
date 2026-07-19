import { useKidChildSession, clearChildSession } from "@/hooks/useKidChildSession";
import { useDailyVerse } from "@/hooks/useDailyVerse";
import { VerseCard } from "@/components/portal-kids/VerseCard";
import { PillCard } from "@/components/portal-kids/PillCard";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import mascot from "@/assets/portal-kids/mascot-child.png";
import medal from "@/assets/portal-kids/icon-medal.png";
import { LogOut, Star } from "lucide-react";


export default function KidsChildHome() {
  const { session } = useKidChildSession();
  const navigate = useNavigate();
  const { verse } = useDailyVerse(session?.page_id);
  const [medals, setMedals] = useState(0);
  const [alreadyMemorized, setAlreadyMemorized] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!session) { navigate("/kids/child/login", { replace: true }); return; }
    (async () => {
      const { count } = await supabase
        .from("kids_verse_memorized")
        .select("id", { count: "exact", head: true })
        .eq("child_id", session.child_id);
      setMedals(count || 0);
      if (verse) {
        const { data } = await supabase
          .from("kids_verse_memorized")
          .select("id")
          .eq("child_id", session.child_id)
          .eq("verse_id", verse.id)
          .maybeSingle();
        setAlreadyMemorized(!!data);
      }
      if (session.photo_path) {
        const { data } = await supabase.storage.from("kids-photos").createSignedUrl(session.photo_path, 3600);
        setPhotoUrl(data?.signedUrl ?? null);
      }
    })();
  }, [session, verse]);

  if (!session) return null;

  const markMemorized = async () => {
    if (!verse) return;
    const { error } = await supabase.from("kids_verse_memorized").insert({
      child_id: session.child_id,
      verse_id: verse.id,
    });
    if (error) return toast({ title: "Ops", description: error.message, variant: "destructive" });
    setAlreadyMemorized(true);
    setMedals((m) => m + 1);
    toast({ title: "🌟 Você ganhou uma medalha!" });
  };

  const logout = () => { clearChildSession(); navigate("/kids"); };

  return (
    <div className="pk-root">
      <div className="max-w-md mx-auto px-4 py-6 pb-16">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img
              src={photoUrl || mascot}
              alt=""
              width={56}
              height={56}
              className="w-14 h-14 rounded-full object-cover border-4 border-white shadow-lg"
            />
            <div>
              <p className="text-xs opacity-70">Oi,</p>
              <p className="pk-title text-xl pk-heading-gradient">{session.full_name.split(" ")[0]}! 👋</p>
            </div>
          </div>
          <button onClick={logout} className="pk-pill p-2" aria-label="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <VerseCard
          verse={verse}
          action={
            verse ? (
              <button
                onClick={markMemorized}
                disabled={alreadyMemorized}
                className="pk-btn pk-btn-primary w-full disabled:opacity-60"
              >
                {alreadyMemorized ? "🌟 Já decorei este!" : "Decorei! 🎉"}
              </button>
            ) : null
          }
        />

        <PillCard glow="purple" className="mt-4 text-center">
          <img src={medal} alt="" className="w-24 h-24 mx-auto pk-float" loading="lazy" />
          <p className="text-xs opacity-70 mt-1">Minhas medalhas</p>
          <p className="pk-title text-4xl pk-heading-gradient">{medals}</p>
          <p className="text-xs opacity-70">versículos decorados</p>
        </PillCard>

        <PillCard glow="green" className="mt-4 text-center">
          <Star className="w-8 h-8 mx-auto text-amber-400" />
          <p className="pk-title mt-1">Jesus te ama muito! 💛</p>
          <p className="text-xs opacity-70">Volte todo dia para um versículo novinho.</p>
        </PillCard>
      </div>
    </div>
  );
}
