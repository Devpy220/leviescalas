import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  generateVapidKeys,
  exportVapidKeys,
} from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate new VAPID key pair
    const keys = await generateVapidKeys({ extractable: true });

    // Export as JWK for storage
    const privateJwk = await crypto.subtle.exportKey("jwk", keys.privateKey);
    const publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);

    // Also export as raw for the frontend applicationServerKey
    const publicRaw = await crypto.subtle.exportKey("raw", keys.publicKey);
    const publicBase64Url = btoa(String.fromCharCode(...new Uint8Array(publicRaw)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    return new Response(
      JSON.stringify({
        message: "New VAPID keys generated. Save these as secrets!",
        VAPID_PUBLIC_KEY_BASE64URL: publicBase64Url,
        VAPID_PUBLIC_KEY_JWK: JSON.stringify(publicJwk),
        VAPID_PRIVATE_KEY_JWK: JSON.stringify(privateJwk),
        instructions: [
          "1. Add secret VAPID_PUBLIC_KEY with the VAPID_PUBLIC_KEY_JWK value",
          "2. Add secret VAPID_PRIVATE_KEY with the VAPID_PRIVATE_KEY_JWK value",
          "3. Update the VAPID_PUBLIC_KEY in frontend code (usePushNotifications.tsx) with VAPID_PUBLIC_KEY_BASE64URL",
          "4. Delete this generate-vapid-keys function after setup"
        ]
      }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
