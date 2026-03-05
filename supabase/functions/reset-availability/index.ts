import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate the current month start date (always day 1)
function getCurrentPeriodStart(): string {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return periodStart.toISOString().split('T')[0];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const currentPeriodStart = getCurrentPeriodStart();
    console.log(`Current period start: ${currentPeriodStart}`);

    const { data, error } = await supabase
      .from('member_availability')
      .delete()
      .lt('period_start', currentPeriodStart)
      .select('id');

    if (error) {
      console.error('Error deleting old availability:', error);
      throw error;
    }

    const deletedCount = data?.length || 0;
    console.log(`Deleted ${deletedCount} old availability records`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reset complete. Deleted ${deletedCount} availability records from previous months.`,
        currentPeriodStart,
        deletedCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in reset-availability:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
