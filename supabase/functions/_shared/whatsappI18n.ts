// WhatsApp message localization based on phone country code (DDI).
// Used by zapi-webhook-receive (escala/troca commands).

export type Lang = "pt" | "es" | "en";

// Country dial codes mapped to language.
// Default fallback is "en" (English) for any unmatched DDI.
const PT_PREFIXES = ["55", "351"]; // Brasil, Portugal
const ES_PREFIXES = [
  "34", // Spain
  "54", "56", "57", "52", "51", "58", "53",
  "591", "593", "595", "598",
  "502", "503", "504", "505", "506", "507",
];

export function detectLang(phone: string): Lang {
  const digits = (phone || "").replace(/\D/g, "");
  // Try longest prefix first (3 digits then 2)
  for (const len of [3, 2]) {
    const pre = digits.slice(0, len);
    if (PT_PREFIXES.includes(pre)) return "pt";
    if (ES_PREFIXES.includes(pre)) return "es";
  }
  return "en";
}

export const DOW: Record<Lang, string[]> = {
  pt: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

export function fmtDateLang(iso: string, lang: Lang): string {
  const d = new Date(iso + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm} (${DOW[lang][d.getDay()]})`;
}

export function fmtTime(t: string): string {
  return (t || "").slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────
// Translations
// ─────────────────────────────────────────────────────────────────────

type TParams = Record<string, string | number>;
const interp = (s: string, p: TParams = {}) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? ""));

const STR: Record<Lang, Record<string, string>> = {
  pt: {
    no_future_schedules: "📭 *Olá {fname}!*\n\nVocê não tem escalas futuras agendadas no momento.\n\n_LEVI_",
    list_header: "📅 *Olá {fname}!* Suas próximas escalas:\n━━━━━━━━━━━━━━━━━━━━\n",
    list_footer: "\n━━━━━━━━━━━━━━━━━━━━\nPara trocar uma escala, envie *troca*.\n\n_LEVI_",
    no_active_dept: "Olá *{fname}*! Você não está em nenhum departamento ativo.\n\n_LEVI_",
    no_swap_schedules: "Olá *{fname}*! Você não tem escalas futuras para trocar.\n\n_LEVI_",
    swap_start_title: "🔄 *Troca de Escala*",
    swap_start_intro: "Olá *{fname}*! 👋\n\n📖 _Leia com atenção:_\nQual escala você quer trocar? Responda com o *número* correspondente.",
    swap_start_list_title: "📆 *Suas próximas escalas:*",
    swap_start_footer: "✍️ Responda com o *número* da escala\n   (ou envie \"cancelar\")",
    swap_pick_invalid: "Número inválido. Responda entre 1 e {max}, ou \"cancelar\".\n\n_LEVI_",
    swap_not_found: "Escala não encontrada. Envie \"troca\" para começar de novo.\n\n_LEVI_",
    swap_no_candidates: "❌ Nenhum colega disponível para trocar essa escala.\nFale com seu líder para resolver.\n\n_LEVI_",
    swap_target_title: "🔄 *Escolha o colega*",
    swap_target_intro: "📖 _Leia com atenção:_\n\nVocê quer trocar a escala:\n📆 *{date}*\n⏰ {ts}-{te}",
    swap_target_list_title: "👥 *Com quem você quer trocar?*",
    swap_target_footer: "✍️ Responda com o *número* (ou \"cancelar\").",
    swap_request_title: "🔄 *Pedido de Troca de Escala*",
    swap_request_body: "Oi *{tgt}*! 👋\n\n📖 *Leia com atenção, por favor.*\n\n*{req}* pediu para trocar de escala com você no departamento *{dept}*.",
    swap_assume_yours: "📥 *Você assumiria:*\n   📆 {date}\n   ⏰ {ts}-{te}",
    swap_assume_theirs: "📤 *{req} assume a sua:*\n   📆 {date}\n   ⏰ {ts}-{te}",
    swap_request_actions: "✍️ *Responda agora:*\n   ✅ *\"sim\"* — para aceitar\n   ❌ *\"não\"* — para recusar",
    swap_sent: "✉️ *Solicitação enviada!*\n━━━━━━━━━━━━━━━━━━━━\n\nPedido enviado para *{tgt}*.\n\n⏳ Aguarde a resposta — assim que {tgt} responder, eu te aviso aqui.\n\n_LEVI_",
    swap_confirmed_target: "✅ *Troca confirmada!*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Leia com atenção:_\nSuas escalas já foram *atualizadas* no sistema.\n\n_LEVI_",
    swap_confirmed_requester: "✅ *Troca confirmada!*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Leia com atenção:_\n*{tgt}* aceitou a troca. Suas escalas já foram *atualizadas*.\n\n_LEVI_",
    swap_rejected: "Tudo bem, *recusa registrada*. Obrigado por responder! 🙏\n\n_LEVI_",
    swap_no_substitute: "❌ *Não encontramos substituto*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Leia com atenção:_\nTentei *{n} colega(s)* e ninguém pôde trocar com você.\n\n👉 Por favor, *fale com seu líder* para resolver essa escala.\n\n_LEVI_",
    swap_cancelled: "Troca cancelada.\n\n_LEVI_",
    swap_invalid_pick: "Não entendi. Responda com um *número* da lista, ou \"cancelar\".\n\n_LEVI_",
    swap_yes_no: "Responda *\"sim\"* ou *\"não\"* para a troca.\n\n_LEVI_",
    swap_error: "❌ Erro ao concluir a troca. Avise seu líder.\n\n_LEVI_",
    swap_error_with: "❌ Erro ao concluir a troca com {name}. Avise seu líder.\n\n_LEVI_",
    swap_error_create: "Erro ao criar a solicitação. Tente novamente mais tarde.\n\n_LEVI_",
    leader_alert: "🔔 *Atenção, líder!*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Leia com atenção:_\n\n*{name}* tentou trocar a escala de *{date}* no departamento *{dept}* pelo WhatsApp, mas *não encontrou substituto*.\n\n👉 Por favor, ajude a resolver essa escala.\n\n_LEVI_",
    line_schedule: "*{i})* {date} {ts}-{te}\n     {dept}",
    line_target: "*{i})* {name}\n     escala em {date} {ts}-{te}",
  },
  es: {
    no_future_schedules: "📭 *¡Hola {fname}!*\n\nNo tienes turnos futuros programados en este momento.\n\n_LEVI_",
    list_header: "📅 *¡Hola {fname}!* Tus próximos turnos:\n━━━━━━━━━━━━━━━━━━━━\n",
    list_footer: "\n━━━━━━━━━━━━━━━━━━━━\nPara cambiar un turno, envía *cambio*.\n\n_LEVI_",
    no_active_dept: "¡Hola *{fname}*! No estás en ningún departamento activo.\n\n_LEVI_",
    no_swap_schedules: "¡Hola *{fname}*! No tienes turnos futuros para cambiar.\n\n_LEVI_",
    swap_start_title: "🔄 *Cambio de Turno*",
    swap_start_intro: "¡Hola *{fname}*! 👋\n\n📖 _Lee con atención:_\n¿Qué turno quieres cambiar? Responde con el *número* correspondiente.",
    swap_start_list_title: "📆 *Tus próximos turnos:*",
    swap_start_footer: "✍️ Responde con el *número* del turno\n   (o envía \"cancelar\")",
    swap_pick_invalid: "Número inválido. Responde entre 1 y {max}, o \"cancelar\".\n\n_LEVI_",
    swap_not_found: "Turno no encontrado. Envía \"cambio\" para empezar de nuevo.\n\n_LEVI_",
    swap_no_candidates: "❌ Ningún compañero disponible para cambiar este turno.\nHabla con tu líder para resolverlo.\n\n_LEVI_",
    swap_target_title: "🔄 *Elige al compañero*",
    swap_target_intro: "📖 _Lee con atención:_\n\nQuieres cambiar el turno:\n📆 *{date}*\n⏰ {ts}-{te}",
    swap_target_list_title: "👥 *¿Con quién quieres cambiar?*",
    swap_target_footer: "✍️ Responde con el *número* (o \"cancelar\").",
    swap_request_title: "🔄 *Solicitud de Cambio de Turno*",
    swap_request_body: "¡Hola *{tgt}*! 👋\n\n📖 *Lee con atención, por favor.*\n\n*{req}* pidió cambiar de turno contigo en el departamento *{dept}*.",
    swap_assume_yours: "📥 *Tú asumirías:*\n   📆 {date}\n   ⏰ {ts}-{te}",
    swap_assume_theirs: "📤 *{req} asume el tuyo:*\n   📆 {date}\n   ⏰ {ts}-{te}",
    swap_request_actions: "✍️ *Responde ahora:*\n   ✅ *\"sí\"* — para aceptar\n   ❌ *\"no\"* — para rechazar",
    swap_sent: "✉️ *¡Solicitud enviada!*\n━━━━━━━━━━━━━━━━━━━━\n\nPedido enviado a *{tgt}*.\n\n⏳ Espera la respuesta — apenas {tgt} responda, te aviso aquí.\n\n_LEVI_",
    swap_confirmed_target: "✅ *¡Cambio confirmado!*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Lee con atención:_\nTus turnos ya fueron *actualizados* en el sistema.\n\n_LEVI_",
    swap_confirmed_requester: "✅ *¡Cambio confirmado!*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Lee con atención:_\n*{tgt}* aceptó el cambio. Tus turnos ya fueron *actualizados*.\n\n_LEVI_",
    swap_rejected: "Está bien, *rechazo registrado*. ¡Gracias por responder! 🙏\n\n_LEVI_",
    swap_no_substitute: "❌ *No encontramos sustituto*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Lee con atención:_\nIntenté con *{n} compañero(s)* y nadie pudo cambiar contigo.\n\n👉 Por favor, *habla con tu líder* para resolver este turno.\n\n_LEVI_",
    swap_cancelled: "Cambio cancelado.\n\n_LEVI_",
    swap_invalid_pick: "No entendí. Responde con un *número* de la lista, o \"cancelar\".\n\n_LEVI_",
    swap_yes_no: "Responde *\"sí\"* o *\"no\"* al cambio.\n\n_LEVI_",
    swap_error: "❌ Error al concluir el cambio. Avísale a tu líder.\n\n_LEVI_",
    swap_error_with: "❌ Error al concluir el cambio con {name}. Avísale a tu líder.\n\n_LEVI_",
    swap_error_create: "Error al crear la solicitud. Intenta nuevamente más tarde.\n\n_LEVI_",
    leader_alert: "🔔 *¡Atención, líder!*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Lee con atención:_\n\n*{name}* intentó cambiar el turno del *{date}* en el departamento *{dept}* por WhatsApp, pero *no encontró sustituto*.\n\n👉 Por favor, ayuda a resolver este turno.\n\n_LEVI_",
    line_schedule: "*{i})* {date} {ts}-{te}\n     {dept}",
    line_target: "*{i})* {name}\n     turno el {date} {ts}-{te}",
  },
  en: {
    no_future_schedules: "📭 *Hi {fname}!*\n\nYou have no upcoming shifts scheduled at the moment.\n\n_LEVI_",
    list_header: "📅 *Hi {fname}!* Your upcoming shifts:\n━━━━━━━━━━━━━━━━━━━━\n",
    list_footer: "\n━━━━━━━━━━━━━━━━━━━━\nTo swap a shift, send *swap*.\n\n_LEVI_",
    no_active_dept: "Hi *{fname}*! You're not in any active department.\n\n_LEVI_",
    no_swap_schedules: "Hi *{fname}*! You have no upcoming shifts to swap.\n\n_LEVI_",
    swap_start_title: "🔄 *Shift Swap*",
    swap_start_intro: "Hi *{fname}*! 👋\n\n📖 _Read carefully:_\nWhich shift would you like to swap? Reply with the matching *number*.",
    swap_start_list_title: "📆 *Your upcoming shifts:*",
    swap_start_footer: "✍️ Reply with the shift *number*\n   (or send \"cancel\")",
    swap_pick_invalid: "Invalid number. Reply between 1 and {max}, or \"cancel\".\n\n_LEVI_",
    swap_not_found: "Shift not found. Send \"swap\" to start again.\n\n_LEVI_",
    swap_no_candidates: "❌ No teammate available to swap this shift.\nTalk to your leader to resolve it.\n\n_LEVI_",
    swap_target_title: "🔄 *Pick a teammate*",
    swap_target_intro: "📖 _Read carefully:_\n\nYou want to swap the shift:\n📆 *{date}*\n⏰ {ts}-{te}",
    swap_target_list_title: "👥 *Who do you want to swap with?*",
    swap_target_footer: "✍️ Reply with the *number* (or \"cancel\").",
    swap_request_title: "🔄 *Shift Swap Request*",
    swap_request_body: "Hi *{tgt}*! 👋\n\n📖 *Please read carefully.*\n\n*{req}* asked to swap shifts with you in the *{dept}* department.",
    swap_assume_yours: "📥 *You would take:*\n   📆 {date}\n   ⏰ {ts}-{te}",
    swap_assume_theirs: "📤 *{req} takes yours:*\n   📆 {date}\n   ⏰ {ts}-{te}",
    swap_request_actions: "✍️ *Reply now:*\n   ✅ *\"yes\"* — to accept\n   ❌ *\"no\"* — to decline",
    swap_sent: "✉️ *Request sent!*\n━━━━━━━━━━━━━━━━━━━━\n\nRequest sent to *{tgt}*.\n\n⏳ Wait for the reply — as soon as {tgt} responds, I'll let you know here.\n\n_LEVI_",
    swap_confirmed_target: "✅ *Swap confirmed!*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Read carefully:_\nYour shifts have been *updated* in the system.\n\n_LEVI_",
    swap_confirmed_requester: "✅ *Swap confirmed!*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Read carefully:_\n*{tgt}* accepted the swap. Your shifts have been *updated*.\n\n_LEVI_",
    swap_rejected: "All good, *decline recorded*. Thanks for replying! 🙏\n\n_LEVI_",
    swap_no_substitute: "❌ *No substitute found*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Read carefully:_\nI tried *{n} teammate(s)* and nobody could swap with you.\n\n👉 Please *talk to your leader* to resolve this shift.\n\n_LEVI_",
    swap_cancelled: "Swap cancelled.\n\n_LEVI_",
    swap_invalid_pick: "I didn't get that. Reply with a *number* from the list, or \"cancel\".\n\n_LEVI_",
    swap_yes_no: "Reply *\"yes\"* or *\"no\"* to the swap.\n\n_LEVI_",
    swap_error: "❌ Error completing the swap. Notify your leader.\n\n_LEVI_",
    swap_error_with: "❌ Error completing the swap with {name}. Notify your leader.\n\n_LEVI_",
    swap_error_create: "Error creating the request. Please try again later.\n\n_LEVI_",
    leader_alert: "🔔 *Attention, leader!*\n━━━━━━━━━━━━━━━━━━━━\n\n📖 _Read carefully:_\n\n*{name}* tried to swap the shift on *{date}* in the *{dept}* department via WhatsApp, but *no substitute was found*.\n\n👉 Please help resolve this shift.\n\n_LEVI_",
    line_schedule: "*{i})* {date} {ts}-{te}\n     {dept}",
    line_target: "*{i})* {name}\n     shift on {date} {ts}-{te}",
  },
};

export function t(lang: Lang, key: string, params: TParams = {}): string {
  const s = STR[lang]?.[key] ?? STR.pt[key] ?? key;
  const result = interp(s, params);
  // Add Instagram link before _LEVI_ closing in all WhatsApp messages
  if (result.includes("\n\n_LEVI_")) {
    return result.replace("\n\n_LEVI_", `\n\n📲 Siga o LEVI no Instagram:\nhttps://www.instagram.com/levi_escalas\n\n_LEVI_`);
  }
  return result;
}

// Multi-language keyword detection
export function isSwapInitiationMulti(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length > 40) return false;
  return /^(troca|trocar|cambio|cambiar|swap|change)\b/.test(t);
}

export function isScheduleListCommand(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[!.?]+$/, "");
  return [
    "escala", "escalas", "minhas escalas",
    "turno", "turnos", "mis turnos",
    "shift", "shifts", "my shifts", "schedule", "my schedule",
  ].includes(t);
}

export function isCancelMulti(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ["cancelar", "cancela", "sair", "cancel", "exit", "stop"].includes(t);
}

export function isYesMulti(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ["sim", "s", "aceito", "ok", "claro", "pode", "yes", "y", "sí", "si", "acepto"].includes(t);
}

export function isNoMulti(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ["nao", "não", "n", "negativo", "no", "recuso", "rechazo"].includes(t);
}
