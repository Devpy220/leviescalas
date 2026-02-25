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

    // ===== PAGE VIEWS (last 30 days) =====
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

    // ===== LOGIN LOGS (last 30 days) =====
    const { data: loginLogs, error: llError } = await supabase
      .from("login_logs")
      .select("id, user_id, logged_in_at, user_agent")
      .gte("logged_in_at", thirtyDaysAgo.toISOString())
      .order("logged_in_at", { ascending: false })
      .limit(1000);

    if (llError) {
      console.error("Error fetching login logs:", llError);
    }

    const logs = loginLogs || [];

    // Aggregate login data by day
    const dailyLogins: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dailyLogins[date.toISOString().split('T')[0]] = 0;
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

    let loginsToday = 0;
    let loginsWeek = 0;
    let loginsMonth = 0;

    logs.forEach((l: any) => {
      const dateStr = l.logged_in_at.split('T')[0];
      if (dailyLogins[dateStr] !== undefined) {
        dailyLogins[dateStr]++;
      }
      const logDate = new Date(l.logged_in_at);
      if (dateStr === todayStr) loginsToday++;
      if (logDate >= weekAgo) loginsWeek++;
      if (logDate >= monthAgo) loginsMonth++;
    });

    const dailyLoginData = Object.entries(dailyLogins).map(([date, count]) => ({
      date,
      logins: count,
    }));

    // Get recent logins with user profiles (last 50)
    const recentLogs = logs.slice(0, 50);
    const userIds = [...new Set(recentLogs.map((l: any) => l.user_id))];

    let profileMap: Record<string, { name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      (profiles || []).forEach((p: any) => {
        profileMap[p.id] = { name: p.name, email: p.email };
      });
    }

    const recentLogins = recentLogs.map((l: any) => ({
      id: l.id,
      user_id: l.user_id,
      logged_in_at: l.logged_in_at,
      user_agent: l.user_agent,
      user_name: profileMap[l.user_id]?.name || 'Desconhecido',
      user_email: profileMap[l.user_id]?.email || '',
    }));

    return new Response(
      JSON.stringify({
        totalVisitors,
        totalPageviews,
        avgPageviewsPerVisit: totalVisitors > 0 ? totalPageviews / totalVisitors : 0,
        dailyData: formattedData,
        // Login analytics
        loginsToday,
        loginsWeek,
        loginsMonth,
        dailyLoginData,
        recentLogins,
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
