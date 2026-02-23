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
  const themes = {
    success:  { gradient: "linear-gradient(135deg, #10b981 0%, #14b8a6 100%)", bg: "#10b981", icon: "✅", badge: "CONFIRMADO" },
    declined: { gradient: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)", bg: "#f59e0b", icon: "📋", badge: "REGISTRADO" },
    error:    { gradient: "linear-gradient(135deg, #ef4444 0%, #e11d48 100%)", bg: "#ef4444", icon: "❌", badge: "ERRO" },
    warning:  { gradient: "linear-gradient(135deg, #f59e0b 0%, #eab308 100%)", bg: "#f59e0b", icon: "⚠️", badge: "AVISO" },
    info:     { gradient: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)", bg: "#3b82f6", icon: "ℹ️", badge: "INFO" },
  };
  const t = themes[type];

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - LEVI Escalas</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{min-height:100vh;background:#0f0f13;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px 20px}
    .card{width:420px;background:#16161e;border:1px solid #2a2a38;border-radius:20px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.04);animation:slideIn .6s cubic-bezier(.16,1,.3,1) both}
    @keyframes slideIn{from{opacity:0;transform:translateY(30px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
    .card-header{background:${t.bg};background:${t.gradient};padding:28px 28px 22px;position:relative;overflow:hidden}
    .card-header::before{content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.08)}
    .badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.18);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.25);border-radius:30px;padding:5px 14px;font-size:11px;font-weight:600;color:#fff;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:18px}
    .badge .dot{width:7px;height:7px;border-radius:50%;background:#86efac;animation:pulse 1.5s ease-in-out infinite}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
    .htitle{font-family:'Playfair Display',serif;font-size:26px;color:#fff;line-height:1.2;margin-bottom:4px}
    .hsub{font-size:13px;color:rgba(255,255,255,0.65);font-weight:300}
    .icon-row{display:flex;align-items:center;justify-content:center;padding:32px 28px 8px}
    .icon-circle{width:72px;height:72px;border-radius:50%;background:${t.bg};background:${t.gradient};display:flex;align-items:center;justify-content:center;font-size:36px;border:3px solid #2a2a38}
    .msg-area{padding:20px 28px 28px;text-align:center}
    .msg-area h1{font-family:'Playfair Display',serif;font-size:22px;color:#e8e8f0;margin-bottom:12px}
    .msg-area p{font-size:14px;color:#8a8aa0;line-height:1.6}
    .card-footer{padding:16px 28px;display:flex;align-items:center;justify-content:space-between;background:#12121a}
    .footer-text{font-size:11px;color:#3a3a5a}
    .footer-brand{color:#6366f1;font-weight:600}
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <div class="badge"><span class="dot"></span> ${t.badge}</div>
      <div class="htitle">${title}</div>
      <div class="hsub">LEVI — Sistema de Escalas</div>
    </div>
    <div class="icon-row"><div class="icon-circle">${t.icon}</div></div>
    <div class="msg-area">
      <h1>${title}</h1>
      <p>${message}</p>
    </div>
    <div class="card-footer">
      <span class="footer-text">Powered by <span class="footer-brand">LEVI</span></span>
      <span class="footer-text">Sistema de Escalas</span>
    </div>
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
