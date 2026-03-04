import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { department_id, department_name, announcement_title } = await req.json();
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

    const { data: insertedNotifs } = await supabaseAdmin
      .from("notifications")
      .insert(notifications as any)
      .select("id, user_id");

    // Send WhatsApp to each member with link
    const notifMap = new Map((insertedNotifs || []).map((n: any) => [n.user_id, n.id]));
    let whatsappSent = 0;

    const whatsappResults = await Promise.allSettled(
      (memberProfiles || [])
        .filter((p: any) => p.whatsapp)
        .map(async (p: any) => {
          const notifId = notifMap.get(p.id);
          const viewUrl = notifId ? `${supabaseUrl}/functions/v1/view-notification?id=${notifId}` : '';
          const msg = `📢 *Aviso — ${department_name}*\n\nOlá, *${p.name}*!\n\n${announcement_title}\n\n${viewUrl ? `👉 Ver detalhes:\n${viewUrl}\n\n` : ''}_LEVI — Escalas Inteligentes_`;

          const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({ phone: p.whatsapp, message: msg }),
          });
          const data = await res.json();
          return data.sent === true;
        })
    );

    whatsappSent = whatsappResults.filter(r => r.status === "fulfilled" && r.value === true).length;
    console.log(`Announcement: ${memberIds.length} notified, ${whatsappSent} WhatsApp`);

    return new Response(
      JSON.stringify({ success: true, notified: memberIds.length, whatsapp_sent: whatsappSent }),
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
