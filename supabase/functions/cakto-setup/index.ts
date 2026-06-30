import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';
import { caktoFetch } from '../_shared/cakto.ts';

const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/cakto-webhook`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getUserIdFromJwt(authHeader: string | null): { token: string; userId: string } | null {
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '').trim();
  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
    const claims = JSON.parse(atob(padded));
    const userId = typeof claims.sub === 'string' ? claims.sub : '';
    const exp = typeof claims.exp === 'number' ? claims.exp : 0;

    if (!userId || !exp || exp <= Math.floor(Date.now() / 1000)) return null;
    return { token, userId };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const auth = getUserIdFromJwt(req.headers.get('Authorization'));
  if (!auth) return jsonResponse({ error: 'Unauthorized' }, 401);

  const userSupabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${auth.token}` } },
  });

  const admin = createClient(
    supabaseUrl,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );

  const { data: isAdmin, error: roleError } = await userSupabase.rpc('has_role', {
    _user_id: auth.userId,
    _role: 'admin',
  });

  if (roleError) {
    console.error('[cakto-setup] admin role check failed:', roleError);
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  if (!isAdmin) return jsonResponse({ error: 'Forbidden' }, 403);

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

    return jsonResponse(results);
  } catch (err) {
    console.error('[cakto-setup] error', err);
    return jsonResponse({ error: (err as Error).message, results }, 500);
  }
});
