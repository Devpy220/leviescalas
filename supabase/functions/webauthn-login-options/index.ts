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

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Nenhuma biometria cadastrada" }), { status: 404, headers: cors });
    }

    const { data: creds } = await admin
      .from("webauthn_credentials")
      .select("credential_id, transports")
      .eq("user_id", profile.id);

    if (!creds || creds.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma biometria cadastrada" }), { status: 404, headers: cors });
    }

    const rpId = getRpId(req);
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: "preferred",
      allowCredentials: creds.map((c: any) => ({
        id: c.credential_id,
        transports: c.transports || undefined,
      })),
    });

    await admin.from("webauthn_challenges").insert({
      challenge: options.challenge,
      email: email.toLowerCase().trim(),
      user_id: profile.id,
      type: "login",
    });

    return new Response(JSON.stringify(options), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
