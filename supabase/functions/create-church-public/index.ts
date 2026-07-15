import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const schema = z.object({
  registrantName: z.string().trim().min(2).max(100),
  registrantEmail: z.string().trim().email(),
  registrantPhone: z.string().trim().min(10).max(20),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  phone: z.string().trim().min(10).max(20),
  cnpj: z.string().trim().optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(50).optional().nullable(),
  product: z.enum(["levi", "kids", "both"]).optional().default("levi"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    const d = parsed.data;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Generate code
    const { data: codeData, error: codeErr } = await supabase.rpc("generate_church_code");
    if (codeErr) throw codeErr;

    const { data: church, error: insertErr } = await supabase
      .from("churches")
      .insert({
        name: d.name,
        email: d.email,
        phone: d.phone,
        cnpj: d.cnpj || null,
        description: d.description || null,
        address: d.address || null,
        city: d.city || null,
        state: d.state || null,
        registrant_name: d.registrantName,
        registrant_email: d.registrantEmail,
        registrant_phone: d.registrantPhone,
        code: codeData,
        leader_id: null,
      })
      .select("id, name, code, slug")
      .single();

    if (insertErr) {
      console.error("create-church-public insert error:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const origin = req.headers.get("origin") || "https://leviescalas.com.br";
    const createDeptUrl = `${origin}/auth?tab=register&churchCode=${church.code}&redirect=${encodeURIComponent(`/departments/new?churchCode=${church.code}`)}`;
    const churchPageUrl = church.slug ? `${origin}/igreja/${church.slug}` : null;

    // Send WhatsApp via UAZAPI
    let whatsappSent = false;
    let whatsappError: string | null = null;
    try {
      const { sendUazapiText } = await import("../_shared/uazapi.ts");
      const message =
        `🎉 *LEVI* — Igreja *${church.name}* cadastrada com sucesso!\n\n` +
        `Próximo passo: crie uma conta e os departamentos/ministérios da sua igreja usando o link abaixo:\n\n` +
        `👉 ${createDeptUrl}\n\n` +
        (churchPageUrl ? `Página pública: ${churchPageUrl}\n\n` : "") +
        `⚠️ Igrejas sem departamentos em até 5 dias são removidas automaticamente.`;
      const r = await sendUazapiText(String(d.registrantPhone), message, 2);
      if (r.ok) {
        whatsappSent = true;
      } else {
        whatsappError = r.error ?? (typeof r.response === "string" ? r.response : JSON.stringify(r.response));
      }
    } catch (e: any) {
      whatsappError = e?.message || "unknown";
    }

    return new Response(
      JSON.stringify({
        ok: true,
        church: { id: church.id, name: church.name, code: church.code, slug: church.slug },
        createDeptUrl,
        churchPageUrl,
        whatsappSent,
        whatsappError,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (e: any) {
    console.error("create-church-public error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
