import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { importVapidKeys } from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const vapidX = Deno.env.get("VAPID_X") || "NOT SET";
  const vapidY = Deno.env.get("VAPID_Y") || "NOT SET";
  const vapidD = Deno.env.get("VAPID_D") || "NOT SET";

  let importResult = "not tested";
  try {
    const publicJwk = { kty: "EC", crv: "P-256", x: vapidX, y: vapidY };
    const privateJwk = { kty: "EC", crv: "P-256", x: vapidX, y: vapidY, d: vapidD };
    await importVapidKeys({ privateKey: privateJwk, publicKey: publicJwk });
    importResult = "SUCCESS";
  } catch (e) {
    importResult = "FAILED: " + e.message;
  }

  return new Response(
    JSON.stringify({ vapid_x: vapidX, vapid_y: vapidY, vapid_d_length: vapidD.length, import_result: importResult }, null, 2),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});