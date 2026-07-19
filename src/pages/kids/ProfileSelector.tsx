import { Link, useNavigate } from "react-router-dom";
import { PillCard } from "@/components/portal-kids/PillCard";
import { LeviKidsWordmark } from "@/components/LeviKidsWordmark";
import { useAuth } from "@/hooks/useAuth";
import { useMyKidsPage } from "@/hooks/useKidsPage";
import { useKidChildSession } from "@/hooks/useKidChildSession";
import mascot from "@/assets/portal-kids/mascot-child.png";
import iconParent from "@/assets/portal-kids/icon-parent.png";
import iconTeacher from "@/assets/portal-kids/icon-teacher.png";
import iconLeader from "@/assets/portal-kids/icon-leader.png";
import { Loader2, ArrowRight } from "lucide-react";

export default function ProfileSelector() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { role, loading } = useMyKidsPage();
  const { session: childSession } = useKidChildSession();

  const profiles = [
    { key: "child", label: "Sou Criança", emoji: "🧒", img: mascot, glow: "pink" as const,
      go: () => navigate("/kids/child") },
    { key: "parent", label: "Sou Pai/Mãe", emoji: "👨‍👩‍👧", img: iconParent, glow: "purple" as const,
      go: () => navigate(user ? "/kids/parent" : "/auth?returnUrl=/kids/parent") },
    { key: "teacher", label: "Sou Professor(a)", emoji: "📚", img: iconTeacher, glow: "green" as const,
      go: () => navigate(user ? "/kids/dashboard" : "/auth?returnUrl=/kids/dashboard") },
    { key: "leader", label: "Sou Líder", emoji: "👑", img: iconLeader, glow: "purple" as const,
      go: () => navigate(user ? "/kids/admin" : "/auth?returnUrl=/kids/admin") },
  ];

  if (authLoading || loading) {
    return (
      <div className="pk-root flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="pk-root">
      <div className="max-w-md mx-auto px-4 py-8 pb-24">
        <div className="text-center mb-6 space-y-2">
          <img src={mascot} alt="" width={120} height={120} className="w-28 h-28 mx-auto pk-float" loading="eager" />
          <h1 className="pk-title text-3xl pk-heading-gradient">Portal <LeviKidsWordmark /></h1>
          <p className="text-sm opacity-80">Escolha como você vai entrar 💜</p>
        </div>

        {childSession && (
          <PillCard glow="pink" className="mb-4">
            <button onClick={() => navigate("/kids/child")} className="w-full flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs opacity-70">Continuar como</p>
                <p className="pk-title text-lg">{childSession.full_name}</p>
              </div>
              <ArrowRight className="w-5 h-5" />
            </button>
          </PillCard>
        )}

        {user && role && (
          <PillCard glow="purple" className="mb-4">
            <button
              onClick={() => {
                if (role === "leader") navigate("/kids/admin");
                else if (role === "teacher") navigate("/kids/dashboard");
                else navigate("/kids/parent");
              }}
              className="w-full flex items-center justify-between"
            >
              <div className="text-left">
                <p className="text-xs opacity-70">Entrar rápido</p>
                <p className="pk-title text-lg">Continuar como {role === "leader" ? "Líder" : role === "teacher" ? "Professor(a)" : "Responsável"}</p>
              </div>
              <ArrowRight className="w-5 h-5" />
            </button>
          </PillCard>
        )}

        <div className="grid grid-cols-2 gap-3">
          {profiles.map((p) => (
            <PillCard key={p.key} as="button" glow={p.glow} onClick={p.go} className="text-center">
              <img src={p.img} alt="" width={96} height={96} className="w-20 h-20 mx-auto mb-2" loading="lazy" />
              <p className="pk-title text-base leading-tight">{p.label}</p>
              <p className="text-2xl mt-1">{p.emoji}</p>
            </PillCard>
          ))}
        </div>

        <div className="text-center mt-6 space-y-2 text-xs opacity-70">
          <p>Novo por aqui? Peça o link de convite ao líder da igreja.</p>
          <Link to="/" className="underline">← Voltar ao LEVI</Link>
        </div>
      </div>
    </div>
  );
}
