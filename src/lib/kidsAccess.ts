import { supabase } from "@/integrations/supabase/client";

/** Returns true if the user has any LeviKids access (leader, teacher or guardian). */
export async function userHasKidsAccess(userId: string): Promise<boolean> {
  try {
    const [leaders, teachers, guardians, church] = await Promise.all([
      supabase.from("kids_leaders").select("id", { head: true, count: "exact" }).eq("user_id", userId),
      supabase.from("kids_teacher_rooms").select("id", { head: true, count: "exact" }).eq("user_id", userId),
      supabase.from("kids_guardians").select("id", { head: true, count: "exact" }).eq("user_id", userId),
      supabase.from("churches").select("id").eq("leader_id", userId).maybeSingle(),
    ]);
    if ((leaders.count ?? 0) > 0) return true;
    if ((teachers.count ?? 0) > 0) return true;
    if ((guardians.count ?? 0) > 0) return true;
    if (church.data?.id) {
      const { count } = await supabase
        .from("kids_pages")
        .select("id", { head: true, count: "exact" })
        .eq("church_id", church.data.id);
      if ((count ?? 0) > 0) return true;
    }
  } catch (e) {
    console.warn("[kidsAccess] check failed", e);
  }
  return false;
}
