import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendUazapiText } from "../_shared/uazapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function logAttempt(params: {
  phone: string;
  message: string;
  status: string;
  error?: string | null;
  origin?: string | null;
  providerResponse?: unknown;
}) {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const supabase = createClient(url, key);
    await supabase.from("whatsapp_logs").insert({
      phone: params.phone,
      message: params.message,
      status: params.status,
      error: params.error ?? null,
      origin: params.origin ?? null,
      // Column kept as `zapi_response` for backwards-compat — stores the UAZAPI body.
      zapi_response: { provider: "uazapi", ...(params.providerResponse as object ?? {}) },
    });
  } catch (e) {
    console.error("Failed to log whatsapp attempt:", e);
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") || "";
  if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(
      JSON.stringify({ sent: false, error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  let phone = "";
  let message = "";
  let origin: string | null = null;

  try {
    const body = await req.json();
    phone = body.phone;
    message = body.message;
    origin = body.origin ?? req.headers.get("x-origin") ?? null;
    const delayTyping = body.delayTyping;

    if (!phone || !message) {
      await logAttempt({ phone: phone ?? "", message: message ?? "", status: "invalid_input", error: "phone and message are required", origin });
      return new Response(
        JSON.stringify({ sent: false, error: "phone and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const cleanNumber = phone.replace(/\D/g, "");
    if (cleanNumber.length < 10) {
      await logAttempt({ phone, message, status: "invalid_phone", error: "Invalid phone number", origin });
      return new Response(
        JSON.stringify({ sent: false, error: "Invalid phone number" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const fullNumber = cleanNumber.startsWith("55") ? cleanNumber : `55${cleanNumber}`;
    const typing = typeof delayTyping === "number" ? delayTyping : undefined;

    const result = await sendUazapiText(fullNumber, message, typing);

    if (result.ok) {
      console.log(`WhatsApp sent (UAZAPI) to ${fullNumber}`);
      await logAttempt({ phone: fullNumber, message, status: "sent", origin, providerResponse: result.response });
      return new Response(
        JSON.stringify({ sent: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (result.error === "uazapi_not_configured") {
      await logAttempt({ phone: fullNumber, message, status: "config_error", error: "UAZAPI not configured", origin });
      return new Response(
        JSON.stringify({ sent: false, error: "UAZAPI not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const errText = typeof result.response === "string" ? result.response : JSON.stringify(result.response ?? result.error);
    console.error(`WhatsApp error (UAZAPI) for ${fullNumber}:`, errText);
    await logAttempt({ phone: fullNumber, message, status: "failed", error: errText, origin, providerResponse: result.response });
    return new Response(
      JSON.stringify({ sent: false, error: errText }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-whatsapp-notification error:", error);
    await logAttempt({ phone, message, status: "exception", error: msg, origin });
    return new Response(
      JSON.stringify({ sent: false, error: msg }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
