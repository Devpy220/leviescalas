import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const requestSchema = z.object({
  churchId: z.string().uuid(),
});

type RequestBody = z.infer<typeof requestSchema>;

const sendEmailViaResend = async (to: string, subject: string, html: string) => {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "LEVI <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("Resend error:", data);
    throw new Error("Failed to send email");
  }

  return data;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error("Missing Supabase env vars");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Validate input
    const body = (await req.json().catch(() => null)) as RequestBody | null;
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get authenticated user (verify_jwt default true, but we still read user from token)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userEmail = userData.user.email;
    if (!userEmail) {
      return new Response(JSON.stringify({ error: "User email not found" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Use service role to read church and validate ownership
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: church, error: churchErr } = await serviceClient
      .from("churches")
      .select("id, name, code, leader_id")
      .eq("id", parsed.data.churchId)
      .maybeSingle();

    if (churchErr) throw churchErr;
    if (!church) {
      return new Response(JSON.stringify({ error: "Church not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (church.leader_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const subject = "Código da sua igreja";
    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.6;">
        <h2 style="margin: 0 0 12px;">Seu código da igreja</h2>
        <p style="margin: 0 0 12px;">Igreja: <strong>${church.name}</strong></p>
        <p style="margin: 0 0 8px;">Código:</p>
        <div style="display:inline-block; padding: 14px 18px; border-radius: 12px; border: 1px solid #e5e7eb; background: #f9fafb; font-size: 22px; letter-spacing: 3px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${church.code}</div>
        <p style="margin: 16px 0 0; color: #6b7280; font-size: 12px;">Guarde este código e compartilhe com líderes de departamento.</p>
      </div>
    `;

    const emailRes = await sendEmailViaResend(userEmail, subject, html);

    return new Response(JSON.stringify({ ok: true, email: userEmail, emailRes }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("send-church-code-email error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
