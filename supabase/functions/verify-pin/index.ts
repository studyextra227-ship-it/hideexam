import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { pin } = await req.json();

    // Env fallbacks (used until DB overrides are set)
    const envVaultPin = Deno.env.get("VAULT_PIN");
    const envAdminPin = Deno.env.get("ADMIN_PIN");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check DB for dynamically-changed PINs
    const { data: rows } = await supabase
      .from("otp_codes")
      .select("purpose, otp_hash")
      .in("purpose", ["vault_pin", "admin_pin"]);

    const dbVaultPin = rows?.find((r) => r.purpose === "vault_pin")?.otp_hash;
    const dbAdminPin = rows?.find((r) => r.purpose === "admin_pin")?.otp_hash;

    const vaultPin = dbVaultPin || envVaultPin;
    const adminPin = dbAdminPin || envAdminPin;

    if (!vaultPin) {
      return new Response(
        JSON.stringify({ error: "VAULT_PIN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (adminPin && pin === adminPin) {
      // Admin needs OTP step — return flag for frontend to trigger OTP
      return new Response(
        JSON.stringify({ valid: true, isAdmin: true, requiresOtp: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const valid = pin === vaultPin;
    return new Response(
      JSON.stringify({ valid, isAdmin: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
