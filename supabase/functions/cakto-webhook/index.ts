import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';
import { verifyCaktoSignature } from '../_shared/cakto.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const rawBody = await req.text();
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

  // Cakto sends the secret inside the JSON body as `secret`, not as a header.
  // We still accept header-based signatures as a fallback for future changes.
  const expectedSecret = Deno.env.get('CAKTO_WEBHOOK_SECRET') || '';
  let bodySecret: string | null = null;
  try {
    const parsed = JSON.parse(rawBody);
    bodySecret = parsed?.secret || parsed?.webhook_secret || parsed?.token || null;
  } catch { /* ignore */ }

  const bodyOk = !!expectedSecret && !!bodySecret &&
    bodySecret.length === expectedSecret.length &&
    bodySecret === expectedSecret;
  const headerOk = signature ? await verifyCaktoSignature(rawBody, signature) : false;

  if (!bodyOk && !headerOk) {
    console.warn('[cakto-webhook] invalid signature. Headers seen:', JSON.stringify(headerDump), 'Body secret present:', !!bodySecret, 'Body preview:', rawBody.slice(0, 200));
    if (Deno.env.get('CAKTO_WEBHOOK_INSECURE') !== '1') {
      return new Response('invalid signature', { status: 401 });
    }
    console.warn('[cakto-webhook] CAKTO_WEBHOOK_INSECURE=1 — proceeding without signature check');
  }

  let event: any;
  try { event = JSON.parse(rawBody); } catch {
    return new Response('invalid json', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const type = (event.type || event.event || '').toString().toLowerCase();
  const rawData = event.data || event.payload || event;
  const data = Array.isArray(rawData) ? (rawData[0] || {}) : rawData;
  const reference = data.reference || data.metadata?.reference || data.refId || data.ref_id;
  const sessionId = data.checkout_id || data.session_id || data.id;
  const subscriptionId = data.subscription_id || data.subscription?.id;
  const paymentId = data.payment_id || data.id;

  let newStatus: string | null = null;
  if (type.includes('paid') || type.includes('approved') || type.includes('succeeded')) newStatus = 'paid';
  else if (type.includes('failed') || type.includes('declined')) newStatus = 'failed';
  else if (type.includes('canceled') || type.includes('cancelled')) newStatus = 'canceled';
  else if (type.includes('refund')) newStatus = 'refunded';

  const update: Record<string, any> = { raw_payload: event };
  if (newStatus) update.status = newStatus;
  if (newStatus === 'paid') update.paid_at = new Date().toISOString();
  if (subscriptionId) update.cakto_subscription_id = subscriptionId;
  if (paymentId) update.cakto_payment_id = paymentId;

  // Try by reference (donation.id) first
  if (reference) {
    await supabase.from('donations').update(update).eq('id', reference);
  } else if (sessionId) {
    await supabase.from('donations').update(update).eq('cakto_session_id', sessionId);
  } else if (subscriptionId) {
    await supabase.from('donations').update(update).eq('cakto_subscription_id', subscriptionId);
  }

  // Optional: send WhatsApp thank-you on first payment
  if (newStatus === 'paid') {
    try {
      const { data: donation } = await supabase
        .from('donations')
        .select('donor_name, donor_whatsapp, amount_cents, mode')
        .eq(reference ? 'id' : 'cakto_session_id', reference || sessionId)
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

  return new Response('ok', { status: 200 });
});
