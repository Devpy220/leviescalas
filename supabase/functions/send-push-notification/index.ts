import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-push-notification (PushAlert) called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("PUSHALERT_API_KEY");
    if (!apiKey) {
      throw new Error("PUSHALERT_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const reqBody = await req.json();
    const { userId, userIds, title, body: messageBody, data } = reqBody;

    if (!title || !messageBody) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const targetUsers: string[] = userIds || (userId ? [userId] : []);

    if (targetUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, failed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Look up PushAlert subscriber IDs from our mapping table
    const { data: subscribers, error: dbError } = await supabase
      .from("pushalert_subscribers")
      .select("subscriber_id")
      .in("user_id", targetUsers);

    if (dbError) {
      console.error("Error fetching subscriber mappings:", dbError);
      return new Response(
        JSON.stringify({ success: false, sent: 0, failed: targetUsers.length, error: dbError.message }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!subscribers || subscribers.length === 0) {
      console.log("No PushAlert subscribers found for target users");
      return new Response(
        JSON.stringify({ success: true, sent: 0, failed: 0, message: "No subscribers found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send notification to each subscriber via PushAlert REST API
    let sent = 0;
    let failed = 0;

    for (const sub of subscribers) {
      try {
        const params = new URLSearchParams();
        params.append("title", title);
        params.append("message", messageBody);
        params.append("subscriber", sub.subscriber_id);
        if (data?.url) {
          params.append("url", data.url);
        }

        const response = await fetch("https://api.pushalert.co/rest/v1/send", {
          method: "POST",
          headers: {
            "Authorization": `api_key=${apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        if (response.ok) {
          const result = await response.json();
          console.log("PushAlert send result:", JSON.stringify(result));
          sent++;
        } else {
          const errorText = await response.text();
          console.error(`PushAlert API error (${response.status}):`, errorText);
          failed++;
        }
      } catch (e) {
        console.error("Error sending to subscriber:", sub.subscriber_id, e);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed }),
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
