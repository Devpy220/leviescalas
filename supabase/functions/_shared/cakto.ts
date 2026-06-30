// Shared Cakto Pay client (OAuth2 client_credentials)
// API reference: https://api.cakto.com.br

const CAKTO_BASE_URL = Deno.env.get("CAKTO_BASE_URL") || "https://api.cakto.com.br";

interface TokenCache {
  token: string;
  expiresAt: number;
}
let _tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("CAKTO_CLIENT_ID");
  const clientSecret = Deno.env.get("CAKTO_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Missing CAKTO_CLIENT_ID/CAKTO_CLIENT_SECRET");

  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 30_000) {
    return _tokenCache.token;
  }

  const res = await fetch(`${CAKTO_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Cakto token error ${res.status}: ${txt}`);
  }
  const json = await res.json();
  const token = json.access_token as string;
  const expiresIn = (json.expires_in as number) ?? 3600;
  _tokenCache = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

export async function caktoFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${CAKTO_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok) {
    throw new Error(`Cakto ${path} ${res.status}: ${text}`);
  }
  return json as T;
}

export interface CreateCheckoutInput {
  mode: "one_time" | "subscription";
  amountCents: number;
  paymentMethod: "pix" | "credit_card";
  successUrl: string;
  cancelUrl: string;
  donor?: { name?: string; email?: string; whatsapp?: string };
  reference?: string;
  productId?: string;
}

export async function createCaktoCheckout(input: CreateCheckoutInput) {
  // The Cakto API checkout endpoint accepts a flexible body — we send the most common fields.
  const body: Record<string, unknown> = {
    type: input.mode === "subscription" ? "subscription" : "one_time",
    amount: input.amountCents,
    currency: "BRL",
    payment_methods: [input.paymentMethod],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    reference: input.reference,
  };
  if (input.productId) body.product_id = input.productId;
  if (input.mode === "subscription") body.interval = "month";
  if (input.donor) {
    body.customer = {
      name: input.donor.name,
      email: input.donor.email,
      phone: input.donor.whatsapp,
    };
  }
  return await caktoFetch<{ id: string; url: string; checkout_url?: string }>(
    "/v1/checkouts",
    { method: "POST", body: JSON.stringify(body) }
  );
}

// HMAC-SHA256 webhook signature verification — tolerant to header format variations
export async function verifyCaktoSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = Deno.env.get("CAKTO_WEBHOOK_SECRET");
  if (!secret) return false;
  if (!signature) {
    // Fallback: some Cakto setups send the secret as a bearer/plain token in a header
    // The caller handles that path separately.
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const bytes = new Uint8Array(sig);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const b64 = btoa(String.fromCharCode(...bytes));

  // Strip common prefixes: "sha256=", "hmac-sha256=", "t=...,v1=..." (stripe-style)
  let provided = signature.trim();
  const stripeMatch = provided.match(/v1=([A-Fa-f0-9+/=]+)/);
  if (stripeMatch) provided = stripeMatch[1];
  provided = provided.replace(/^sha256=/i, "").replace(/^hmac-sha256=/i, "").trim();

  return (
    provided.toLowerCase() === hex ||
    provided === b64 ||
    provided === secret // direct shared-secret header
  );
}
