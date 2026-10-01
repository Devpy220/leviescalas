import { LanguageSelector } from "@/components/LanguageSelector";
import { Outlet, useNavigate } from "react-router-dom";
import { ParentBottomNav } from "@/components/portal-kids/ParentBottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export default function ParentLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth?returnUrl=/kids/parent", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="pk-root">
      <div className="max-w-md mx-auto flex justify-end px-4 pt-2"><LanguageSelector /></div>
      <Outlet />
      <ParentBottomNav />
    </div>
  );
}
