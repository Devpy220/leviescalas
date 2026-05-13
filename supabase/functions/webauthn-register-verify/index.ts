import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyRegistrationResponse } from "npm:@simplewebauthn/server@13";

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
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    const body = await req.json();
    const { credential, deviceName } = body;
    if (!credential) return new Response(JSON.stringify({ error: "Missing credential" }), { status: 400, headers: cors });

    const user = userData.user;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: ch } = await admin
      .from("webauthn_challenges")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", "register")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ch) return new Response(JSON.stringify({ error: "Challenge not found or expired" }), { status: 400, headers: cors });

    const origin = req.headers.get("origin") || "";
    const rpId = getRpId(req);

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: ch.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return new Response(JSON.stringify({ error: "Verification failed" }), { status: 400, headers: cors });
    }

    const info: any = verification.registrationInfo;
    const cred = info.credential || info;
    const credentialId: string = cred.id;
    const publicKeyBytes: Uint8Array = cred.publicKey;
    const counter: number = cred.counter ?? 0;

    const publicKey = btoa(String.fromCharCode(...publicKeyBytes));

    await admin.from("webauthn_credentials").insert({
      user_id: user.id,
      credential_id: credentialId,
      public_key: publicKey,
      counter,
      transports: credential.response?.transports || [],
      device_name: deviceName || "Dispositivo",
    });

    await admin.from("webauthn_challenges").delete().eq("id", ch.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
