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

    // Find announcements created 30+ minutes ago that haven't been notified
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: pendingAnnouncements, error: fetchErr } = await supabaseAdmin
      .from("department_announcements")
      .select("id, department_id, author_id, title")
      .eq("whatsapp_notified", false)
      .lte("created_at", thirtyMinAgo)
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchErr) throw fetchErr;

    if (!pendingAnnouncements || pendingAnnouncements.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let totalSent = 0;

    for (const announcement of pendingAnnouncements) {
      try {
        // Get department name
        const { data: dept } = await supabaseAdmin
          .from("departments")
          .select("name")
          .eq("id", announcement.department_id)
          .single();

        const deptName = dept?.name || "Departamento";

        // Get members excluding the author
        const { data: members } = await supabaseAdmin
          .from("members")
          .select("user_id")
          .eq("department_id", announcement.department_id)
          .neq("user_id", announcement.author_id);

        const memberIds = (members || []).map((m: any) => m.user_id);

        if (memberIds.length > 0) {
          // Fetch profiles with whatsapp
          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("id, name, whatsapp")
            .in("id", memberIds);

          // Send WhatsApp to each member
          const results = await Promise.allSettled(
            (profiles || [])
              .filter((p: any) => p.whatsapp)
              .map(async (p: any) => {
                const msg = `📢 *Aviso — ${deptName}*\n\nOlá, *${p.name}*!\n\n${announcement.title}\n\n_LEVI — Escalas Inteligentes_`;

                const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${serviceRoleKey}`,
                  },
                  body: JSON.stringify({ phone: p.whatsapp, message: msg }),
                });
                const data = await res.json();
                return data.sent === true;
              })
          );

          const sent = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
          totalSent += sent;
          console.log(`Announcement ${announcement.id}: ${sent} WhatsApp sent`);
        }

        // Mark as notified
        await supabaseAdmin
          .from("department_announcements")
          .update({ whatsapp_notified: true })
          .eq("id", announcement.id);
      } catch (err) {
        console.error(`Error processing announcement ${announcement.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ processed: pendingAnnouncements.length, whatsapp_sent: totalSent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-delayed-announcements error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
