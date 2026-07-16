import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true when the user has access to LeviKids.
 *
 * Access rules (per user requirement):
 *  - Church leader IF the church already has a kids_pages row (i.e. someone
 *    created the LeviKids page for this church).
 *  - Explicit kids leader (kids_leaders) — the person who created the page.
 *  - Kids teacher (kids_teacher_rooms) — invited/self-registered teachers.
 *
 * NOT enough by itself:
 *  - Simply having registered the church (without an existing kids page).
 *  - Being a guardian (guardians use a different flow via /kids/join).
 */
export async function userHasKidsAccess(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const [leaders, teachers] = await Promise.all([
      supabase.from("kids_leaders").select("id", { head: true, count: "exact" }).eq("user_id", userId),
      supabase.from("kids_teacher_rooms").select("id", { head: true, count: "exact" }).eq("user_id", userId),
    ]);
    if ((leaders.count ?? 0) > 0) return true;
    if ((teachers.count ?? 0) > 0) return true;

    // Church leader whose church already has a kids page
    const { data: church } = await supabase
      .from("churches")
      .select("id")
      .eq("leader_id", userId)
      .maybeSingle();
    if (church?.id) {
      const { count } = await supabase
        .from("kids_pages")
        .select("id", { head: true, count: "exact" })
        .eq("church_id", church.id);
      if ((count ?? 0) > 0) return true;
    }
  } catch (e) {
    console.warn("[kidsAccess] check failed", e);
  }
  return false;
}
