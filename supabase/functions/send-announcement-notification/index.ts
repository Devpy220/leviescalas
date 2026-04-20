import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { scheduleBatch } from "../_shared/whatsapp-queue.ts";
import { buildAnnouncementMessage } from "../_shared/messageVariants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { department_id, department_name, announcement_title, skip_whatsapp } = await req.json();
    if (!department_id || !department_name || !announcement_title) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify caller is department leader
    const { data: dept } = await supabaseAdmin.from("departments").select("leader_id").eq("id", department_id).single();
    if (!dept || dept.leader_id !== caller.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get members (excluding leader)
    const { data: members } = await supabaseAdmin.from("members").select("user_id").eq("department_id", department_id).neq("user_id", caller.id);
    const memberIds = (members || []).map((m: any) => m.user_id);

    if (memberIds.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch profiles
    const { data: memberProfiles } = await supabaseAdmin.from("profiles").select("id, name, whatsapp").in("id", memberIds);

    const metadata = {
      department_name,
      announcement_title,
    };

    // Insert notifications with metadata
    const notifications = memberIds.map((userId: string) => {
      const profile = (memberProfiles || []).find((p: any) => p.id === userId);
      return {
        user_id: userId,
        department_id,
        type: "announcement",
        message: `📢 Novo aviso em ${department_name}: ${announcement_title}`,
        status: "sent",
        metadata: { ...metadata, user_name: profile?.name || 'Voluntário' },
      };
    });

    await supabaseAdmin
      .from("notifications")
      .insert(notifications as any);

    // Send WhatsApp to each member (unless skip_whatsapp is true — delayed sending)
    let whatsappQueued = 0;

    if (!skip_whatsapp) {
      const recipients = (memberProfiles || [])
        .filter((p: any) => p.whatsapp)
        .map((p: any) => ({
          phone: p.whatsapp,
          message: buildAnnouncementMessage({
            userId: p.id,
            userName: p.name || "Voluntário",
            deptName: department_name,
            title: announcement_title,
          }),
        }));

      whatsappQueued = recipients.length;
      scheduleBatch(supabaseUrl, serviceRoleKey, recipients);
    }
    console.log(`Announcement: ${memberIds.length} notified, ${whatsappQueued} WhatsApp queued`);

    return new Response(
      JSON.stringify({ success: true, notified: memberIds.length, whatsapp_queued: whatsappQueued }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
