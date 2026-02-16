import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const pubKey = Deno.env.get("VAPID_PUBLIC_KEY") || "NOT SET";
  const privKey = Deno.env.get("VAPID_PRIVATE_KEY") || "NOT SET";

  return new Response(
    JSON.stringify({
      public_key_first_30: pubKey.substring(0, 30),
      public_key_last_10: pubKey.substring(pubKey.length - 10),
      public_key_length: pubKey.length,
      private_key_first_30: privKey.substring(0, 30),
      private_key_length: privKey.length,
      public_starts_with_brace: pubKey.startsWith("{"),
      private_starts_with_brace: privKey.startsWith("{"),
    }, null, 2),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
