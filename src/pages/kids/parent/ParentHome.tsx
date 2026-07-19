import { useAuth } from "@/hooks/useAuth";
import { useMyKids } from "@/hooks/useMyKids";
import { useDailyVerse } from "@/hooks/useDailyVerse";
import { VerseCard } from "@/components/portal-kids/VerseCard";
import { PillCard } from "@/components/portal-kids/PillCard";
import { LeviKidsWordmark } from "@/components/LeviKidsWordmark";
import { Link } from "react-router-dom";
import { Baby, Calendar, HandHeart, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function ParentHome() {
  const { user } = useAuth();
  const { kids } = useMyKids();
  const pageId = kids[0]?.page_id;
  const { verse } = useDailyVerse(pageId);
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setFirstName((data?.name || "").split(" ")[0] || ""));
  }, [user?.id]);

  const active = kids.filter((k) => k.has_open_checkin).length;

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-24">
      <div className="mb-4">
        <span className="pk-chip">Portal <LeviKidsWordmark /></span>
        <h1 className="pk-title text-3xl mt-2 pk-heading-gradient">Olá, {firstName || "Pai/Mãe"}! 👋</h1>
        <p className="text-sm opacity-70">Que bom te ver por aqui hoje 💜</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <PillCard glow="pink" className="text-center">
          <Baby className="w-6 h-6 mx-auto text-pink-500" />
          <p className="pk-title text-2xl mt-1">{kids.length}</p>
          <p className="text-xs opacity-70">{kids.length === 1 ? "filho(a)" : "filhos"}</p>
        </PillCard>
        <PillCard glow="green" className="text-center">
          <Bell className="w-6 h-6 mx-auto text-emerald-500" />
          <p className="pk-title text-2xl mt-1">{active}</p>
          <p className="text-xs opacity-70">na igreja agora</p>
        </PillCard>
      </div>

      <VerseCard verse={verse} showDevotional />

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Link to="/kids/parent/filhos">
          <PillCard as="button" glow="purple" className="text-center h-full">
            <Baby className="w-7 h-7 mx-auto text-purple-500" />
            <p className="pk-title mt-1 text-sm">Meus Filhos</p>
          </PillCard>
        </Link>
        <Link to="/kids/parent/agenda">
          <PillCard as="button" className="text-center h-full">
            <Calendar className="w-7 h-7 mx-auto text-pink-500" />
            <p className="pk-title mt-1 text-sm">Agenda</p>
          </PillCard>
        </Link>
        <Link to="/kids/parent/oracao">
          <PillCard as="button" glow="pink" className="text-center h-full col-span-2">
            <HandHeart className="w-7 h-7 mx-auto text-rose-500" />
            <p className="pk-title mt-1">Pedir Oração 🙏</p>
          </PillCard>
        </Link>
      </div>
    </div>
  );
}
