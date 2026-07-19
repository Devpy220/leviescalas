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
      <Outlet />
      <ParentBottomNav />
    </div>
  );
}
