import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sendPushNotification = async (
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
      },
      body: JSON.stringify({ userIds, title, body, data }),
    });
  } catch (e) {
    console.error("Push error:", e);
  }
};

const sendTelegramNotification = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  message: string
): Promise<boolean> => {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-telegram-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ userId, message }),
    });
    const data = await res.json();
    return data.sent === 1;
  } catch (e) {
    console.error("Telegram error for user", userId, e);
    return false;
  }
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { department_id, department_name, announcement_title } = await req.json();

    if (!department_id || !department_name || !announcement_title) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify caller is department leader
    const { data: dept } = await supabaseAdmin
      .from("departments")
      .select("leader_id")
      .eq("id", department_id)
      .single();

    if (!dept || dept.leader_id !== caller.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get all members (excluding the leader/author)
    const { data: members } = await supabaseAdmin
      .from("members")
      .select("user_id")
      .eq("department_id", department_id)
      .neq("user_id", caller.id);

    const memberIds = (members || []).map((m: any) => m.user_id);

    if (memberIds.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const pushTitle = `📢 ${department_name}`;
    const pushBody = announcement_title;

    // Create in-app notifications for all members
    const notifications = memberIds.map((userId: string) => ({
      user_id: userId,
      department_id,
      type: "announcement",
      message: `📢 Novo aviso em ${department_name}: ${announcement_title}`,
      status: "sent",
    }));

    const { error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert(notifications);

    if (insertError) {
      console.error("Error inserting notifications:", insertError);
    }

    // Send push notifications
    await sendPushNotification(memberIds, pushTitle, pushBody, {
      url: "/my-schedules",
    });

    // Send Telegram notifications in parallel
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const telegramMessage = `📢 *Aviso - ${department_name}*\n\n${announcement_title}`;

    const telegramResults = await Promise.allSettled(
      memberIds.map((userId: string) =>
        sendTelegramNotification(supabaseUrl, serviceRoleKey, userId, telegramMessage)
      )
    );

    const telegramSent = telegramResults.filter(
      (r) => r.status === "fulfilled" && r.value === true
    ).length;

    console.log(`Announcement notification sent to ${memberIds.length} members (push), ${telegramSent} via Telegram`);

    return new Response(
      JSON.stringify({ success: true, notified: memberIds.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
