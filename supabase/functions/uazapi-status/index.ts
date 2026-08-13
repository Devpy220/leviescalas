import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const baseUrl = (Deno.env.get("UAZAPI_BASE_URL") || "").replace(/\/+$/, "");
  const token = (Deno.env.get("UAZAPI_TOKEN") || "").trim();

  const probe = async (label: string, url: string, headers: Record<string, string>) => {
    try {
      const res = await fetch(url, { headers });
      const body = await res.text();
      return { label, status: res.status, body: body.slice(0, 300) };
    } catch (e) {
      return { label, status: 0, body: e instanceof Error ? e.message : "error" };
    }
  };

  const results = await Promise.all([
    probe("status/token", `${baseUrl}/instance/status`, { token }),
    probe("status/admintoken", `${baseUrl}/instance/status`, { admintoken: token }),
    probe("status/bearer", `${baseUrl}/instance/status`, { Authorization: `Bearer ${token}` }),
    probe("instance/all", `${baseUrl}/instance/all`, { admintoken: token }),
  ]);

  return new Response(
    JSON.stringify({ baseUrl, tokenLen: token.length, tokenPrefix: token.slice(0, 4), results }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
});
