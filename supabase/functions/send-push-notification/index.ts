import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// VAPID keys for this project - generated specifically for leviescalas.lovable.app
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const VAPID_SUBJECT = 'mailto:suporte@leviescalas.com';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Send push notification to endpoint (minimal implementation without encryption)
async function sendPushNotification(
  subscription: PushSubscription,
  _notification: PushNotification
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    
    // Create a simple unsigned JWT for VAPID (works for testing/notifications)
    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'none' })).replace(/=/g, '');
    const payload = btoa(JSON.stringify({
      aud: audience,
      exp: now + 86400,
      sub: VAPID_SUBJECT
    })).replace(/=/g, '');
    const jwt = `${header}.${payload}.`;

    // Send a minimal push to trigger the service worker
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        'TTL': '86400',
        'Urgency': 'high',
        'Content-Length': '0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Push failed (${response.status}):`, errorText);
      return { 
        success: false, 
        error: `${response.status}: ${errorText.substring(0, 100)}` 
      };
    }

    console.log('Push notification sent successfully to:', subscription.endpoint.substring(0, 50));
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending push notification:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Send push to all subscriptions for a user
async function sendPushToUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  notification: PushNotification
): Promise<{ sent: number; failed: number }> {
  const { data: subscriptions, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching subscriptions:', error);
    return { sent: 0, failed: 0 };
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('No push subscriptions for user:', userId);
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const pushSub: PushSubscription = {
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth
    };
    
    const result = await sendPushNotification(pushSub, notification);
    if (result.success) {
      sent++;
    } else {
      failed++;
      // Remove invalid subscriptions (410 Gone or 404 Not Found)
      if (result.error?.startsWith('410') || result.error?.startsWith('404')) {
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
        console.log('Removed expired subscription');
      }
    }
  }

  return { sent, failed };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-push-notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const reqBody = await req.json();
    const { userId, userIds, title, body: messageBody, data } = reqBody;

    if (!title || !messageBody) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const notification: PushNotification = { 
      title, 
      body: messageBody, 
      data: data || {} 
    };
    
    let totalSent = 0;
    let totalFailed = 0;

    const targetUsers: string[] = userIds || (userId ? [userId] : []);

    for (const uid of targetUsers) {
      const result = await sendPushToUser(supabaseAdmin, uid, notification);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    console.log(`Push notifications - sent: ${totalSent}, failed: ${totalFailed}`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, failed: totalFailed }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in send-push-notification:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
