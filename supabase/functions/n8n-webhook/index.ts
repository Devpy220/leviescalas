import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Security: Validate webhook URLs to prevent SSRF attacks
const validateWebhookUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    
    // Block private IPs and metadata endpoints
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('169.254.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      console.error("Blocked webhook URL pointing to private/internal address:", hostname);
      return false;
    }
    
    // Require HTTPS for security
    if (parsed.protocol !== 'https:') {
      console.error("Blocked non-HTTPS webhook URL:", parsed.protocol);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error("Invalid webhook URL:", e);
    return false;
  }
};

interface SchedulePayload {
  id: string;
  user_id: string;
  department_id: string;
  date: string;
  time_start: string;
  time_end: string;
  notes?: string;
  sector_id?: string;
}

interface N8nPayload {
  event: string;
  timestamp: string;
  schedule: {
    id: string;
    date: string;
    date_formatted: string;
    time_start: string;
    time_end: string;
    notes: string | null;
    sector_name: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
    whatsapp: string;
  };
  department: {
    id: string;
    name: string;
  };
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('pt-BR', options);
};

const formatTime = (time: string): string => {
  return time.substring(0, 5);
};

const handler = async (req: Request): Promise<Response> => {
  console.log("n8n-webhook: Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
    
    if (!n8nWebhookUrl) {
      console.log("n8n-webhook: N8N_WEBHOOK_URL not configured, skipping");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "N8N_WEBHOOK_URL not configured",
          message: "Configure a secret N8N_WEBHOOK_URL para ativar integração n8n"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Security: Validate webhook URL to prevent SSRF
    if (!validateWebhookUrl(n8nWebhookUrl)) {
      console.error("n8n-webhook: N8N_WEBHOOK_URL failed security validation");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid webhook URL",
          message: "A URL do webhook não passou na validação de segurança"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { schedule, eventType } = await req.json();
    
    console.log("n8n-webhook: Processing event:", eventType, "for schedule:", schedule?.id);

    if (!schedule) {
      return new Response(
        JSON.stringify({ success: false, error: "No schedule data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scheduleData = schedule as SchedulePayload;

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, email, whatsapp")
      .eq("id", scheduleData.user_id)
      .single();

    if (profileError || !profile) {
      console.error("n8n-webhook: Error fetching profile:", profileError);
      return new Response(
        JSON.stringify({ success: false, error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch department
    const { data: department, error: deptError } = await supabase
      .from("departments")
      .select("id, name")
      .eq("id", scheduleData.department_id)
      .single();

    if (deptError || !department) {
      console.error("n8n-webhook: Error fetching department:", deptError);
      return new Response(
        JSON.stringify({ success: false, error: "Department not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch sector if exists
    let sectorName: string | null = null;
    if (scheduleData.sector_id) {
      const { data: sector } = await supabase
        .from("sectors")
        .select("name")
        .eq("id", scheduleData.sector_id)
        .single();
      sectorName = sector?.name || null;
    }

    // Build payload for n8n
    const n8nPayload: N8nPayload = {
      event: eventType || "schedule.created",
      timestamp: new Date().toISOString(),
      schedule: {
        id: scheduleData.id,
        date: scheduleData.date,
        date_formatted: formatDate(scheduleData.date),
        time_start: formatTime(scheduleData.time_start),
        time_end: formatTime(scheduleData.time_end),
        notes: scheduleData.notes || null,
        sector_name: sectorName,
      },
      user: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        whatsapp: profile.whatsapp,
      },
      department: {
        id: department.id,
        name: department.name,
      },
    };

    console.log("n8n-webhook: Sending payload to n8n:", JSON.stringify(n8nPayload));

    // Send to n8n webhook with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(n8nPayload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    const responseText = await n8nResponse.text();
    console.log("n8n-webhook: n8n response status:", n8nResponse.status, "body:", responseText);

    if (!n8nResponse.ok) {
      console.error("n8n-webhook: n8n returned error:", n8nResponse.status, responseText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `n8n returned ${n8nResponse.status}`,
          details: responseText 
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log notification sent
    await supabase.from("notifications").insert({
      user_id: profile.id,
      department_id: department.id,
      schedule_id: scheduleData.id,
      type: "n8n_webhook",
      message: `Webhook enviado para n8n: ${department.name} - ${formatDate(scheduleData.date)}`,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    console.log("n8n-webhook: Successfully sent to n8n");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook sent to n8n successfully",
        n8n_response: responseText
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("n8n-webhook: Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
