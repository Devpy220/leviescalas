import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyAuthenticationResponse } from "npm:@simplewebauthn/server@13";

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

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { credential, email } = await req.json();
    if (!credential || !email) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: cors });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cleanEmail = email.toLowerCase().trim();

    const { data: ch } = await admin
      .from("webauthn_challenges")
      .select("*")
      .eq("email", cleanEmail)
      .eq("type", "login")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ch) return new Response(JSON.stringify({ error: "Challenge expired" }), { status: 400, headers: cors });

    const { data: dbCred } = await admin
      .from("webauthn_credentials")
      .select("*")
      .eq("credential_id", credential.id)
      .maybeSingle();

    if (!dbCred || dbCred.user_id !== ch.user_id) {
      return new Response(JSON.stringify({ error: "Credential not found" }), { status: 400, headers: cors });
    }

    const origin = req.headers.get("origin") || "";
    const rpId = getRpId(req);

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: ch.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: dbCred.credential_id,
        publicKey: b64ToBytes(dbCred.public_key),
        counter: Number(dbCred.counter),
        transports: dbCred.transports || undefined,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return new Response(JSON.stringify({ error: "Verification failed" }), { status: 400, headers: cors });
    }

    await admin
      .from("webauthn_credentials")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", dbCred.id);

    await admin.from("webauthn_challenges").delete().eq("id", ch.id);

    // Generate a session for the user via magic link, then exchange tokens
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: cleanEmail,
    });

    if (linkErr || !linkData) {
      return new Response(JSON.stringify({ error: "Could not create session" }), { status: 500, headers: cors });
    }

    // Extract token_hash from action_link
    const actionUrl = new URL(linkData.properties.action_link);
    const tokenHash = actionUrl.searchParams.get("token") || linkData.properties.hashed_token;

    // Use anon client to verify the OTP and obtain a session
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: sessionData, error: vErr } = await anon.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash!,
    });

    if (vErr || !sessionData.session) {
      return new Response(JSON.stringify({ error: vErr?.message || "Session creation failed" }), { status: 500, headers: cors });
    }

    return new Response(
      JSON.stringify({
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
        },
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
