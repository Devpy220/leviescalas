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

// Country codes we can safely detect when a number already carries one.
// (Brazil + Portugal + common destinations for church members abroad.)
const KNOWN_COUNTRY_CODES = [
  "351", "244", "258", "238", "239", "245", "670", // PT-speaking
  "1", "44", "33", "34", "39", "49", "41", "31", "32", "353", "352",
  "54", "56", "57", "58", "51", "52", "591", "595", "598", "593", "507",
  "61", "64", "81", "82", "86", "91", "27", "972", "351",
];

/**
 * Normalize a phone number to international digits (no "+").
 *
 * - Numbers already carrying a country code (typed with "+", "00" or a
 *   recognized prefix) are kept as-is — this allows Portugal (+351) and any
 *   other country.
 * - Bare 10/11-digit numbers are treated as Brazilian (legacy stored format)
 *   and get the "55" prefix, with the mobile "9" inserted when missing.
 */
export function normalizeNumber(raw: string): string {
  let clean = (raw || "").replace(/\D/g, "");
  const explicitIntl = /^\s*\+/.test(raw || "") || clean.startsWith("00");
  if (clean.startsWith("00")) clean = clean.slice(2);
  if (!clean) return "";

  // Brazil
  if (clean.startsWith("55") && clean.length >= 12 && clean.length <= 13) {
    let br = clean.slice(2);
    if (br.length === 10 && /[6-9]/.test(br[2])) br = br.slice(0, 2) + "9" + br.slice(2);
    return `55${br}`;
  }

  // Already international (explicit "+"/"00" or a recognized country prefix)
  if (explicitIntl || KNOWN_COUNTRY_CODES.some((c) => clean.startsWith(c) && clean.length >= c.length + 7)) {
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
      body: JSON.stringify({ number, text, delay }),
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
