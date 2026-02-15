import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ApplicationServer,
  generateVapidKeys,
  importVapidKeys,
  PushSubscription as WebPushSubscription,
  Urgency,
} from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Load VAPID keys from environment
async function getApplicationServer(): Promise<ApplicationServer> {
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set");
  }

  // Import the keys from JWK format
  const keys = await importVapidKeys(
    JSON.parse(vapidPrivateKey),
    JSON.parse(vapidPublicKey)
  );

  return new ApplicationServer({
    contactInformation: "mailto:suporte@leviescalas.com",
    vapidKeys: keys,
  });
}

// Send push to all subscriptions for a user
async function sendPushToUser(
  supabaseAdmin: SupabaseClient,
  appServer: ApplicationServer,
  userId: string,
  notification: { title: string; body: string; data?: Record<string, unknown> }
): Promise<{ sent: number; failed: number }> {
  const { data: subscriptions, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching subscriptions:", error);
    return { sent: 0, failed: 0 };
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log("No push subscriptions for user:", userId);
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: "/pwa-192x192.png",
    badge: "/favicon.png",
    tag: "levi-notification-" + Date.now(),
    data: notification.data || {},
  });

  for (const sub of subscriptions) {
    try {
      const pushSub: WebPushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      // Build and send the push request
      const httpReq = await appServer.pushMessage(
        pushSub,
        {
          urgency: Urgency.High,
          ttl: 86400,
        },
        new TextEncoder().encode(payload)
      );

      const response = await fetch(httpReq);

      if (response.ok) {
        sent++;
        console.log("Push sent to:", sub.endpoint.substring(0, 50));
      } else {
        const errorText = await response.text();
        console.error(`Push failed (${response.status}):`, errorText);
        failed++;

        // Remove invalid subscriptions (410 Gone or 404 Not Found)
        if (response.status === 410 || response.status === 404) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
          console.log("Removed expired subscription");
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error sending push:", errorMessage);
      failed++;
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

    const appServer = await getApplicationServer();

    const reqBody = await req.json();
    const { userId, userIds, title, body: messageBody, data } = reqBody;

    if (!title || !messageBody) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const notification = {
      title,
      body: messageBody,
      data: data || {},
    };

    let totalSent = 0;
    let totalFailed = 0;

    const targetUsers: string[] = userIds || (userId ? [userId] : []);

    for (const uid of targetUsers) {
      const result = await sendPushToUser(supabaseAdmin, appServer, uid, notification);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    console.log(`Push notifications - sent: ${totalSent}, failed: ${totalFailed}`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, failed: totalFailed }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-push-notification:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
