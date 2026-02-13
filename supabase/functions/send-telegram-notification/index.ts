import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    if (!botToken) {
      return new Response(
        JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not configured", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { userId, message } = await req.json();

    if (!userId || !message) {
      return new Response(
        JSON.stringify({ error: "Missing userId or message", sent: 0 }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Find active telegram link for user
    const { data: link } = await supabase
      .from("telegram_links")
      .select("chat_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!link) {
      return new Response(
        JSON.stringify({ sent: 0, reason: "no_telegram_link" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send message via Telegram Bot API
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: link.chat_id,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      console.error("Telegram send error:", result);
      return new Response(
        JSON.stringify({ sent: 0, error: result.description }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ sent: 1 }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("send-telegram-notification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", sent: 0 }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
