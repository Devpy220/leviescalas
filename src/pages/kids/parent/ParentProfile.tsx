import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PillCard } from "@/components/portal-kids/PillCard";
import { LogOut, User, Home } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";

export default function ParentProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("name, email").eq("id", user.id).maybeSingle()
      .then(({ data }) => { setName(data?.name || ""); setEmail(data?.email || user.email || ""); });
  }, [user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-24">
      <h1 className="pk-title text-2xl pk-heading-gradient mb-4">Meu Perfil</h1>

      <PillCard glow="purple" className="text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-3xl font-black shadow-lg">
          {name.charAt(0).toUpperCase() || "?"}
        </div>
        <p className="pk-title text-xl mt-3">{name || "—"}</p>
        <p className="text-sm opacity-70">{email}</p>
      </PillCard>

      <div className="mt-4 space-y-3">
        <Link to="/dashboard">
          <PillCard as="button" className="w-full flex items-center gap-3">
            <Home className="w-5 h-5 text-purple-500" />
            <span className="pk-title text-sm">Painel LEVI (adulto)</span>
          </PillCard>
        </Link>
        <Link to="/complete-profile">
          <PillCard as="button" className="w-full flex items-center gap-3">
            <User className="w-5 h-5 text-pink-500" />
            <span className="pk-title text-sm">Editar meus dados</span>
          </PillCard>
        </Link>
        <PillCard as="button" onClick={signOut} className="w-full flex items-center gap-3">
          <LogOut className="w-5 h-5 text-rose-500" />
          <span className="pk-title text-sm">Sair</span>
        </PillCard>
      </div>
    </div>
  );
}
