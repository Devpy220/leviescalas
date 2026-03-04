import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const escapeHtml = (str: string): string =>
  str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

const WEEKDAYS_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const buildCardHtml = (meta: Record<string, any>, notification: Record<string, any>): string => {
  const type = notification.type || 'info';
  const m = meta || {};

  // Header gradient based on type
  const gradients: Record<string, string> = {
    new_schedule: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
    schedule_moved: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    schedule_reminder: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    announcement: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
    admin_broadcast: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
  };
  const gradient = gradients[type] || gradients.new_schedule;

  const badges: Record<string, string> = {
    new_schedule: '📅 NOVA ESCALA',
    schedule_moved: '⚠️ ALTERAÇÃO',
    schedule_reminder: '🔔 LEMBRETE',
    announcement: '📢 AVISO',
    admin_broadcast: '📢 COMUNICADO',
  };
  const badge = badges[type] || '📌 NOTIFICAÇÃO';

  const titles: Record<string, string> = {
    new_schedule: m.department_name || 'Nova Escala',
    schedule_moved: 'Escala Alterada',
    schedule_reminder: 'Lembrete de Escala',
    announcement: m.department_name || 'Aviso',
    admin_broadcast: 'LEVI Escalas',
  };
  const title = titles[type] || 'Notificação';

  const subtitles: Record<string, string> = {
    new_schedule: 'Você foi escalado para servir',
    schedule_moved: m.department_name || '',
    schedule_reminder: m.department_name || '',
    announcement: 'Novo aviso publicado',
    admin_broadcast: 'Mensagem importante para você',
  };
  const subtitle = subtitles[type] || '';

  const userName = m.user_name || 'Voluntário';
  const initial = userName.charAt(0).toUpperCase();

  // Date parts
  const dateStr = m.date;
  let dateGrid = '';
  if (dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const dayNum = d.getDate().toString();
    const weekday = WEEKDAYS_PT[d.getDay()];
    const monthName = MONTHS_PT[d.getMonth()];
    const year = d.getFullYear().toString();
    const timeStart = m.time_start ? m.time_start.slice(0, 5) : '';
    const timeEnd = m.time_end ? m.time_end.slice(0, 5) : '';

    dateGrid = `
      <div class="info-grid">
        <div class="info-cell"><span class="ic">📅</span><span class="lbl">DIA</span><span class="val highlight">${dayNum}</span></div>
        <div class="info-cell"><span class="ic">📆</span><span class="lbl">DIA DA SEMANA</span><span class="val">${escapeHtml(weekday)}</span></div>
        <div class="info-cell"><span class="ic">🗓️</span><span class="lbl">MÊS</span><span class="val">${escapeHtml(monthName)}</span></div>
        <div class="info-cell"><span class="ic">🏷️</span><span class="lbl">ANO</span><span class="val">${year}</span></div>
      </div>
      ${timeStart ? `
      <div class="info-full">
        <div class="ic ic-purple">⏰</div>
        <div class="text"><span class="lbl">HORÁRIO</span><span class="val">${timeStart}${timeEnd ? ` às ${timeEnd}` : ''}</span></div>
      </div>` : ''}
    `;
  }

  // Old date for schedule_moved
  let oldDateRow = '';
  if (type === 'schedule_moved' && m.old_date) {
    const od = new Date(m.old_date + 'T12:00:00');
    const oldFormatted = `${WEEKDAYS_PT[od.getDay()]}, ${od.getDate()} de ${MONTHS_PT[od.getMonth()]}`;
    oldDateRow = `
      <div class="info-full">
        <div class="ic" style="background:rgba(239,68,68,0.15);">❌</div>
        <div class="text"><span class="lbl">DATA ANTERIOR</span><span class="val" style="text-decoration:line-through;color:#ef4444;">${escapeHtml(oldFormatted)}</span></div>
      </div>
    `;
  }

  // Department
  const deptRow = m.department_name ? `
    <div class="info-full">
      <div class="ic ic-purple">🏢</div>
      <div class="text"><span class="lbl">DEPARTAMENTO</span><span class="val">${escapeHtml(m.department_name)}</span></div>
    </div>` : '';

  // Sector
  const sectorRow = m.sector_name ? `
    <div class="info-full">
      <div class="ic ic-blue">📌</div>
      <div class="text"><span class="lbl">SETOR</span><span class="val">${escapeHtml(m.sector_name)}</span></div>
    </div>` : '';

  // Role
  const roleRow = m.role_label ? `
    <div class="info-full">
      <div class="ic ic-pink">💼</div>
      <div class="text"><span class="lbl">FUNÇÃO</span><span class="val">${escapeHtml(m.role_label)}</span></div>
    </div>` : '';

  // Notes / message for announcements/broadcasts
  let messageRow = '';
  if ((type === 'announcement' || type === 'admin_broadcast') && m.announcement_title) {
    messageRow = `
      <div class="info-full">
        <div class="ic ic-purple">📝</div>
        <div class="text"><span class="lbl">MENSAGEM</span><span class="val" style="white-space:pre-line;">${escapeHtml(m.announcement_title)}</span></div>
      </div>`;
  }
  if (m.notes) {
    messageRow += `
      <div class="info-full">
        <div class="ic" style="background:rgba(251,191,36,0.15);">📝</div>
        <div class="text"><span class="lbl">OBSERVAÇÕES</span><span class="val">${escapeHtml(m.notes)}</span></div>
      </div>`;
  }

  // Confirmation buttons
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  let confirmBtns = '';
  if (m.confirmation_token && (type === 'new_schedule' || type === 'schedule_moved')) {
    const confirmUrl = `${SUPABASE_URL}/functions/v1/confirm-schedule?token=${m.confirmation_token}&action=confirm`;
    const declineUrl = `${SUPABASE_URL}/functions/v1/confirm-schedule?token=${m.confirmation_token}&action=decline`;
    confirmBtns = `
      <div style="padding:24px 28px;text-align:center;border-top:1px solid #22222e;">
        <p style="color:#5a5a7a;font-size:12px;margin-bottom:12px;font-weight:600;">CONFIRME SUA PRESENÇA</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <a href="${confirmUrl}" class="btn-confirm" style="background:linear-gradient(135deg,#22c55e,#16a34a);">✅ Confirmar</a>
          <a href="${declineUrl}" class="btn-confirm" style="background:linear-gradient(135deg,#f59e0b,#ea580c);">❌ Não Poderei</a>
        </div>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Notificação — LEVI</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{min-height:100vh;background:#0f0f13;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;padding:40px 20px}
  .card{width:420px;max-width:100%;background:#16161e;border:1px solid #2a2a38;border-radius:20px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.04);animation:slideIn .6s cubic-bezier(.16,1,.3,1) both}
  @keyframes slideIn{from{opacity:0;transform:translateY(30px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
  .card-header{background:${gradient};padding:28px 28px 22px;position:relative;overflow:hidden}
  .card-header::before{content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.08)}
  .header-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.18);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.25);border-radius:30px;padding:5px 14px;font-size:11px;font-weight:600;color:#fff;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:18px}
  .header-badge .dot{width:7px;height:7px;border-radius:50%;background:#86efac;animation:pulse 1.5s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
  .header-title{font-family:'Playfair Display',serif;font-size:26px;color:#fff;line-height:1.2;margin-bottom:4px}
  .header-sub{font-size:13px;color:rgba(255,255,255,0.65);font-weight:300}
  .avatar-row{display:flex;align-items:center;gap:16px;padding:24px 28px 16px;border-bottom:1px solid #22222e}
  .avatar{width:56px;height:56px;border-radius:50%;background:${gradient};display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;font-weight:700;flex-shrink:0;border:2px solid #2a2a38}
  .avatar-info .label{font-size:10px;color:#5a5a7a;letter-spacing:1.2px;text-transform:uppercase;font-weight:600;margin-bottom:3px}
  .avatar-info .name{font-size:18px;font-weight:600;color:#e8e8f0}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#22222e;border-bottom:1px solid #22222e}
  .info-cell{background:#16161e;padding:18px 22px;transition:background .2s}
  .info-cell:hover{background:#1c1c26}
  .info-cell .ic{font-size:20px;margin-bottom:8px;display:block}
  .info-cell .lbl{font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;margin-bottom:4px}
  .info-cell .val{font-size:14px;font-weight:500;color:#c8c8e0;line-height:1.3}
  .info-cell .val.highlight{color:#a78bfa;font-weight:600}
  .info-full{padding:18px 22px;display:flex;align-items:center;gap:14px;border-bottom:1px solid #22222e;transition:background .2s}
  .info-full:hover{background:#1c1c26}
  .info-full:last-child{border-bottom:none}
  .info-full .ic{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
  .ic-purple{background:rgba(139,92,246,0.15)}
  .ic-pink{background:rgba(219,39,119,0.15)}
  .ic-blue{background:rgba(59,130,246,0.15)}
  .info-full .text .lbl{font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5a5a7a;margin-bottom:3px}
  .info-full .text .val{font-size:14px;font-weight:500;color:#c8c8e0}
  .card-footer{padding:16px 28px;display:flex;align-items:center;justify-content:space-between;background:#12121a}
  .footer-text{font-size:11px;color:#3a3a5a}
  .btn-confirm{color:#fff;border:none;border-radius:10px;padding:10px 22px;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;text-decoration:none;display:inline-block;transition:opacity .2s,transform .15s}
  .btn-confirm:hover{opacity:.85;transform:scale(1.03)}
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <div class="header-badge"><div class="dot"></div>${badge}</div>
    <div class="header-title">${escapeHtml(title)}</div>
    <div class="header-sub">${escapeHtml(subtitle)}</div>
  </div>
  <div class="avatar-row">
    <div class="avatar">${initial}</div>
    <div class="avatar-info">
      <div class="label">COLABORADOR</div>
      <div class="name">${escapeHtml(userName)}</div>
    </div>
  </div>
  ${oldDateRow}
  ${dateGrid}
  ${deptRow}
  ${sectorRow}
  ${roleRow}
  ${messageRow}
  ${confirmBtns}
  <div class="card-footer">
    <span class="footer-text">Powered by <span style="color:#6366f1;font-weight:600;">LEVI</span></span>
    <span class="footer-text">Escalas Inteligentes</span>
  </div>
</div>
</body>
</html>`;
};

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("<h1>Notificação não encontrada</h1>", {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: notification, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !notification) {
      return new Response("<h1>Notificação não encontrada</h1>", {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const meta = (notification as any).metadata || {};
    const html = buildCardHtml(meta, notification);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response("<h1>Erro interno</h1>", {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
