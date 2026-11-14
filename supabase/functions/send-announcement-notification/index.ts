import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseAnnouncementId } from "./request.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", ...corsHeaders },
});

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return reply(401, { error: "Unauthorized" });
    const { data: { user: caller }, error: authError } = await admin.auth.getUser(authHeader.slice(7));
    if (authError || !caller) return reply(401, { error: "Unauthorized" });

    let announcementId: string;
    try {
      announcementId = parseAnnouncementId(await req.json());
    } catch {
      return reply(400, { error: "Invalid request" });
    }

    // Only notify about an existing, authored announcement. Never accept message
    // text, department names, recipient phones or delivery flags from the caller.
    const { data: announcement, error: announcementError } = await admin
      .from("department_announcements").select("id, department_id, author_id, title")
      .eq("id", announcementId).maybeSingle();
    if (announcementError) throw announcementError;
    if (!announcement || announcement.author_id !== caller.id) return reply(403, { error: "Forbidden" });

    const { data: dept, error: deptError } = await admin.from("departments")
      .select("leader_id, name").eq("id", announcement.department_id).maybeSingle();
    if (deptError) throw deptError;
    if (!dept || dept.leader_id !== caller.id) return reply(403, { error: "Forbidden" });

    const { data: members, error: membersError } = await admin.from("members")
      .select("user_id").eq("department_id", announcement.department_id).neq("user_id", caller.id);
    if (membersError) throw membersError;
    const memberIds = [...new Set((members ?? []).map((m) => m.user_id))];
    if (!memberIds.length) return reply(200, { success: true, notified: 0, whatsapp_queued: 0 });

    const { data: profiles, error: profilesError } = await admin.from("profiles")
      .select("id, name").in("id", memberIds);
    if (profilesError) throw profilesError;
    const notifications = memberIds.map((userId) => ({
      user_id: userId,
      department_id: announcement.department_id,
      type: "announcement",
      message: `📢 Novo aviso em ${dept.name}: ${announcement.title}`,
      status: "sent",
      metadata: {
        announcement_id: announcement.id,
        department_name: dept.name,
        announcement_title: announcement.title,
        user_name: profiles?.find((p) => p.id === userId)?.name || "Vocacionado",
      },
    }));
    const { error: insertError } = await admin.from("notifications").insert(notifications);
    if (insertError) throw insertError;

    // WhatsApp delivery belongs exclusively to the authenticated delayed worker.
    // This user-callable endpoint cannot enqueue or send external messages.
    return reply(200, { success: true, notified: memberIds.length, whatsapp_queued: 0 });
  } catch (error) {
    console.error("Announcement notification failed:", error);
    return reply(500, { error: "Unable to notify announcement" });
  }
});
