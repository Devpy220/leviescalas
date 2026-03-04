import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const notificationSchema = z.object({
  schedule_id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  department_id: z.string().uuid(),
  department_name: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  time_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  notes: z.string().max(500).optional(),
  type: z.enum(['new_schedule', 'schedule_moved']),
  old_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  confirmation_token: z.string().optional(),
  sector_name: z.string().max(100).optional(),
  assignment_role_label: z.string().max(50).optional(),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const WEEKDAYS_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const formatTime = (time: string): string => time.slice(0, 5);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const rawData = await req.json();
    const validationResult = notificationSchema.safeParse(rawData);
    if (!validationResult.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`) }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { user_id, department_id, department_name, date, time_start, time_end, notes, type, old_date, confirmation_token, sector_name, assignment_role_label } = validationResult.data;

    // Auth: verify caller is department leader
    const { data: dept } = await supabaseAdmin.from('departments').select('leader_id').eq('id', department_id).single();
    if (!dept || dept.leader_id !== caller.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify target user is member
    const { data: membership } = await supabaseAdmin.from('members').select('id').eq('department_id', department_id).eq('user_id', user_id).single();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Target user is not a member" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch profile
    const { data: profile } = await supabaseAdmin.from('profiles').select('email, name, whatsapp').eq('id', user_id).single();
    if (!profile) throw new Error("User profile not found");

    const dateObj = new Date(date + 'T12:00:00');
    const weekday = WEEKDAYS_PT[dateObj.getDay()];
    const dayNum = dateObj.getDate();
    const monthName = MONTHS_PT[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    const fTimeStart = formatTime(time_start);
    const fTimeEnd = formatTime(time_end);

    // Build metadata for the HTML card
    const metadata = {
      user_name: profile.name,
      department_name,
      date,
      time_start,
      time_end,
      old_date: old_date || null,
      sector_name: sector_name || null,
      role_label: assignment_role_label || null,
      notes: notes || null,
      confirmation_token: confirmation_token || null,
    };

    // Build short notification message
    const detailsParts = [sector_name, assignment_role_label].filter(Boolean).join(' - ');
    const detailsSuffix = detailsParts ? ` | ${detailsParts}` : '';
    const notificationMessage = type === 'new_schedule'
      ? `${department_name}: ${weekday}, ${dayNum}/${monthName.slice(0,3).toLowerCase()} às ${fTimeStart}${detailsSuffix}`
      : `Escala alterada: ${department_name} ${weekday}, ${dayNum}/${monthName.slice(0,3).toLowerCase()} às ${fTimeStart}${detailsSuffix}`;

    // Insert notification with metadata
    const { data: notifRecord, error: notifError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id,
        department_id,
        type,
        message: notificationMessage,
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata,
      } as any)
      .select('id')
      .single();

    if (notifError) {
      console.error("Error creating notification:", notifError);
    }

    // Send WhatsApp with link to card
    let whatsappSent = false;
    if (profile.whatsapp && notifRecord) {
      const viewUrl = `${SUPABASE_URL}/functions/v1/view-notification?id=${notifRecord.id}`;

      const whatsappMessage = type === 'new_schedule'
        ? `📅 *Nova Escala — ${department_name}*\n\nOlá, *${profile.name}*! 👋\nVocê foi escalado(a).\n\n📆 ${weekday}, ${dayNum} de ${monthName} de ${year}\n⏰ ${fTimeStart} às ${fTimeEnd}\n${sector_name ? `📍 ${sector_name}\n` : ''}${assignment_role_label ? `💼 ${assignment_role_label}\n` : ''}\n👉 Ver detalhes completos:\n${viewUrl}\n\n_LEVI — Escalas Inteligentes_`
        : `⚠️ *Escala Alterada — ${department_name}*\n\nOlá, *${profile.name}*! 👋\nSua escala foi alterada.\n\n📆 ${weekday}, ${dayNum} de ${monthName} de ${year}\n⏰ ${fTimeStart} às ${fTimeEnd}\n\n👉 Ver detalhes completos:\n${viewUrl}\n\n_LEVI — Escalas Inteligentes_`;

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
          },
          body: JSON.stringify({ phone: profile.whatsapp, message: whatsappMessage }),
        });
        const data = await res.json();
        whatsappSent = data.sent === true;
      } catch (e) {
        console.error("WhatsApp error:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, whatsapp: whatsappSent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
