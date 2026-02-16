import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-push-notification (WonderPush) called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("WONDERPUSH_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("WONDERPUSH_ACCESS_TOKEN not configured");
    }

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

    // Send via WonderPush Management API
    const response = await fetch(
      `https://management-api.wonderpush.com/v1/deliveries?accessToken=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserIds: targetUsers,
          notification: {
            alert: {
              title,
              text: messageBody,
            },
            ...(data ? { targetUrl: data.url || undefined } : {}),
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`WonderPush API error (${response.status}):`, errorText);
      return new Response(
        JSON.stringify({ success: false, sent: 0, failed: targetUsers.length, error: errorText }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const result = await response.json();
    console.log("WonderPush delivery result:", JSON.stringify(result));

    return new Response(
      JSON.stringify({ success: true, sent: targetUsers.length, failed: 0 }),
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
