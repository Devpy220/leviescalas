// =====================================================================
// Testes automatizados de Row Level Security (RLS)
// =====================================================================
// Valida que usuários anônimos NÃO conseguem ler dados sensíveis de
// nenhuma tabela crítica do schema public. Cada tabela aqui é uma
// fronteira de segurança — se algum SELECT retornar dados sem auth,
// o teste falha imediatamente.
//
// Como rodar:
//   deno test --allow-env --allow-net --allow-read supabase/tests/rls.test.ts
//
// Requer VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env raiz.
// =====================================================================

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Faltam VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY no .env");
}

// Cliente anônimo (sem JWT) — simula um atacante externo.
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Tabelas que NÃO devem vazar nenhuma linha para usuários anônimos.
 * Resultado esperado: data vazio OU erro de permissão.
 */
const PRIVATE_TABLES = [
  "profiles",
  "members",
  "schedules",
  "notifications",
  "schedule_swaps",
  "member_availability",
  "member_date_availability",
  "member_preferences",
  "user_roles",
  "whatsapp_logs",
  "whatsapp_queue",
  "whatsapp_swap_sessions",
  "login_logs",
  "billing_access_audit",
  "profile_access_audit",
  "webauthn_credentials",
  "webauthn_challenges",
  "calendar_sync_tokens",
  "push_subscriptions",
  "pushalert_subscribers",
  "telegram_links",
  "telegram_link_codes",
  "payment_receipts",
  "schedule_reminders_sent",
  "slot_notes",
  "repertorio",
  "escala_repertorio",
  "department_announcements",
  "announcement_reads",
  "department_coordinators",
  "blackout_collection_prompts",
  "admin_broadcasts",
];

for (const table of PRIVATE_TABLES) {
  Deno.test(`RLS: anon NÃO pode ler '${table}'`, async () => {
    const { data, error } = await anon.from(table).select("*").limit(5);
    // Aceita: erro de permissão OU lista vazia. NUNCA aceita linhas.
    if (error) {
      assert(
        /permission|denied|policy|not.*allowed|JWT/i.test(error.message),
        `Erro inesperado em '${table}': ${error.message}`,
      );
      return;
    }
    assertEquals(
      data?.length ?? 0,
      0,
      `🚨 VAZAMENTO RLS em '${table}': retornou ${data?.length} linha(s) sem autenticação!`,
    );
  });
}

/**
 * Tabelas que PODEM ter leitura pública (legítima), mas nunca devem
 * expor campos sensíveis. Apenas verificamos que a query não quebra
 * e que campos sensíveis não estão presentes.
 */
const PUBLIC_BUT_LIMITED = [
  // Igrejas têm página pública via slug, mas o stripe_customer_id, etc.,
  // NÃO devem aparecer quando lido pelo anon.
  { table: "churches", forbiddenFields: ["stripe_customer_id", "stripe_subscription_id"] },
  // Departments tem invite_code (sensível). Anon não deve ver invite_code.
  { table: "departments", forbiddenFields: ["invite_code", "coordinator_invite_code", "stripe_customer_id", "stripe_subscription_id"] },
];

for (const { table, forbiddenFields } of PUBLIC_BUT_LIMITED) {
  Deno.test(`RLS: anon não recebe campos sensíveis de '${table}'`, async () => {
    const { data, error } = await anon.from(table).select("*").limit(3);
    if (error) {
      // Bloqueio total também é aceitável.
      assert(/permission|denied|policy/i.test(error.message), error.message);
      return;
    }
    for (const row of data ?? []) {
      for (const field of forbiddenFields) {
        const val = (row as Record<string, unknown>)[field];
        assert(
          val === undefined || val === null,
          `🚨 '${table}' expõe campo sensível '${field}' = ${JSON.stringify(val)} para anon`,
        );
      }
    }
  });
}

/**
 * INSERTs anônimos não devem ser permitidos em tabelas críticas
 * (mesmo com user_id forjado).
 */
const INSERT_FORBIDDEN_TABLES = [
  { table: "user_roles", payload: { user_id: "00000000-0000-0000-0000-000000000001", role: "admin" } },
  { table: "members", payload: { user_id: "00000000-0000-0000-0000-000000000001", department_id: "00000000-0000-0000-0000-000000000001", role: "leader" } },
  { table: "schedules", payload: { user_id: "00000000-0000-0000-0000-000000000001", department_id: "00000000-0000-0000-0000-000000000001", date: "2030-01-01", time_start: "08:00", time_end: "10:00" } },
  { table: "whatsapp_logs", payload: { phone: "0", message: "x", status: "sent" } },
  { table: "notifications", payload: { user_id: "00000000-0000-0000-0000-000000000001", type: "test", message: "x" } },
  { table: "admin_broadcasts", payload: { title: "x", message: "x" } },
];

for (const { table, payload } of INSERT_FORBIDDEN_TABLES) {
  Deno.test(`RLS: anon NÃO pode INSERIR em '${table}'`, async () => {
    const { data, error } = await anon.from(table).insert(payload).select();
    assert(
      error !== null,
      `🚨 anon conseguiu INSERIR em '${table}'! Linha criada: ${JSON.stringify(data)}`,
    );
    assert(
      /permission|denied|policy|violates|JWT|not.*allowed|null value/i.test(error!.message),
      `Erro inesperado em INSERT '${table}': ${error!.message}`,
    );
  });
}

/**
 * Funções SECURITY DEFINER que recebem código de convite NÃO devem
 * expor IDs internos para o anon — apenas validade + nome.
 */
Deno.test("RPC: validate_invite_code_secure não vaza ID", async () => {
  const { data, error } = await anon.rpc("validate_invite_code_secure", { code: "codigo-invalido-xyz" });
  assertEquals(error, null);
  const row = Array.isArray(data) ? data[0] : data;
  assertEquals(row?.is_valid, false);
  assert(!("id" in (row ?? {})), "Função não pode retornar 'id'");
});

Deno.test("RPC: validate_church_code_secure não vaza ID", async () => {
  const { data, error } = await anon.rpc("validate_church_code_secure", { p_code: "ZZZZZZZZ" });
  assertEquals(error, null);
  const row = Array.isArray(data) ? data[0] : data;
  assertEquals(row?.is_valid, false);
  assert(!("id" in (row ?? {})), "Função não pode retornar 'id'");
});

Deno.test("RPC: join_department_by_invite exige auth", async () => {
  const { data } = await anon.rpc("join_department_by_invite", { invite_code: "xxx" });
  const row = Array.isArray(data) ? data[0] : data;
  assertEquals(row?.success, false);
});
