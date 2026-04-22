// Shared helper to send WhatsApp messages with randomized delays to mimic
// human sending patterns and reduce Z-API spam detection.
//
// Strategy:
// - Small batches (<= QUEUE_THRESHOLD): run inline / background via EdgeRuntime.waitUntil
//   with random delays between 10s and 180s.
// - Large batches (> QUEUE_THRESHOLD): persisted to public.whatsapp_queue and processed
//   by the `process-whatsapp-queue` cron worker (1 message per minute, randomized).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
  origin?: string;
}

export interface BatchResult {
  sent: number;
  errors: number;
  total: number;
}

const QUEUE_THRESHOLD = 20;

export async function sendWhatsAppBatch(
  supabaseUrl: string,
  serviceRoleKey: string,
  recipients: WhatsAppRecipient[],
  opts: BatchOptions = {},
): Promise<BatchResult> {
  const minDelay = opts.minDelayMs ?? 10_000;    // 10s
  const maxDelay = opts.maxDelayMs ?? 180_000;   // 3 min
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
 * Schedule a batch:
 * - If > QUEUE_THRESHOLD recipients: persist to whatsapp_queue (worker handles via cron).
 * - Otherwise: run in background via EdgeRuntime.waitUntil with random 10s-180s delays.
 *
 * Returns immediately so the caller can respond fast.
 */
export function scheduleBatch(
  supabaseUrl: string,
  serviceRoleKey: string,
  recipients: WhatsAppRecipient[],
  opts: BatchOptions & { backgroundThreshold?: number } = {},
): { backgrounded: boolean; queued: boolean; promise: Promise<BatchResult | { queued: number }> } {
  const valid = recipients.filter((r) => r.phone);

  // Large batch -> persist to DB queue, return immediately.
  if (valid.length > QUEUE_THRESHOLD) {
    const promise = enqueueRecipients(supabaseUrl, serviceRoleKey, valid, opts);
    return { backgrounded: true, queued: true, promise };
  }

  // Small batch -> background execution with random delays.
  const promise = sendWhatsAppBatch(supabaseUrl, serviceRoleKey, valid, opts);
  // @ts-ignore - EdgeRuntime is provided by Supabase/Deno Deploy
  const er = (globalThis as any).EdgeRuntime;
  if (er && typeof er.waitUntil === "function") {
    er.waitUntil(promise);
    return { backgrounded: true, queued: false, promise };
  }
  return { backgrounded: false, queued: false, promise };
}

async function enqueueRecipients(
  supabaseUrl: string,
  serviceRoleKey: string,
  recipients: WhatsAppRecipient[],
  opts: BatchOptions = {},
): Promise<{ queued: number }> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const minDelay = opts.minDelayMs ?? 10_000;
  const maxDelay = opts.maxDelayMs ?? 180_000;

  // First message scheduled now; each next at a random offset added to the previous.
  const now = Date.now();
  let cursor = now;
  const rows = recipients.map((r, i) => {
    if (i > 0) {
      cursor += randomBetween(minDelay, maxDelay);
    }
    return {
      phone: r.phone,
      message: r.message,
      scheduled_for: new Date(cursor).toISOString(),
      origin: opts.origin ?? null,
    };
  });

  const { error } = await supabase.from("whatsapp_queue").insert(rows);
  if (error) {
    console.error("enqueueRecipients error:", error);
    return { queued: 0 };
  }
  console.log(`Enqueued ${rows.length} WhatsApp messages (origin=${opts.origin ?? '-'})`);
  return { queued: rows.length };
}
