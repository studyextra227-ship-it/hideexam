import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pin } = await req.json();
    const vaultPin = Deno.env.get("VAULT_PIN");
    const adminPin = Deno.env.get("ADMIN_PIN");

    if (!vaultPin) {
      return new Response(
        JSON.stringify({ error: "VAULT_PIN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pin === adminPin) {
      return new Response(
        JSON.stringify({ valid: true, isAdmin: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const valid = pin === vaultPin;
    return new Response(
      JSON.stringify({ valid, isAdmin: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
