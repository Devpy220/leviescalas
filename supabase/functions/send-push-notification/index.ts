import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ApplicationServer,
  importVapidKeys,
  PushSubscription as WebPushSubscription,
  Urgency,
} from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Build JWK objects from simple x, y, d values and import VAPID keys
async function getApplicationServer(): Promise<ApplicationServer> {
  const vapidX = Deno.env.get("VAPID_X");
  const vapidY = Deno.env.get("VAPID_Y");
  const vapidD = Deno.env.get("VAPID_D");

  if (!vapidX || !vapidY || !vapidD) {
    throw new Error("VAPID_X, VAPID_Y, and VAPID_D must be set");
  }

  const publicJwk = {
    kty: "EC",
    crv: "P-256",
    alg: "ES256",
    x: vapidX,
    y: vapidY,
    key_ops: ["verify"],
    ext: true,
  };

  const privateJwk = {
    kty: "EC",
    crv: "P-256",
    alg: "ES256",
    x: vapidX,
    y: vapidY,
    d: vapidD,
    key_ops: ["sign"],
    ext: true,
  };

  const keys = await importVapidKeys(privateJwk, publicJwk);

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
