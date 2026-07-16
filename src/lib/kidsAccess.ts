import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true only if the user has an explicit LeviKids role:
 * - kids leader (kids_leaders)
 * - kids teacher (kids_teacher_rooms)
 * - guardian/responsável (kids_guardians)
 *
 * NOTE: Being the church registrant / church leader does NOT grant kids access.
 * The person who registers the church only receives the invitation link(s) —
 * they must explicitly join a kids role to see the LeviKids area.
 */
export async function userHasKidsAccess(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const [leaders, teachers, guardians] = await Promise.all([
      supabase.from("kids_leaders").select("id", { head: true, count: "exact" }).eq("user_id", userId),
      supabase.from("kids_teacher_rooms").select("id", { head: true, count: "exact" }).eq("user_id", userId),
      supabase.from("kids_guardians").select("id", { head: true, count: "exact" }).eq("user_id", userId),
    ]);
    if ((leaders.count ?? 0) > 0) return true;
    if ((teachers.count ?? 0) > 0) return true;
    if ((guardians.count ?? 0) > 0) return true;
  } catch (e) {
    console.warn("[kidsAccess] check failed", e);
  }
  return false;
}
