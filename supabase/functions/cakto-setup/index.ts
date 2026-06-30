import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';
import { caktoFetch } from '../_shared/cakto.ts';

const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/cakto-webhook`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Admin-only (JWT)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) return new Response('Forbidden', { status: 403, headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const results: any = { products: {}, webhook: null };

  try {
    // 1) Create products (one_time + subscription) — try, ignore conflicts
    for (const kind of ['one_time', 'subscription'] as const) {
      try {
        const product = await caktoFetch<any>('/v1/products', {
          method: 'POST',
          body: JSON.stringify({
            name: kind === 'subscription' ? 'Apoio mensal ao LEVI' : 'Apoio único ao LEVI',
            description: 'Doação para manter o LEVI gratuito para igrejas.',
            type: kind === 'subscription' ? 'subscription' : 'one_time',
            currency: 'BRL',
            interval: kind === 'subscription' ? 'month' : undefined,
          }),
        });
        results.products[kind] = product;
        await admin.from('cakto_products').upsert({
          kind,
          cakto_product_id: product.id ?? product.product_id,
          metadata: product,
        }, { onConflict: 'kind' });
      } catch (e) {
        results.products[kind] = { error: (e as Error).message };
      }
    }

    // 2) Register webhook
    try {
      const wh = await caktoFetch<any>('/v1/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          url: WEBHOOK_URL,
          events: ['payment.paid', 'payment.failed', 'payment.refunded', 'subscription.canceled', 'subscription.renewed'],
          secret: Deno.env.get('CAKTO_WEBHOOK_SECRET'),
        }),
      });
      results.webhook = wh;
    } catch (e) {
      results.webhook = { error: (e as Error).message };
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[cakto-setup] error', err);
    return new Response(JSON.stringify({ error: (err as Error).message, results }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
