import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    console.log("Telegram webhook received:", JSON.stringify(body));

    const message = body.message;
    if (!message?.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const username = message.from?.username || null;

    const sendTelegramMessage = async (chatId: number, text: string) => {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
      });
    };

    // Handle /start CODIGO command
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      
      if (parts.length < 2) {
        await sendTelegramMessage(chatId,
          "👋 Olá! Eu sou o bot do *LEVI Escalas*.\n\n" +
          "Para vincular sua conta, gere um código no app LEVI (Segurança > Telegram) e envie:\n" +
          "`/start SEU_CODIGO`"
        );
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const code = parts[1].trim().toUpperCase();

      // Find the code in database
      const { data: linkCode, error: codeError } = await supabase
        .from("telegram_link_codes")
        .select("*")
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (codeError || !linkCode) {
        await sendTelegramMessage(chatId,
          "❌ Código inválido ou expirado.\n\nGere um novo código no app LEVI e tente novamente."
        );
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Mark code as used
      await supabase
        .from("telegram_link_codes")
        .update({ used: true })
        .eq("id", linkCode.id);

      // Upsert telegram link
      const { error: linkError } = await supabase
        .from("telegram_links")
        .upsert({
          user_id: linkCode.user_id,
          chat_id: chatId,
          username,
          is_active: true,
          linked_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (linkError) {
        console.error("Error linking telegram:", linkError);
        await sendTelegramMessage(chatId,
          "❌ Erro ao vincular conta. Tente novamente mais tarde."
        );
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Get user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", linkCode.user_id)
        .single();

      await sendTelegramMessage(chatId,
        `✅ Conta vinculada com sucesso!\n\n` +
        `Olá, *${profile?.name || "voluntário"}*! Você receberá notificações de escalas aqui.\n\n` +
        `Para desvincular, envie /parar`
      );

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Handle /parar command
    if (text === "/parar") {
      const { data: link } = await supabase
        .from("telegram_links")
        .select("id")
        .eq("chat_id", chatId)
        .eq("is_active", true)
        .single();

      if (!link) {
        await sendTelegramMessage(chatId,
          "ℹ️ Nenhuma conta vinculada a este chat."
        );
      } else {
        await supabase
          .from("telegram_links")
          .update({ is_active: false })
          .eq("id", link.id);

        await sendTelegramMessage(chatId,
          "✅ Conta desvinculada. Você não receberá mais notificações.\n\nPara vincular novamente, gere um novo código no app LEVI."
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Default response
    await sendTelegramMessage(chatId,
      "🤖 Comandos disponíveis:\n\n" +
      "`/start CODIGO` - Vincular conta LEVI\n" +
      "`/parar` - Desvincular conta"
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
