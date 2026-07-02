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
  opts: BatchOptions & { backgroundThreshold?: number; forceQueue?: boolean } = {},
): { backgrounded: boolean; queued: boolean; promise: Promise<BatchResult | { queued: number }> } {
  const valid = recipients.filter((r) => r.phone);

  // forceQueue or large batch -> persist to DB queue (durable; survives function shutdown).
  if (opts.forceQueue || valid.length > QUEUE_THRESHOLD) {
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

// ─────────────────────────────────────────────────────────────
// Triplet helper: for each recipient, enqueue 3 sequential messages
// (main content, support CTA, commands hint) with humanized pauses
// between them. Instagram line is appended to the main message only
// when includeInstagram=true (typically for schedule reminders/notifications).
// ─────────────────────────────────────────────────────────────

import {
  buildSupportOnlyMessage,
  buildCommandsOnlyMessage,
  INSTAGRAM_LINK,
} from "./messageVariants.ts";

export interface TripletRecipient {
  phone: string;
  userName: string;
  mainMessage: string;
}

export interface TripletOptions {
  origin: string;
  includeInstagram?: boolean;
  // Pause range between the 3 messages for the SAME recipient.
  interMinMs?: number;
  interMaxMs?: number;
  // Delay between different recipients (so we don't blast).
  betweenRecipientsMinMs?: number;
  betweenRecipientsMaxMs?: number;
}

export async function enqueueTriplets(
  supabaseUrl: string,
  serviceRoleKey: string,
  recipients: TripletRecipient[],
  opts: TripletOptions,
): Promise<{ queued: number }> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const interMin = opts.interMinMs ?? 12_000;
  const interMax = opts.interMaxMs ?? 35_000;
  const bwMin = opts.betweenRecipientsMinMs ?? 20_000;
  const bwMax = opts.betweenRecipientsMaxMs ?? 90_000;
  const igLine = opts.includeInstagram
    ? `\n\n📲 Siga a ELSD no Instagram:\n${INSTAGRAM_LINK}`
    : "";

  const rows: any[] = [];
  let cursor = Date.now();

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    if (!r.phone) continue;
    if (i > 0) cursor += randomBetween(bwMin, bwMax);

    const mainAt = cursor;
    const supportAt = mainAt + randomBetween(interMin, interMax);
    const commandsAt = supportAt + randomBetween(interMin, interMax);
    cursor = commandsAt;

    rows.push({
      phone: r.phone,
      message: r.mainMessage + igLine,
      scheduled_for: new Date(mainAt).toISOString(),
      origin: `${opts.origin}:main`,
    });
    rows.push({
      phone: r.phone,
      message: buildSupportOnlyMessage(r.userName),
      scheduled_for: new Date(supportAt).toISOString(),
      origin: `${opts.origin}:support`,
    });
    rows.push({
      phone: r.phone,
      message: buildCommandsOnlyMessage(),
      scheduled_for: new Date(commandsAt).toISOString(),
      origin: `${opts.origin}:commands`,
    });
  }

  if (rows.length === 0) return { queued: 0 };

  const { error } = await supabase.from("whatsapp_queue").insert(rows);
  if (error) {
    console.error("enqueueTriplets error:", error);
    return { queued: 0 };
  }
  console.log(`Enqueued ${rows.length} triplet parts for ${recipients.length} recipients (origin=${opts.origin})`);
  return { queued: rows.length };
}

