import { createClient } from "npm:@supabase/supabase-js@2";
import { generateRegistrationOptions } from "npm:@simplewebauthn/server@13";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RP_NAME = "LEVI Escalas";

function getRpId(req: Request): string {
  const origin = req.headers.get("origin") || "";
  try {
    const u = new URL(origin);
    return u.hostname;
  } catch {
    return "leviescalas.com.br";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    const user = userData.user;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: existing } = await admin
      .from("webauthn_credentials")
      .select("credential_id, transports")
      .eq("user_id", user.id);

    const rpId = getRpId(req);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rpId,
      userID: new TextEncoder().encode(user.id),
      userName: user.email || user.id,
      userDisplayName: user.email || "Usuário LEVI",
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
      excludeCredentials: (existing || []).map((c: any) => ({
        id: c.credential_id,
        transports: c.transports || undefined,
      })),
    });

    await admin.from("webauthn_challenges").insert({
      challenge: options.challenge,
      user_id: user.id,
      type: "register",
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
