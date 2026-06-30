import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';
import { z } from 'npm:zod@3.23.8';
import { createCaktoCheckout } from '../_shared/cakto.ts';

const ALLOWED_ORIGINS = new Set([
  'https://leviescalas.com.br',
  'https://www.leviescalas.com.br',
  'https://leviescalas.lovable.app',
  'http://localhost:5173',
  'http://localhost:3000',
]);

const Body = z.object({
  amount: z.number().min(5).max(10000), // BRL
  mode: z.enum(['one_time', 'subscription']),
  payment_method: z.enum(['pix', 'credit_card']),
  donor_name: z.string().trim().min(1).max(120).optional(),
  donor_email: z.string().email().max(160).optional(),
  donor_whatsapp: z.string().trim().min(8).max(20).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const origin = req.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.has(origin) && !origin.endsWith('.lovable.app')) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const input = parsed.data;
    const amountCents = Math.round(input.amount * 100);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // Create donation row (pending)
    const { data: donation, error: insErr } = await supabase
      .from('donations')
      .insert({
        donor_name: input.donor_name,
        donor_email: input.donor_email,
        donor_whatsapp: input.donor_whatsapp,
        amount_cents: amountCents,
        mode: input.mode,
        payment_method: input.payment_method,
        status: 'pending',
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    // Optional: link product
    const { data: product } = await supabase
      .from('cakto_products')
      .select('cakto_product_id')
      .eq('kind', input.mode)
      .maybeSingle();

    const checkout = await createCaktoCheckout({
      mode: input.mode,
      amountCents,
      paymentMethod: input.payment_method,
      successUrl: `${origin}/apoiar?status=success&ref=${donation.id}`,
      cancelUrl: `${origin}/apoiar?status=cancel`,
      donor: {
        name: input.donor_name,
        email: input.donor_email,
        whatsapp: input.donor_whatsapp,
      },
      reference: donation.id,
      productId: product?.cakto_product_id || undefined,
    });

    // Store checkout id
    await supabase.from('donations')
      .update({ cakto_session_id: checkout.id })
      .eq('id', donation.id);

    return new Response(JSON.stringify({ url: checkout.url || checkout.checkout_url, id: donation.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (err) {
    console.error('[cakto-create-payment] error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
