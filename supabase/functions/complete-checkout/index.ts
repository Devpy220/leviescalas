import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema - Stripe session IDs start with cs_
const completeCheckoutSchema = z.object({
  sessionId: z.string()
    .min(1, "Session ID is required")
    .regex(/^cs_(test_|live_)?[a-zA-Z0-9]+$/, "Invalid Stripe session ID format"),
});

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[COMPLETE-CHECKOUT] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Parse and validate input
    const rawData = await req.json();
    const validationResult = completeCheckoutSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      logStep("Validation error", { errors: validationResult.error.errors });
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { sessionId } = validationResult.data;
    logStep("Session ID validated", { sessionId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Session retrieved", { 
      status: session.status, 
      subscriptionId: session.subscription,
      metadata: session.metadata 
    });

    if (session.status !== "complete") {
      throw new Error("Checkout session is not complete");
    }

    const departmentName = session.metadata?.department_name;
    const departmentDescription = session.metadata?.department_description;
    const churchCode = session.metadata?.church_code;
    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    if (!departmentName) {
      throw new Error("Department name not found in session metadata");
    }

    if (!churchCode) {
      throw new Error("Church code not found in session metadata");
    }

    // Resolve church code to church ID securely on the backend
    const { data: churchData, error: churchError } = await supabaseClient
      .from('churches')
      .select('id')
      .ilike('code', churchCode)
      .maybeSingle();

    if (churchError || !churchData) {
      logStep("Error finding church by code", { error: churchError, code: churchCode });
      throw new Error("Invalid church code");
    }

    const churchId = churchData.id;
    logStep("Church resolved from code", { churchCode, churchId });

    // Get subscription details for trial end date
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const trialEndsAt = subscription.trial_end 
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null;

    // Create the department with church_id
    const { data: department, error: deptError } = await supabaseClient
      .from('departments')
      .insert({
        name: departmentName,
        description: departmentDescription || null,
        leader_id: user.id,
        church_id: churchId,
        subscription_status: subscription.status === 'trialing' ? 'trial' : 'active',
        trial_ends_at: trialEndsAt,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      })
      .select()
      .single();

    if (deptError) {
      logStep("Error creating department", { error: deptError });
      throw new Error(`Failed to create department: ${deptError.message}`);
    }
    logStep("Department created", { departmentId: department.id });

    // Add leader as member
    const { error: memberError } = await supabaseClient
      .from('members')
      .insert({
        department_id: department.id,
        user_id: user.id,
        role: 'leader',
      });

    if (memberError) {
      logStep("Error adding leader as member", { error: memberError });
      // Don't throw, department is created
    }

    return new Response(JSON.stringify({
      success: true,
      department: {
        id: department.id,
        name: department.name,
        invite_code: department.invite_code,
      },
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
