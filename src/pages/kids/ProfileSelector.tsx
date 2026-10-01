import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KidsNoAccessDialog } from "@/components/kids/KidsNoAccessDialog";
import { SEO } from "@/components/SEO";
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
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { role, loading } = useMyKidsPage();
  const { session: childSession } = useKidChildSession();
  const [noAccess, setNoAccess] = useState(false);

  // Logged in but with no LeviKids link (no leader/teacher/guardian record)
  const goOrWarn = (path: string) => {
    if (!user) return navigate(`/auth?returnUrl=${path}`);
    if (!role) return setNoAccess(true);
    navigate(path);
  };

  const profiles = [
    { key: "child", label: "{t("kids.child")}", emoji: "🧒", img: mascot, glow: "pink" as const,
      go: () => navigate("/kids/child") },
    { key: "parent", label: "{t("kids.parent")}", emoji: "👨‍👩‍👧", img: iconParent, glow: "purple" as const,
      go: () => goOrWarn("/kids/parent") },
    { key: "teacher", label: "{t("kids.teacher")}", emoji: "📚", img: iconTeacher, glow: "green" as const,
      go: () => goOrWarn("/kids/dashboard") },
    { key: "leader", label: "{t("kids.leader")}", emoji: "👑", img: iconLeader, glow: "purple" as const,
      go: () => goOrWarn("/kids/admin") },
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
      <SEO
        title={`LeviKids — ${t("kids.headline")}`}
        description={t("kids.intro")}
        path="/kids"
      />
      <div className="max-w-md mx-auto px-4 py-8 pb-24">
        <div className="flex justify-end"><LanguageSelector /></div>
        <div className="text-center mb-6 space-y-2">
          <img src={mascot} alt="" width={120} height={120} className="w-28 h-28 mx-auto pk-float" loading="eager" />
          <h1 className="pk-title text-3xl pk-heading-gradient">Portal <LeviKidsWordmark /></h1>
          <p className="text-sm opacity-80">{t("kids.chooseProfile")}</p>
        </div>

        {childSession && (
          <PillCard glow="pink" className="mb-4">
            <button onClick={() => navigate("/kids/child")} className="w-full flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs opacity-70">{t("kids.continueAs")}</p>
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
                <p className="text-xs opacity-70">{t("kids.quickAccess")}</p>
                <p className="pk-title text-lg">{t("kids.continueAs")} {role === "leader" ? t("kids.leaderRole") : role === "teacher" ? t("kids.teacherRole") : t("kids.guardianRole")}</p>
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
          <p>{t("kids.newHere")}</p>
          <button type="button" onClick={() => setNoAccess(true)} className="underline">
            {t("kids.cannotEnter")}
          </button>
          <p><Link to="/" className="underline">{t("kids.backLevi")}</Link></p>
        </div>
      </div>
      <KidsNoAccessDialog open={noAccess} onOpenChange={setNoAccess} />
    </div>
  );
}
