// Shared message variation helpers to humanize WhatsApp content.
// Same meaning, different wording — reduces spam-flagging on Z-API.

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

export const SCHEDULE_CONNECTORS = [
  "você foi escalado para",
  "sua escala foi marcada para",
  "você está na escala de",
  "você tem uma escala em",
];

// Build a humanized announcement message
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

export function buildSupportMessage(params: {
  userId: string;
  userName: string;
  pixKey: string;
  titular: string;
  today?: string;
}): string {
  const seed = `${params.userId}-${params.today ?? new Date().toISOString().slice(0, 10)}-sup`;
  const emoji = pickVariant(seed + "e", SUPPORT_EMOJIS);
  const greeting = pickVariant(seed + "g", GREETINGS);
  const closing = pickVariant(seed + "c", CLOSINGS);
  return `${emoji} *Apoie o LEVI*\n\n${greeting}, *${params.userName}*!\n\nO LEVI é gratuito e depende do seu apoio para continuar funcionando. Qualquer valor faz a diferença!\n\n💛 *Toque no link abaixo para copiar a chave PIX com 1 clique:*\n\n👉 https://leviescalas.com.br/apoiar\n\n_(QR Code, chave PIX e opção de cartão disponíveis na página)_\n\n👤 *Titular:* ${params.titular}\n\n🙏 Obrigado pelo carinho!\n\n${closing}`;
}
