// Shared authentication helper for cron-triggered edge functions.
// Accepts either a Bearer CRON_SECRET (preferred for pg_cron jobs) or the
// SUPABASE_SERVICE_ROLE_KEY (used by some legacy scheduled jobs). Returns
// a Response when the request is unauthorized; otherwise returns null.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function requireCronAuth(req: Request, corsHeaders: Record<string, string>): Promise<Response | null> {
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : auth.trim();
  const headerSecret = req.headers.get("x-cron-secret") ?? "";

  const allowed = new Set<string>();
  if (cronSecret) allowed.add(cronSecret);
  if (serviceRole) allowed.add(serviceRole);

  if (allowed.size === 0) {
    return new Response(JSON.stringify({ error: "Server misconfigured: no cron secret set" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if ((token && allowed.has(token)) || (headerSecret && allowed.has(headerSecret))) {
    return null;
  }

  const dbSecret = await getDatabaseCronSecret(serviceRole);
  if (dbSecret && ((token && token === dbSecret) || (headerSecret && headerSecret === dbSecret))) {
    return null;
  }

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

let cachedDbSecret: { value: string; expiresAt: number } | null = null;

async function getDatabaseCronSecret(serviceRole: string): Promise<string | null> {
  if (!serviceRole) return null;
  if (cachedDbSecret && cachedDbSecret.expiresAt > Date.now()) return cachedDbSecret.value;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    if (!supabaseUrl) return null;
    const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("app_runtime_secrets")
      .select("secret_value")
      .eq("name", "cron_secret")
      .maybeSingle();

    if (error || !data?.secret_value) return null;
    cachedDbSecret = { value: data.secret_value, expiresAt: Date.now() + 5 * 60 * 1000 };
    return data.secret_value;
  } catch {
    return null;
  }
}
