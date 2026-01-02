import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  console.log("confirm-schedule function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const action = url.searchParams.get("action"); // 'confirm' or 'decline'
    const reason = url.searchParams.get("reason"); // Optional decline reason

    console.log("Request params:", { token: token?.slice(0, 8) + "...", action, reason });

    if (!token || !action) {
      return generateHtmlResponse("Erro", "Parâmetros inválidos. Token e ação são obrigatórios.", "error");
    }

    if (action !== "confirm" && action !== "decline") {
      return generateHtmlResponse("Erro", "Ação inválida. Use 'confirm' ou 'decline'.", "error");
    }

    // Find schedule by token
    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from("schedules")
      .select(`
        id,
        date,
        time_start,
        time_end,
        confirmation_status,
        user_id,
        department_id,
        departments:department_id (name)
      `)
      .eq("confirmation_token", token)
      .single();

    if (scheduleError || !schedule) {
      console.error("Schedule not found:", scheduleError);
      return generateHtmlResponse(
        "Link Inválido",
        "Este link de confirmação não é válido ou já expirou. Por favor, solicite um novo link ao líder do seu ministério.",
        "error"
      );
    }

    console.log("Schedule found:", schedule.id, "Current status:", schedule.confirmation_status);

    // Check if already processed
    if (schedule.confirmation_status !== "pending") {
      const statusText = schedule.confirmation_status === "confirmed" ? "confirmada" : "recusada";
      return generateHtmlResponse(
        "Já Processado",
        `Esta escala já foi ${statusText} anteriormente. Nenhuma ação adicional é necessária.`,
        "info"
      );
    }

    // Check if schedule date has passed
    const scheduleDate = new Date(schedule.date + "T" + schedule.time_start);
    if (scheduleDate < new Date()) {
      return generateHtmlResponse(
        "Escala Expirada",
        "Esta escala já passou. Não é possível confirmar ou recusar escalas passadas.",
        "warning"
      );
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", schedule.user_id)
      .single();

    // Update schedule status
    const updateData: Record<string, unknown> = {
      confirmation_status: action === "confirm" ? "confirmed" : "declined",
      confirmed_at: new Date().toISOString(),
    };

    if (action === "decline" && reason) {
      updateData.decline_reason = decodeURIComponent(reason).slice(0, 500);
    }

    const { error: updateError } = await supabaseAdmin
      .from("schedules")
      .update(updateData)
      .eq("id", schedule.id);

    if (updateError) {
      console.error("Error updating schedule:", updateError);
      return generateHtmlResponse(
        "Erro",
        "Ocorreu um erro ao processar sua resposta. Por favor, tente novamente.",
        "error"
      );
    }

    console.log("Schedule updated successfully:", schedule.id, "->", action);

    // Create notification for the leader
    const deptData = schedule.departments as { name: string } | { name: string }[] | null;
    const deptName = Array.isArray(deptData) ? deptData[0]?.name : deptData?.name || "Departamento";
    const formattedDate = new Date(schedule.date + "T00:00:00").toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
    });

    const notificationMessage = action === "confirm"
      ? `✅ ${profile?.name || "Membro"} confirmou presença para ${formattedDate}`
      : `❌ ${profile?.name || "Membro"} não poderá comparecer em ${formattedDate}${reason ? `: ${decodeURIComponent(reason)}` : ""}`;

    // Get department leader
    const { data: dept } = await supabaseAdmin
      .from("departments")
      .select("leader_id")
      .eq("id", schedule.department_id)
      .single();

    if (dept?.leader_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: dept.leader_id,
        department_id: schedule.department_id,
        schedule_id: schedule.id,
        type: action === "confirm" ? "schedule_confirmed" : "schedule_declined",
        message: notificationMessage,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    }

    // Return success page
    if (action === "confirm") {
      return generateHtmlResponse(
        "Presença Confirmada! ✅",
        `Obrigado, ${profile?.name || ""}! Sua presença foi confirmada para ${formattedDate} às ${schedule.time_start.slice(0, 5)} no ${deptName}.`,
        "success"
      );
    } else {
      return generateHtmlResponse(
        "Ausência Registrada",
        `Entendido, ${profile?.name || ""}. O líder do ${deptName} foi notificado sobre sua indisponibilidade para ${formattedDate}.`,
        "declined"
      );
    }
  } catch (error: unknown) {
    console.error("Error in confirm-schedule:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return generateHtmlResponse(
      "Erro Interno",
      `Ocorreu um erro inesperado. Por favor, tente novamente mais tarde. (${errorMessage})`,
      "error"
    );
  }
};

function generateHtmlResponse(
  title: string,
  message: string,
  type: "success" | "declined" | "error" | "warning" | "info"
): Response {
  const colors = {
    success: { bg: "#10B981", icon: "✅", gradient: "from-emerald-500 to-teal-600" },
    declined: { bg: "#F59E0B", icon: "📋", gradient: "from-amber-500 to-orange-600" },
    error: { bg: "#EF4444", icon: "❌", gradient: "from-red-500 to-rose-600" },
    warning: { bg: "#F59E0B", icon: "⚠️", gradient: "from-amber-500 to-yellow-600" },
    info: { bg: "#3B82F6", icon: "ℹ️", gradient: "from-blue-500 to-indigo-600" },
  };

  const color = colors[type];

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - LEVI Escalas</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 24px;
      padding: 40px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    .icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${color.bg};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
    }
    h1 {
      color: #1F2937;
      font-size: 24px;
      margin-bottom: 16px;
      font-weight: 700;
    }
    p {
      color: #6B7280;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .logo {
      font-size: 14px;
      color: #9CA3AF;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #E5E7EB;
    }
    .logo strong {
      color: #6366F1;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${color.icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="logo">Powered by <strong>LEVI</strong> - Sistema de Escalas</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...corsHeaders,
    },
  });
}

serve(handler);
