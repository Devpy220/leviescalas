import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const baseUrl = (Deno.env.get("UAZAPI_BASE_URL") || "").replace(/\/+$/, "");
  const token = Deno.env.get("UAZAPI_TOKEN") || "";
  const instanceToken = Deno.env.get("UAZAPI_INSTANCE_TOKEN") || "";

  const probe = async (url: string, tk: string) => {
    try {
      const res = await fetch(url, { headers: { token: tk } });
      const body = await res.text();
      return { status: res.status, body: body.slice(0, 400) };
    } catch (e) {
      return { status: 0, body: e instanceof Error ? e.message : "error" };
    }
  };

  return new Response(
    JSON.stringify({
      baseUrl,
      tokenLen: token.length,
      instanceTokenLen: instanceToken.length,
      statusWithToken: await probe(`${baseUrl}/instance/status`, token),
      statusWithInstanceToken: instanceToken ? await probe(`${baseUrl}/instance/status`, instanceToken) : null,
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
});
