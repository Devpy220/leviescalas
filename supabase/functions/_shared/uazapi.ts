// Shared helper for sending WhatsApp messages via UAZAPI.
// Replaces the legacy Z-API integration. Other code paths should call this
// instead of fetching api.z-api.io directly.
//
// Env vars required:
//   UAZAPI_BASE_URL  — e.g. https://free.uazapi.com  (no trailing slash)
//   UAZAPI_TOKEN     — instance token from the UAZAPI dashboard

export interface UazapiSendResult {
  ok: boolean;
  status: number;
  response: unknown;
  error?: string | null;
}

/**
 * Normalize a phone number to international digits (no "+").
 *
 * - Numbers typed with "+" / "00", or longer than a Brazilian local number,
 *   are treated as already carrying a country code — so Portugal (+351) and
 *   any other country work normally.
 * - Bare 10/11-digit numbers are treated as Brazilian (legacy stored format)
 *   and get the "55" prefix, with the mobile "9" inserted when missing.
 */
export function normalizeNumber(raw: string): string {
  let clean = (raw || "").replace(/\D/g, "");
  const explicitIntl = /^\s*\+/.test(raw || "") || clean.startsWith("00");
  if (clean.startsWith("00")) clean = clean.slice(2);
  if (!clean) return "";

  // Brazil with country code (12-13 digits)
  if (clean.startsWith("55") && clean.length >= 12 && clean.length <= 13) {
    let br = clean.slice(2);
    if (br.length === 10 && /[6-9]/.test(br[2])) br = br.slice(0, 2) + "9" + br.slice(2);
    return `55${br}`;
  }

  // Explicit international, or too long to be a bare Brazilian number
  if (explicitIntl || clean.length >= 12) {
    return clean.length >= 8 ? clean : "";
  }

  // Bare local number → assume Brazil
  if (clean.length === 10 && /[6-9]/.test(clean[2])) {
    clean = clean.slice(0, 2) + "9" + clean.slice(2);
  }
  if (clean.length < 10) return "";
  return `55${clean}`;
}



/**
 * Send a plain text WhatsApp message via UAZAPI.
 *
 * @param phone        Raw phone (any format) — will be normalized to E.164 digits.
 * @param text         Message body.
 * @param delaySeconds Optional humanized "typing" delay in seconds (1-15). Mapped to
 *                     UAZAPI's `delay` field (in milliseconds). Default: 3-8s random.
 */
export async function sendUazapiText(
  phone: string,
  text: string,
  delaySeconds?: number,
): Promise<UazapiSendResult> {
  const baseUrl = (Deno.env.get("UAZAPI_BASE_URL") || "").replace(/\/+$/, "");
  const token = Deno.env.get("UAZAPI_TOKEN");

  if (!baseUrl || !token) {
    return { ok: false, status: 0, response: null, error: "uazapi_not_configured" };
  }

  const number = normalizeNumber(phone);
  if (!number) {
    return { ok: false, status: 0, response: null, error: "invalid_phone" };
  }

  const finalText = await translateForCountry(number, text);

  const delay =
    typeof delaySeconds === "number"
      ? Math.max(0, Math.min(15, Math.floor(delaySeconds))) * 1000
      : (Math.floor(Math.random() * 6) + 3) * 1000;

  try {
    const res = await fetch(`${baseUrl}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token, // UAZAPI uses a raw `token` header (not Bearer)
      },
      body: JSON.stringify({ number, text: finalText, delay }),
    });

    const body = await res.json().catch(async () => ({ raw: await res.text().catch(() => "") }));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        response: body,
        error: typeof body === "object" && body && "error" in body ? String((body as any).error) : `http_${res.status}`,
      };
    }
    return { ok: true, status: res.status, response: body };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      response: null,
      error: e instanceof Error ? e.message : "fetch_error",
    };
  }
}

export function getNormalizedNumber(phone: string): string {
  return normalizeNumber(phone);
}

// ─── Automatic localization: every WhatsApp message goes out in the language
// of the recipient's country (by dial code). Brazil = original text. ───
const COUNTRY_LANG: Array<[string, string]> = [
  ["351", "European Portuguese (Portugal)"], ["244", "European Portuguese (Angola)"], ["258", "European Portuguese (Mozambique)"],
  ["238", "European Portuguese"], ["245", "European Portuguese"], ["239", "European Portuguese"],
  ["502", "Spanish"], ["503", "Spanish"], ["504", "Spanish"], ["505", "Spanish"], ["506", "Spanish"], ["507", "Spanish (Panama)"],
  ["591", "Spanish"], ["593", "Spanish"], ["595", "Spanish"], ["598", "Spanish"], ["240", "Spanish"],
  ["34", "Spanish (Spain)"], ["52", "Spanish (Mexico)"], ["54", "Spanish (Argentina)"], ["56", "Spanish"], ["57", "Spanish"],
  ["51", "Spanish"], ["58", "Spanish"], ["53", "Spanish"],
  ["33", "French"], ["32", "French"], ["41", "French"], ["39", "Italian"], ["49", "German"], ["43", "German"],
  ["31", "Dutch"], ["81", "Japanese"], ["82", "Korean"], ["86", "Simplified Chinese"], ["7", "Russian"],
  ["380", "Ukrainian"], ["48", "Polish"], ["40", "Romanian"], ["30", "Greek"], ["90", "Turkish"], ["972", "Hebrew"],
];

export function languageForNumber(number: string): string | null {
  const d = (number || "").replace(/\D/g, "");
  if (d.startsWith("55")) return null; // Brazil: keep original PT-BR
  for (const len of [3, 2, 1]) {
    const hit = COUNTRY_LANG.find(([p]) => p.length === len && d.startsWith(p));
    if (hit) return hit[1];
  }
  return "English";
}

const translationCache = new Map<string, string>();

export async function translateForCountry(number: string, text: string): Promise<string> {
  const lang = languageForNumber(number);
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!lang || !key || !text.trim()) return text;
  const cacheKey = `${lang}::${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: `Translate the WhatsApp message into ${lang}. Output ONLY the translated message. Keep all WhatsApp formatting (*bold*, _italic_), emojis, line breaks, URLs, names, dates, times and numbers exactly. NEVER translate the brand LEVI nor these reply keywords, keep them in uppercase exactly as written: SAIR, VOLTAR, SIM, NAO, NÃO, ESCALAS, AJUDA, TROCA, BLOQUEAR, DESBLOQUEAR, BLOQUEIOS, APOIAR, ESCALA TODOS, CONFIRMAR, RECUSAR.` },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) { console.error("translate failed", res.status, await res.text()); return text; }
    const j = await res.json();
    const out = String(j?.choices?.[0]?.message?.content ?? "").trim();
    if (!out) return text;
    if (translationCache.size > 500) translationCache.clear();
    translationCache.set(cacheKey, out);
    return out;
  } catch (e) {
    console.error("translate error", e);
    return text;
  }
}
