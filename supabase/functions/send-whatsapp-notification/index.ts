import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const token = Deno.env.get("ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!instanceId || !token || !clientToken) {
      console.error("Z-API credentials not configured");
      return new Response(
        JSON.stringify({ sent: false, error: "Z-API not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { phone, message } = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ sent: false, error: "phone and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Clean number: remove non-digits, ensure 55 prefix
    const cleanNumber = phone.replace(/\D/g, "");
    if (cleanNumber.length < 10) {
      return new Response(
        JSON.stringify({ sent: false, error: "Invalid phone number" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const fullNumber = cleanNumber.startsWith("55") ? cleanNumber : `55${cleanNumber}`;

    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify({
        phone: fullNumber,
        message,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`WhatsApp sent to ${fullNumber}:`, data);
      return new Response(
        JSON.stringify({ sent: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else {
      const errText = await res.text();
      console.error(`WhatsApp error for ${fullNumber}:`, errText);
      return new Response(
        JSON.stringify({ sent: false, error: errText }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error) {
    console.error("send-whatsapp-notification error:", error);
    return new Response(
      JSON.stringify({ sent: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
