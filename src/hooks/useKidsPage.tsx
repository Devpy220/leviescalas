import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface KidsPage {
  id: string;
  church_id: string;
  name: string;
  slug: string;
  consent_version: string;
  consent_text: string;
  primary_color: string;
  static_qr_token?: string | null;
}

export function useMyKidsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState<KidsPage | null>(null);
  const [role, setRole] = useState<"leader" | "teacher" | "guardian" | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    // Church leader → kids_page of that church (may not exist yet)
    const { data: church } = await supabase.from("churches").select("id").eq("leader_id", user.id).maybeSingle();
    if (church) {
      const { data: p } = await supabase.from("kids_pages").select("*").eq("church_id", church.id).maybeSingle();
      if (p) { setPage(p as KidsPage); setRole("leader"); setLoading(false); return; }
      setLoading(false); return;
    }

    // Kids leader promoted
    const { data: kl } = await supabase.from("kids_leaders").select("page_id, kids_pages(*)").eq("user_id", user.id).maybeSingle();
    if (kl && (kl as any).kids_pages) {
      setPage((kl as any).kids_pages as KidsPage); setRole("leader"); setLoading(false); return;
    }

    // Teacher of a room
    const { data: tr } = await supabase
      .from("kids_teacher_rooms")
      .select("kids_rooms(page_id, kids_pages(*))")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (tr && (tr as any).kids_rooms?.kids_pages) {
      setPage((tr as any).kids_rooms.kids_pages as KidsPage); setRole("teacher"); setLoading(false); return;
    }

    // Guardian
    const { data: g } = await supabase.from("kids_guardians").select("id").eq("user_id", user.id).maybeSingle();
    if (g) { setRole("guardian"); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { page, role, loading, reload: load };
}
