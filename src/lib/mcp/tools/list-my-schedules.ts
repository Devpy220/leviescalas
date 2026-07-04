import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_upcoming_schedules",
  title: "List my upcoming schedules",
  description: "Lista as próximas escalas (schedules) do usuário autenticado, ordenadas por data.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Máximo de escalas a retornar (padrão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("schedules")
      .select("id, date, time_start, time_end, department_id, assignment_role, notes")
      .eq("user_id", ctx.getUserId())
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(limit);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { schedules: data ?? [] },
    };
  },
});
