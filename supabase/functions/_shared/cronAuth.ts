// Shared authentication helper for cron-triggered edge functions.
// Accepts either a Bearer CRON_SECRET (preferred for pg_cron jobs) or the
// SUPABASE_SERVICE_ROLE_KEY (used by some legacy scheduled jobs). Returns
// a Response when the request is unauthorized; otherwise returns null.
export function requireCronAuth(req: Request, corsHeaders: Record<string, string>): Response | null {
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

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
