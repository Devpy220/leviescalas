import { createClient } from "npm:@supabase/supabase-js@2";
import { generateAuthenticationOptions } from "npm:@simplewebauthn/server@13";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getRpId(req: Request): string {
  const origin = req.headers.get("origin") || "";
  try {
    return new URL(origin).hostname;
  } catch {
    return "leviescalas.com.br";
  }
}

// Deterministic fake credential for unknown emails, so the answer looks the
// same whether or not the account exists or has biometrics.
async function fakeCredentialId(email: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "levi"),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("webauthn:" + email)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email required" }), { status: 400, headers: cors });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cleanEmail = email.toLowerCase().trim();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    const { data: creds } = profile
      ? await admin.from("webauthn_credentials").select("credential_id, transports").eq("user_id", profile.id)
      : { data: [] as any[] };

    const hasCreds = !!profile && !!creds && creds.length > 0;
    const allowCredentials = hasCreds
      ? creds!.map((c: any) => ({ id: c.credential_id, transports: c.transports || undefined }))
      : [{ id: await fakeCredentialId(cleanEmail), transports: ["internal", "hybrid"] as any }];

    const options = await generateAuthenticationOptions({
      rpID: getRpId(req),
      userVerification: "preferred",
      allowCredentials,
    });

    if (hasCreds) {
      await admin.from("webauthn_challenges").insert({
        challenge: options.challenge,
        email: cleanEmail,
        user_id: profile!.id,
        type: "login",
      });
    }

    return new Response(JSON.stringify(options), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webauthn-login-options error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
