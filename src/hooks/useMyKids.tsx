import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MyKid {
  id: string;
  full_name: string;
  birth_date: string | null;
  photo_path: string | null;
  page_id: string;
  current_room_id: string | null;
  current_room_name: string | null;
  has_open_checkin: boolean;
  pin_set: boolean;
}

export function useMyKids() {
  const { user } = useAuth();
  const [kids, setKids] = useState<MyKid[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) { setKids([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data: guardianRows } = await supabase
        .from("kids_guardians")
        .select("id")
        .eq("user_id", user.id);
      const gIds = (guardianRows || []).map((g: any) => g.id);
      if (gIds.length === 0) { setKids([]); return; }

      const { data: links } = await supabase
        .from("kids_guardian_children")
        .select("child_id")
        .in("guardian_id", gIds);
      const cIds = Array.from(new Set((links || []).map((l: any) => l.child_id)));
      if (cIds.length === 0) { setKids([]); return; }

      const { data: childRows } = await supabase
        .from("kids_children")
        .select("id, full_name, birth_date, photo_path, page_id, current_room_id, pin_hash")
        .in("id", cIds);

      const roomIds = Array.from(new Set((childRows || []).map((c: any) => c.current_room_id).filter(Boolean)));
      const roomMap: Record<string, string> = {};
      if (roomIds.length) {
        const { data: rooms } = await supabase.from("kids_rooms").select("id, name").in("id", roomIds);
        (rooms || []).forEach((r: any) => { roomMap[r.id] = r.name; });
      }

      const { data: openCheck } = await supabase
        .from("kids_checkins")
        .select("child_id")
        .in("child_id", cIds)
        .is("checkout_at", null);
      const openSet = new Set((openCheck || []).map((c: any) => c.child_id));

      setKids((childRows || []).map((c: any) => ({
        id: c.id,
        full_name: c.full_name,
        birth_date: c.birth_date,
        photo_path: c.photo_path,
        page_id: c.page_id,
        current_room_id: c.current_room_id,
        current_room_name: c.current_room_id ? roomMap[c.current_room_id] ?? null : null,
        has_open_checkin: openSet.has(c.id),
        pin_set: !!c.pin_hash,
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id]);
  return { kids, loading, reload: load };
}
