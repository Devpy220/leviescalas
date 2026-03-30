import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Availability is now permanent (fixed weekly slots).
  // This function is kept as a no-op for backward compatibility.
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Availability is now permanent. No reset needed.',
      deletedCount: 0,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
});
