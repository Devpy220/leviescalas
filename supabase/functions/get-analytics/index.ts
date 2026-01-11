import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get real analytics from page_views table - last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: pageViews, error: pvError } = await supabase
      .from("page_views")
      .select("created_at, session_id, page_path")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true });

    if (pvError) {
      console.error("Error fetching page views:", pvError);
      throw pvError;
    }

    // Group by date
    const dailyData: Record<string, { visitors: Set<string>; pageviews: number }> = {};
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyData[dateStr] = { visitors: new Set(), pageviews: 0 };
    }

    (pageViews || []).forEach((pv: any) => {
      const dateStr = pv.created_at.split('T')[0];
      if (dailyData[dateStr]) {
        dailyData[dateStr].visitors.add(pv.session_id || 'unknown');
        dailyData[dateStr].pageviews++;
      }
    });

    const formattedData = Object.entries(dailyData).map(([date, data]) => ({
      date,
      visitors: data.visitors.size,
      pageviews: data.pageviews,
    }));

    const totalVisitors = new Set((pageViews || []).map((pv: any) => pv.session_id)).size;
    const totalPageviews = (pageViews || []).length;

    return new Response(
      JSON.stringify({
        totalVisitors,
        totalPageviews,
        avgPageviewsPerVisit: totalVisitors > 0 ? totalPageviews / totalVisitors : 0,
        dailyData: formattedData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
