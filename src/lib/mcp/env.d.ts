// Ambient types for MCP tool files bundled into the Supabase Edge Function.
// The tools run under Deno's Node compatibility layer where `process.env` exists.
declare const process: { env: Record<string, string | undefined> };
