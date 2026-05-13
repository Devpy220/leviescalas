import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_URL = "https://leviescalas.com.br";
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

async function runPSI(url: string, strategy: "mobile" | "desktop") {
  const params = new URLSearchParams({ url, strategy });
  CATEGORIES.forEach((c) => params.append("category", c));

  const res = await fetch(
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PSI ${strategy} failed [${res.status}]: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const lh = data.lighthouseResult;
  const cats = lh?.categories ?? {};
  const audits = lh?.audits ?? {};
  return {
    strategy,
    fetchedUrl: lh?.finalUrl ?? url,
    fetchedAt: lh?.fetchTime ?? new Date().toISOString(),
    scores: {
      performance: Math.round((cats.performance?.score ?? 0) * 100),
      accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((cats["best-practices"]?.score ?? 0) * 100),
      seo: Math.round((cats.seo?.score ?? 0) * 100),
    },
    metrics: {
      fcp: audits["first-contentful-paint"]?.displayValue ?? "—",
      lcp: audits["largest-contentful-paint"]?.displayValue ?? "—",
      tbt: audits["total-blocking-time"]?.displayValue ?? "—",
      cls: audits["cumulative-layout-shift"]?.displayValue ?? "—",
      si: audits["speed-index"]?.displayValue ?? "—",
      tti: audits["interactive"]?.displayValue ?? "—",
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = auth.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userErr || !userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { url?: string } = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch {}
    }
    const targetUrl = (body.url && /^https?:\/\//.test(body.url)) ? body.url : DEFAULT_URL;

    const [mobile, desktop] = await Promise.all([
      runPSI(targetUrl, "mobile"),
      runPSI(targetUrl, "desktop"),
    ]);

    return new Response(JSON.stringify({ url: targetUrl, mobile, desktop }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lighthouse-report error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
