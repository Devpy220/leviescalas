import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate ECDSA P-256 keys directly with Web Crypto API
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true, // extractable
      ["sign", "verify"]
    );

    const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

    // Get raw public key for base64url (frontend use)
    const rawPublicKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const base64url = btoa(String.fromCharCode(...new Uint8Array(rawPublicKey)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    return new Response(
      JSON.stringify({
        VAPID_PUBLIC_KEY_secret: JSON.stringify(publicKeyJwk),
        VAPID_PRIVATE_KEY_secret: JSON.stringify(privateKeyJwk),
        frontend_vapid_public_key: base64url,
      }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
