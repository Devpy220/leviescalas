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
    throw new Error(`Failed to send email: ${JSON.stringify(data)}`);
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
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json().catch(() => null));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Authenticate the caller
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

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Allow the church creator (leader_id) OR admin to send the email
    const { data: church, error: churchErr } = await serviceClient
      .from("churches")
      .select("id, name, code, email, slug, leader_id")
      .eq("id", parsed.data.churchId)
      .maybeSingle();

    if (churchErr) throw churchErr;
    if (!church) {
      return new Response(JSON.stringify({ error: "Church not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check: must be the church creator or an admin
    const isCreator = church.leader_id === userData.user.id;
    const { data: isAdmin } = await serviceClient
      .rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });

    if (!isCreator && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!church.email) {
      return new Response(JSON.stringify({ error: "Church email not configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const baseUrl = req.headers.get("origin") || "https://leviescalas.lovable.app";
    const createDeptUrl = `${baseUrl}/departments/new?churchCode=${church.code}`;
    const churchPageUrl = church.slug ? `${baseUrl}/igreja/${church.slug}` : null;

    const subject = `LEVI - Crie os departamentos da ${church.name}`;
    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="margin: 0; color: #6366f1; font-size: 28px;">LEVI</h1>
          <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">Logística de Escalas para Voluntários da Igreja</p>
        </div>
        
        <h2 style="margin: 0 0 16px; color: #111827;">Bem-vindo ao LEVI!</h2>
        
        <p style="margin: 0 0 16px; color: #374151;">
          A igreja <strong>${church.name}</strong> foi cadastrada com sucesso no sistema LEVI.
        </p>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px; color: #166534; font-size: 16px;">📋 Próximo passo: Criar Departamentos</h3>
          <p style="margin: 0; color: #15803d; font-size: 14px;">
            Use o link abaixo para criar os departamentos/ministérios da sua igreja (Louvor, Mídia, Recepção, etc.).
          </p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${createDeptUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Criar Departamentos
          </a>
        </div>
        
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px; color: #111827; font-size: 16px;">Como funciona:</h3>
          <ol style="margin: 0; padding-left: 20px; color: #4b5563;">
            <li style="margin-bottom: 8px;">Clique no link acima para criar seus departamentos/ministérios</li>
            <li style="margin-bottom: 8px;">Dentro de cada departamento, você receberá um <strong>link de convite</strong></li>
            <li style="margin-bottom: 8px;">Compartilhe o link de convite com os voluntários do departamento</li>
            <li>Comece a criar escalas!</li>
          </ol>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e; font-size: 13px;">
            ⚠️ <strong>Importante:</strong> Se nenhum departamento for criado em até 5 dias, a igreja será removida automaticamente do sistema.
          </p>
        </div>

        ${churchPageUrl ? `
        <p style="margin: 16px 0; color: #6b7280; font-size: 14px; text-align: center;">
          Página pública da igreja: <a href="${churchPageUrl}" style="color: #6366f1;">${churchPageUrl}</a>
        </p>
        ` : ''}
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        
        <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
          Dúvidas? Entre em contato: <a href="mailto:elsdigital@elsdigital.tech" style="color: #6366f1;">elsdigital@elsdigital.tech</a>
        </p>
      </div>
    `;

    const emailRes = await sendEmailViaResend(church.email, subject, html);

    return new Response(JSON.stringify({ ok: true, email: church.email, emailRes }), {
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
