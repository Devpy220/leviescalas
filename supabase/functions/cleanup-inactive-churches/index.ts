import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Find churches older than 5 days with no departments
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    // Get all churches created more than 5 days ago
    const { data: oldChurches, error: fetchErr } = await serviceClient
      .from("churches")
      .select("id, name, created_at")
      .lt("created_at", fiveDaysAgo);

    if (fetchErr) throw fetchErr;

    if (!oldChurches || oldChurches.length === 0) {
      return new Response(JSON.stringify({ deleted: 0, message: "No inactive churches found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let deletedCount = 0;

    for (const church of oldChurches) {
      // Check if church has any departments
      const { count, error: countErr } = await serviceClient
        .from("departments")
        .select("id", { count: "exact", head: true })
        .eq("church_id", church.id);

      if (countErr) {
        console.error(`Error checking departments for church ${church.id}:`, countErr);
        continue;
      }

      if (count === 0) {
        const { error: deleteErr } = await serviceClient
          .from("churches")
          .delete()
          .eq("id", church.id);

        if (deleteErr) {
          console.error(`Error deleting church ${church.id}:`, deleteErr);
        } else {
          console.log(`Deleted inactive church: ${church.name} (${church.id})`);
          deletedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({ deleted: deletedCount, checked: oldChurches.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("cleanup-inactive-churches error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
