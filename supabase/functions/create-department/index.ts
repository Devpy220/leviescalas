import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const createDepartmentSchema = z.object({
  departmentName: z.string()
    .min(1, "Department name is required")
    .max(100, "Department name must be less than 100 characters")
    .regex(/^[a-zA-ZÀ-ÿ0-9\s\-_]+$/, "Department name contains invalid characters"),
  departmentDescription: z.string()
    .max(500, "Description must be less than 500 characters")
    .optional()
    .nullable(),
  churchCode: z.string()
    .min(4, "Church code must be at least 4 characters")
    .max(20, "Church code must be at most 20 characters"),
});

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-DEPARTMENT] ${step}${detailsStr}`);
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
    const validationResult = createDepartmentSchema.safeParse(rawData);
    
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

    const { departmentName, departmentDescription, churchCode } = validationResult.data;
    logStep("Input validated", { departmentName, churchCode });

    // Resolve church code to church ID
    const { data: churchData, error: churchError } = await supabaseClient
      .from('churches')
      .select('id')
      .ilike('code', churchCode)
      .maybeSingle();

    if (churchError || !churchData) {
      logStep("Error finding church by code", { error: churchError, code: churchCode });
      return new Response(
        JSON.stringify({ error: "Invalid church code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const churchId = churchData.id;
    logStep("Church resolved from code", { churchCode, churchId });

    // Create the department (free - no subscription required)
    const { data: department, error: deptError } = await supabaseClient
      .from('departments')
      .insert({
        name: departmentName,
        description: departmentDescription || null,
        leader_id: user.id,
        church_id: churchId,
        subscription_status: 'active', // Free - always active
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
