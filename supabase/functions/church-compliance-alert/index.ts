// Internal-only: when a church outside Brazil registers, ask AI for a data-protection
// summary of that country and WhatsApp it to the ELS Digital team number set in
// admin_settings (key: compliance_alert_phone). Never sent to the church.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendUazapiText } from "../_shared/uazapi.ts";

const MODEL = "openai/gpt-6-astra";

// Only PT / ES / EN exist in LEVI — anything else falls back to English.
function reportLanguage(country: string): "pt" | "es" | "en" {
  const c = country.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const pt = ["portugal", "angola", "mocambique", "mozambique", "cabo verde", "guine-bissau", "sao tome"];
  const es = ["espanha", "espana", "spain", "mexico", "argentina", "chile", "colombia", "peru", "venezuela", "uruguai", "uruguay", "paraguai", "paraguay", "bolivia", "equador", "ecuador", "panama", "costa rica", "guatemala", "honduras", "nicaragua", "el salvador", "cuba", "republica dominicana", "porto rico", "puerto rico"];
  if (pt.some((p) => c.includes(p))) return "pt";
  if (es.some((p) => c.includes(p))) return "es";
  return "en";
}

const TEXT = {
  pt: { lang: "Portuguese", title: "Nova igreja fora do Brasil", church: "Igreja", country: "País", disclaimer: "Levantamento gerado por IA, caráter informativo — requer confirmação jurídica antes de qualquer alteração" },
  es: { lang: "Spanish", title: "Nueva iglesia fuera de Brasil", church: "Iglesia", country: "País", disclaimer: "Levantamiento generado por IA, de carácter informativo — requiere confirmación jurídica antes de cualquier cambio" },
  en: { lang: "English", title: "New church outside Brazil", church: "Church", country: "Country", disclaimer: "AI-generated survey, for information only — requires legal confirmation before any change" },
};

async function askAI(country: string, langName: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const prompt = `Country: ${country}. Write in ${langName}. Plain text only, no markdown, no asterisks, no bullet symbols other than "-". Max ~350 words. Cover:
1) Main data protection laws of this country (LGPD equivalent, if any).
2) Specific laws on children's/minors' data protection (relevant to a church kids check-in module).
3) Parental consent requirements, minimum age of use, data retention and deletion rules.
4) Objective list of what a church volunteer scheduling app (LEVI, stores names, phones, emails, WhatsApp messaging, children's data) would need to adjust for this country.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
    }),
  });
  if (!res.ok || !res.body) throw new Error(`ai_http_${res.status}: ${(await res.text()).slice(0, 300)}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
        if (ev.type === "response.failed" || ev.type === "error") throw new Error(ev.error?.message ?? "ai_failed");
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  out = out.replace(/[*_#`]/g, "").trim();
  if (!out) throw new Error("ai_empty_response");
  return out;
}

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const { churchId, churchName, country } = await req.json().catch(() => ({}));
  if (!churchName || !country) return new Response(JSON.stringify({ error: "invalid" }), { status: 400 });

  const log = (status: string, error?: string) =>
    supabase.from("compliance_alert_logs").insert({ church_id: churchId ?? null, church_name: churchName, country, status, error: error ?? null });

  try {
    const { data: setting } = await supabase.from("admin_settings").select("value").eq("key", "compliance_alert_phone").maybeSingle();
    const phone = setting?.value?.trim();
    if (!phone) { await log("no_destination", "Número de destino não configurado"); return new Response(JSON.stringify({ ok: false })); }

    const lang = reportLanguage(country);
    const t = TEXT[lang];
    const summary = await askAI(country, t.lang);
    const message = `LEVI - ${t.title}\n\n${t.church}: ${churchName}\n${t.country}: ${country}\n\n${summary}\n\n${t.disclaimer}`;

    const r = await sendUazapiText(phone, message, 2);
    await log(r.ok ? "sent" : "failed", r.ok ? undefined : (r.error ?? JSON.stringify(r.response)).slice(0, 500));
    return new Response(JSON.stringify({ ok: r.ok }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("church-compliance-alert", msg);
    await log("failed", msg.slice(0, 500));
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
  }
});
