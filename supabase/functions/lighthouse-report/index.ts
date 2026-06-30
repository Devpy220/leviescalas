import { createClient } from "npm:@supabase/supabase-js@2.57.2";

function getUserIdFromJwt(authHeader: string | null): { token: string; userId: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    const claims = JSON.parse(atob(padded));
    const userId = typeof claims.sub === "string" ? claims.sub : "";
    const exp = typeof claims.exp === "number" ? claims.exp : 0;
    if (!userId || !exp || exp <= Math.floor(Date.now() / 1000)) return null;
    return { token, userId };
  } catch {
    return null;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_URL = "https://leviescalas.com.br";
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

async function runPSI(url: string, strategy: "mobile" | "desktop") {
  const apiKey = Deno.env.get("PAGESPEED_API_KEY")?.trim();
  const makeRequest = (includeKey: boolean) => {
    const params = new URLSearchParams({ url, strategy });
    CATEGORIES.forEach((c) => params.append("category", c));
    if (includeKey && apiKey) params.append("key", apiKey);

    return fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
    );
  };

  let res = await makeRequest(Boolean(apiKey));
  if (!res.ok && apiKey && res.status === 400) {
    const text = await res.clone().text();
    if (text.includes("API key not valid")) {
      console.warn(`PAGESPEED_API_KEY rejected for ${strategy}; retrying without key`);
      res = await makeRequest(false);
    }
  }
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authInfo = getUserIdFromJwt(req.headers.get("Authorization"));
    if (!authInfo) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userSupabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${authInfo.token}` } },
    });
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: isAdmin, error: roleError } = await userSupabase.rpc("has_role", {
      _user_id: authInfo.userId,
      _role: "admin",
    });
    if (roleError) {
      console.error("[lighthouse-report] role check failed:", roleError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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

    const [mobileRes, desktopRes] = await Promise.allSettled([
      runPSI(targetUrl, "mobile"),
      runPSI(targetUrl, "desktop"),
    ]);

    const pickError = (r: PromiseRejectedResult) => {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      const isQuota = /\[429\]|Quota exceeded/i.test(msg);
      return { error: isQuota ? "QUOTA_EXCEEDED" : "SERVICE_UNAVAILABLE", message: msg.slice(0, 200), fallback: true };
    };

    const mobile = mobileRes.status === "fulfilled" ? mobileRes.value : pickError(mobileRes);
    const desktop = desktopRes.status === "fulfilled" ? desktopRes.value : pickError(desktopRes);
    const allFailed = mobileRes.status === "rejected" && desktopRes.status === "rejected";

    return new Response(JSON.stringify({ url: targetUrl, mobile, desktop, fallback: allFailed }), {
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
