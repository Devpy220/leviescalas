import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  amount: z.number().int().min(100, "Valor mínimo: R$ 1,00"),
  payment_method: z.enum(["card", "pix"]).default("card"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { amount, payment_method } = parsed.data;
    const origin = req.headers.get("origin") || "https://leviescalas.lovable.app";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: "Apoio voluntário - Levi Escalas",
              description: "Contribuição para manter o projeto gratuito",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/payment-success`,
      cancel_url: `${origin}/payment`,
    };

    if (payment_method === "pix") {
      sessionConfig.payment_method_types = ["pix", "card"];
    } else {
      sessionConfig.payment_method_types = ["card"];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
