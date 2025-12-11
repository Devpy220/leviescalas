import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UPDATE-SUBSCRIPTION-QUANTITY] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { departmentId } = await req.json();
    if (!departmentId) throw new Error("Department ID is required");
    if (typeof departmentId !== "string" || !departmentId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      throw new Error("Invalid department ID format");
    }
    logStep("Department ID received", { departmentId });

    // Verify user is the department leader
    const { data: department, error: deptError } = await supabaseClient
      .from('departments')
      .select('stripe_subscription_id, leader_id')
      .eq('id', departmentId)
      .single();

    if (deptError || !department) {
      throw new Error("Department not found");
    }

    if (department.leader_id !== user.id) {
      logStep("Unauthorized: User is not department leader", { userId: user.id, leaderId: department.leader_id });
      throw new Error("Unauthorized: Only department leaders can update subscriptions");
    }
    logStep("Authorization verified: User is department leader");


    if (!department.stripe_subscription_id) {
      logStep("No subscription found for department");
      return new Response(JSON.stringify({ success: true, message: "No subscription to update" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Count members in department
    const { count: memberCount, error: countError } = await supabaseClient
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', departmentId);

    if (countError) throw new Error(`Error counting members: ${countError.message}`);
    
    const quantity = memberCount || 1;
    logStep("Member count", { quantity });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get the subscription
    const subscription = await stripe.subscriptions.retrieve(department.stripe_subscription_id);
    const subscriptionItemId = subscription.items.data[0]?.id;

    if (!subscriptionItemId) {
      throw new Error("Subscription item not found");
    }

    // Update subscription quantity
    await stripe.subscriptions.update(department.stripe_subscription_id, {
      items: [
        {
          id: subscriptionItemId,
          quantity: quantity,
        },
      ],
      proration_behavior: 'create_prorations',
    });

    logStep("Subscription updated", { subscriptionId: department.stripe_subscription_id, newQuantity: quantity });

    return new Response(JSON.stringify({ 
      success: true, 
      quantity,
      message: `Subscription updated to ${quantity} member(s)` 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
