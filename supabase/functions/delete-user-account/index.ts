import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const userId = "85c9f5d3-2ed1-4067-b67a-eac8d71d0f3e";

  // Delete all related data
  const tables = [
    { table: "schedule_reminders_sent", col: "schedule_id", sub: true },
    { table: "schedule_swaps", col: "requester_user_id" },
    { table: "schedule_swaps", col: "target_user_id" },
    { table: "notifications", col: "user_id" },
    { table: "schedules", col: "user_id" },
    { table: "member_availability", col: "user_id" },
    { table: "member_date_availability", col: "user_id" },
    { table: "member_preferences", col: "user_id" },
    { table: "members", col: "user_id" },
    { table: "push_subscriptions", col: "user_id" },
    { table: "pushalert_subscribers", col: "user_id" },
    { table: "telegram_links", col: "user_id" },
    { table: "telegram_link_codes", col: "user_id" },
    { table: "billing_access_audit", col: "user_id" },
    { table: "profile_access_audit", col: "accessor_user_id" },
    { table: "profile_access_audit", col: "accessed_profile_id" },
    { table: "payment_receipts", col: "user_id" },
    { table: "calendar_sync_tokens", col: "user_id" },
    { table: "announcement_reads", col: "user_id" },
    { table: "login_logs", col: "user_id" },
    { table: "user_roles", col: "user_id" },
    { table: "page_views", col: "session_id", skip: true },
    { table: "profiles", col: "id" },
  ];

  const results: string[] = [];

  for (const t of tables) {
    if (t.skip) continue;
    const { error } = await supabase.from(t.table).delete().eq(t.col, userId);
    results.push(`${t.table}.${t.col}: ${error ? error.message : "ok"}`);
  }

  // Delete from auth
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  results.push(`auth.users: ${authError ? authError.message : "ok"}`);

  return new Response(JSON.stringify({ results }, null, 2));
});
