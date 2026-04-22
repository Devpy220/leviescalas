// Shared helper to send WhatsApp messages sequentially with randomized delays
// to mimic human sending patterns and reduce Z-API spam detection.

import { randomBetween } from "./messageVariants.ts";

export interface WhatsAppRecipient {
  phone: string;
  message: string;
}

export interface BatchOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
  minTypingSec?: number;
  maxTypingSec?: number;
}

export interface BatchResult {
  sent: number;
  errors: number;
  total: number;
}

export async function sendWhatsAppBatch(
  supabaseUrl: string,
  serviceRoleKey: string,
  recipients: WhatsAppRecipient[],
  opts: BatchOptions = {},
): Promise<BatchResult> {
  const minDelay = opts.minDelayMs ?? 10_000;    // 10s
  const maxDelay = opts.maxDelayMs ?? 600_000;   // 10 min
  const minTyping = opts.minTypingSec ?? 3;
  const maxTyping = opts.maxTypingSec ?? 8;

  let sent = 0;
  let errors = 0;

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    if (!r.phone) continue;

    try {
      const delayTyping = randomBetween(minTyping, maxTyping);
      const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ phone: r.phone, message: r.message, delayTyping }),
      });
      const data = await res.json().catch(() => ({ sent: false }));
      if (data?.sent === true) sent++;
      else errors++;
    } catch (e) {
      console.error("sendWhatsAppBatch error:", e);
      errors++;
    }

    // Wait between messages (skip after the last one)
    if (i < recipients.length - 1) {
      const wait = randomBetween(minDelay, maxDelay);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  console.log(`WhatsApp batch: ${sent}/${recipients.length} sent, ${errors} errors`);
  return { sent, errors, total: recipients.length };
}

/**
 * Runs the batch either inline (small batches) or in background via EdgeRuntime.waitUntil
 * (large batches). Threshold default is 3.
 */
export function scheduleBatch(
  supabaseUrl: string,
  serviceRoleKey: string,
  recipients: WhatsAppRecipient[],
  opts: BatchOptions & { backgroundThreshold?: number } = {},
): { backgrounded: boolean; promise: Promise<BatchResult> } {
  const threshold = opts.backgroundThreshold ?? 2;
  const promise = sendWhatsAppBatch(supabaseUrl, serviceRoleKey, recipients, opts);

  if (recipients.length > threshold) {
    // @ts-ignore - EdgeRuntime is provided by Supabase/Deno Deploy
    const er = (globalThis as any).EdgeRuntime;
    if (er && typeof er.waitUntil === "function") {
      er.waitUntil(promise);
      return { backgrounded: true, promise };
    }
  }
  return { backgrounded: false, promise };
}
