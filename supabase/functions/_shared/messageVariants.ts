// Shared message variation helpers to humanize WhatsApp content.
// Same meaning, different wording — reduces spam-flagging on Z-API.

export const INSTAGRAM_LINK = "https://instagram.com/elsdigital_tech";

// Quick guide so volunteers know which words the LEVI bot understands.
// Outside of these keywords (or a recent reply to a LEVI prompt), the bot stays quiet.
export const LEVI_COMMANDS_HINT =
  `🤖 *Palavras que eu entendo (LEVI Escalas):*\n` +
  `• *escala* — ver suas próximas escalas\n` +
  `• *troca* — pedir troca de uma escala\n` +
  `• *apoiar* — link e PIX para apoiar o LEVI\n` +
  `• *bloqueios* — ver seus bloqueios do próximo mês\n` +
  `• *desbloquear* / *voltar* — se seu líder te bloqueou, você volta a ficar disponível\n` +
  `• *ajuda* / *comandos* — ver esta lista de novo\n` +
  `\n📅 *No aviso mensal de disponibilidade, responda com:*\n` +
  `• *bloquear 5/7, 12/7* — bloqueia datas específicas\n` +
  `• *bloquear segundas* / *terças* / *quartas* / *quintas* / *sextas* / *sábados* / *domingos* — bloqueia todos esses dias no próximo mês\n` +
  `• *bloquear domingos de manhã* / *bloquear domingos de noite* — só o turno\n` +
  `• *servir segundas* … *servir domingos* — só vou servir nesse dia da semana\n` +
  `• *servir 18/7, 25/7* — só vou servir nesses dias\n` +
  `• *nenhum* — liberar todos os dias do mês\n` +
  `\n⏳ Os comandos de *bloquear* e *servir* valem até o *último dia do mês em curso*. Depois disso o próximo mês reabre.\n` +
  `\n_Fora dessas palavras (ou de uma resposta direta a uma mensagem minha) eu fico quieto._`;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function pickVariant<T>(seed: string, options: T[]): T {
  if (!options.length) throw new Error("No options");
  const idx = hashString(seed) % options.length;
  return options[idx];
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Variations ---

export const GREETINGS = ["Olá", "Oi", "Opa", "E aí"];

export const CLOSINGS = [
  "_LEVI — Escalas Inteligentes_",
  "_Até lá! — LEVI_",
  "_Nos vemos lá! — LEVI_",
  "_Abraço! — LEVI_",
];

export const ANNOUNCEMENT_EMOJIS = ["📢", "📣", "🔔", "📌"];
export const SCHEDULE_EMOJIS = ["📅", "🗓️", "⏰", "✅"];
export const REMINDER_EMOJIS = ["⏰", "🔔", "📅", "⏳"];
export const BROADCAST_EMOJIS = ["📢", "📣", "💬"];
export const SUPPORT_EMOJIS = ["❤️", "🙏", "💝", "✨"];

// ─────────────────────────────────────────────────────────────
// Split-message helpers (msg principal + apoio + comandos).
// The main-message builders below do NOT include commands hint,
// Instagram or support block — those go in separate follow-ups.
// ─────────────────────────────────────────────────────────────

export function buildSupportOnlyMessage(userName: string): string {
  const first = (userName || "").split(/\s+/)[0] || "amigo(a)";
  return (
`💛 *Apoie o LEVI, ${first}!*
━━━━━━━━━━━━━━━━━━━━

O LEVI é gratuito e depende do seu apoio para continuar no ar.

💡 *Sugestão: R$ 25,00* (você escolhe o valor)

👉 https://leviescalas.com.br/apoiar
_(PIX com 1 clique, cartão ou assinatura mensal)_

🙏 Obrigado pelo carinho!`
  );
}

export function buildCommandsOnlyMessage(): string {
  return LEVI_COMMANDS_HINT;
}

// Build an announcement message (main content only — no hint / IG / support)
export function buildAnnouncementMessage(params: {
  userId: string;
  userName: string;
  deptName: string;
  title: string;
  today?: string;
}): string {
  const seed = `${params.userId}-${params.today ?? new Date().toISOString().slice(0, 10)}-ann`;
  const emoji = pickVariant(seed + "e", ANNOUNCEMENT_EMOJIS);
  const greeting = pickVariant(seed + "g", GREETINGS);
  const closing = pickVariant(seed + "c", CLOSINGS);
  return `${emoji} *Aviso — ${params.deptName}*\n\n${greeting}, *${params.userName}*!\n\n${params.title}\n\n${closing}`;
}

export function buildBroadcastMessage(params: {
  userId: string;
  userName: string;
  title: string;
  message: string;
  today?: string;
}): string {
  const seed = `${params.userId}-${params.today ?? new Date().toISOString().slice(0, 10)}-brd`;
  const emoji = pickVariant(seed + "e", BROADCAST_EMOJIS);
  const greeting = pickVariant(seed + "g", GREETINGS);
  const closing = pickVariant(seed + "c", CLOSINGS);
  return `${emoji} *Comunicado LEVI*\n\n${greeting}, *${params.userName}*!\n\n*${params.title}*\n\n${params.message}\n\n${closing}`;
}

// Kept for back-compat; the primary support flow now uses buildSupportOnlyMessage.
export function buildSupportMessage(params: {
  userId: string;
  userName: string;
  pixKey: string;
  titular: string;
  today?: string;
}): string {
  return buildSupportOnlyMessage(params.userName);
}
