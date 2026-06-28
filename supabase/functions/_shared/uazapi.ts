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

function normalizeNumber(raw: string): string {
  const clean = (raw || "").replace(/\D/g, "");
  if (clean.length < 10) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
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
