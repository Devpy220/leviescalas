import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';
import { verifyCaktoSignature } from '../_shared/cakto.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  const rawBody = await req.text();
  let event: any;
  try { event = JSON.parse(rawBody); } catch {
    return new Response('invalid json', { status: 400, headers: corsHeaders });
  }
  // Collect every header that might carry the signature/token
  const headerCandidates = [
    'x-cakto-signature', 'cakto-signature', 'x-signature', 'signature',
    'x-webhook-signature', 'x-hub-signature-256', 'x-cakto-token',
    'cakto-token', 'x-webhook-secret', 'authorization',
  ];
  const headerDump: Record<string, string> = {};
  for (const h of headerCandidates) {
    const v = req.headers.get(h);
    if (v) headerDump[h] = v;
  }
  const signature =
    req.headers.get('x-cakto-signature') ||
    req.headers.get('cakto-signature') ||
    req.headers.get('x-signature') ||
    req.headers.get('signature') ||
    req.headers.get('x-webhook-signature') ||
    req.headers.get('x-hub-signature-256') ||
    req.headers.get('x-cakto-token') ||
    req.headers.get('cakto-token') ||
    req.headers.get('x-webhook-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    null;

  // Cakto sends the webhook token inside the JSON body as `secret`, not as a header.
  // Keep CAKTO_WEBHOOK_SECRET for production and CAKTO_WEBHOOK_BODY_SECRET for
  // Cakto's panel/test token when it differs from the originally configured value.
  const expectedSecrets = [
    Deno.env.get('CAKTO_WEBHOOK_SECRET'),
    Deno.env.get('CAKTO_WEBHOOK_BODY_SECRET'),
  ].filter((s): s is string => !!s);
  const bodySecret = (event?.secret || event?.webhook_secret || event?.token || '').toString().trim();

  const bodyOk = !!bodySecret && expectedSecrets.some((expectedSecret) =>
    bodySecret.length === expectedSecret.length && bodySecret === expectedSecret
  );
  const headerOk = signature ? await verifyCaktoSignature(rawBody, signature) : false;

  if (!bodyOk && !headerOk) {
    console.warn('[cakto-webhook] invalid signature. Headers seen:', JSON.stringify(headerDump), 'Body secret present:', !!bodySecret, 'Body preview:', rawBody.slice(0, 200));
    if (Deno.env.get('CAKTO_WEBHOOK_INSECURE') !== '1') {
      return new Response('invalid signature', { status: 401 });
    }
    console.warn('[cakto-webhook] CAKTO_WEBHOOK_INSECURE=1 — proceeding without signature check');
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const type = (event.type || event.event || event.event_name || event.status || '').toString().toLowerCase();
  const rawData = event.data || event.payload || event;
  const data = Array.isArray(rawData) ? (rawData[0] || {}) : rawData;
  const reference = data.reference || data.metadata?.reference || data.refId || data.ref_id || data.order_id || data.order?.id;
  const checkoutUrl = data.checkout_url || data.checkoutUrl || data.url || data.payment_url || data.paymentUrl || data.product?.checkout_url;
  const sessionId = data.checkout_id || data.session_id || data.sessionId || data.transaction_id || data.transactionId || data.id;
  const subscriptionId = data.subscription_id || data.subscriptionId || data.subscription?.id;
  const paymentId = data.payment_id || data.paymentId || data.transaction_id || data.transactionId || data.id;

  let newStatus: string | null = null;
  if (type.includes('paid') || type.includes('approved') || type.includes('succeeded') || type.includes('renewed') || type.includes('completed')) newStatus = 'paid';
  else if (type.includes('failed') || type.includes('declined') || type.includes('refused') || type.includes('rejected')) newStatus = 'failed';
  else if (type.includes('canceled') || type.includes('cancelled') || type.includes('cancel')) newStatus = 'canceled';
  else if (type.includes('refund') || type.includes('chargeback')) newStatus = 'refunded';

  const update: Record<string, any> = { raw_payload: event };
  if (newStatus) update.status = newStatus;
  if (newStatus === 'paid') update.paid_at = new Date().toISOString();
  if (subscriptionId) update.cakto_subscription_id = subscriptionId;
  if (paymentId) update.cakto_payment_id = paymentId;

  let matchedDonationId: string | null = null;

  // Try by reference (donation.id) first, then known Cakto ids.
  if (reference) {
    const { data: updated } = await supabase.from('donations').update(update).eq('id', reference).select('id').maybeSingle();
    matchedDonationId = updated?.id ?? null;
  }
  if (!matchedDonationId && sessionId) {
    const { data: updated } = await supabase.from('donations').update(update).eq('cakto_session_id', sessionId).select('id').maybeSingle();
    matchedDonationId = updated?.id ?? null;
  }
  if (!matchedDonationId && subscriptionId) {
    const { data: updated } = await supabase.from('donations').update(update).eq('cakto_subscription_id', subscriptionId).select('id').maybeSingle();
    matchedDonationId = updated?.id ?? null;
  }

  // Static Cakto checkout links do not carry our donation reference. When Cakto
  // sends a real payment without a matching row, create one so the admin panel
  // still records the event instead of looking like a webhook error.
  if (!matchedDonationId && newStatus) {
    const customer = data.customer || data.client || data.buyer || data.user || {};
    const amountRaw = data.amount_cents ?? data.amountCents ?? data.amount ?? data.total_amount ?? data.totalAmount ?? data.value ?? data.price;
    const amountNumber = typeof amountRaw === 'number'
      ? amountRaw
      : Number(String(amountRaw ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
    const amountCents = Number.isFinite(amountNumber)
      ? (amountNumber > 1000 ? Math.round(amountNumber) : Math.round(amountNumber * 100))
      : 2500;
    const isSubscription = type.includes('subscription') || type.includes('renewed') || !!subscriptionId || String(data.recurrence || data.recurrence_type || '').toLowerCase().includes('month');

    const { data: inserted, error: insertErr } = await supabase.from('donations').insert({
      donor_name: customer.name || customer.full_name || data.customer_name || data.name || null,
      donor_email: customer.email || data.customer_email || data.email || null,
      donor_whatsapp: customer.phone || customer.whatsapp || data.customer_phone || data.phone || null,
      amount_cents: amountCents > 0 ? amountCents : 2500,
      mode: isSubscription ? 'subscription' : 'one_time',
      payment_method: data.payment_method || data.paymentMethod || data.method || null,
      status: newStatus,
      cakto_session_id: sessionId || null,
      cakto_subscription_id: subscriptionId || null,
      cakto_payment_id: paymentId || null,
      raw_payload: event,
      paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
    }).select('id').maybeSingle();

    if (insertErr) console.error('[cakto-webhook] donation insert err', insertErr);
    matchedDonationId = inserted?.id ?? null;
    console.log('[cakto-webhook] created donation from static checkout webhook', { matchedDonationId, type, sessionId, checkoutUrl });
  }

  // Optional: send WhatsApp thank-you on first payment
  if (newStatus === 'paid') {
    try {
      const { data: donation } = await supabase
        .from('donations')
        .select('donor_name, donor_whatsapp, amount_cents, mode')
        .eq(matchedDonationId ? 'id' : (reference ? 'id' : 'cakto_session_id'), matchedDonationId || reference || sessionId)
        .maybeSingle();
      const phone = donation?.donor_whatsapp?.replace(/\D/g, '');
      if (phone && phone.length >= 10) {
        const token = Deno.env.get('UAZAPI_TOKEN');
        const base = Deno.env.get('UAZAPI_BASE_URL');
        if (token && base) {
          const amount = ((donation!.amount_cents || 0) / 100).toFixed(2).replace('.', ',');
          const message = `🙏 Obrigado pelo seu apoio${donation?.donor_name ? `, ${donation.donor_name.split(' ')[0]}` : ''}!\n\nRecebemos sua ${donation?.mode === 'subscription' ? 'assinatura mensal' : 'doação'} de R$ ${amount}. Que Deus retribua em dobro! 💜\n\nSiga o ELSD no Instagram: https://instagram.com/elsdigital_tech`;
          await fetch(`${base}/send/text`, {
            method: 'POST',
            headers: { token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: phone, text: message }),
          }).catch((e) => console.error('uazapi thanks err', e));
        }
      }
    } catch (e) {
      console.error('[cakto-webhook] thank-you err', e);
    }
  }

  return new Response('ok', { status: 200, headers: corsHeaders });
});
