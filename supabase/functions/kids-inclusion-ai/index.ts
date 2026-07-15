// LeviKids — assistente de inclusão via Lovable AI Gateway
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  child_name?: string;
  age?: number;
  allergies?: string;
  restrictions?: string;
  notes?: string;
  focus?: string; // ex: "autismo", "TDAH", "cadeirante"
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    const perfil = [
      body.child_name ? `Nome: ${body.child_name}` : null,
      typeof body.age === "number" ? `Idade: ${body.age} anos` : null,
      body.focus ? `Necessidade principal: ${body.focus}` : null,
      body.allergies ? `Alergias: ${body.allergies}` : null,
      body.restrictions ? `Restrições: ${body.restrictions}` : null,
      body.notes ? `Observações do responsável: ${body.notes}` : null,
    ].filter(Boolean).join("\n");

    if (!perfil) {
      return new Response(JSON.stringify({ error: "Informe pelo menos uma característica da criança" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `Você é um especialista em ministério infantil inclusivo em igrejas cristãs no Brasil.
Você orienta professores voluntários (não profissionais de saúde) a acolher crianças com necessidades específicas
(autismo, TDAH, síndrome de Down, deficiência motora, deficiência sensorial, etc.) durante o culto infantil.
Suas sugestões devem ser:
- Práticas, aplicáveis por um voluntário sem formação técnica
- Curtas, acolhedoras, com linguagem simples em português do Brasil
- Baseadas em rotina de igreja (louvor, história bíblica, versículo, atividade manual, lanche, oração)
- Sensíveis à dignidade da criança e da família
- SEM diagnósticos médicos, medicações ou promessas terapêuticas`;

    const prompt = `Perfil da criança:\n${perfil}\n\nGere de 4 a 6 sugestões práticas para o professor da sala de inclusão trabalhar com esta criança HOJE, durante o culto. Formato: lista com marcadores em Markdown. Cada item começa com um emoji apropriado e um título curto em negrito, seguido de 1-2 frases explicando como aplicar.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Falha na IA", details: text }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ suggestions: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
