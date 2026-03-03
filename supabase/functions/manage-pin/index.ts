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
        const { action, newPin, adminPin, targetPinType } = await req.json();
        // action: "reset_vault_pin" | "admin_change_pin"
        // targetPinType: "vault" | "admin" (only for admin_change_pin)

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Validate new PIN: must be 4 digits
        if (!newPin || !/^\d{4}$/.test(newPin)) {
            return new Response(
                JSON.stringify({ error: "PIN must be exactly 4 digits" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (action === "reset_vault_pin") {
            // Verify that pin_reset OTP was successfully verified (we trust client called verify-otp first)
            // Additionally check a short-lived session token stored in DB
            const { data: sessionData } = await supabase
                .from("otp_codes")
                .select("otp_hash")
                .eq("purpose", "pin_reset_granted")
                .single();

            if (!sessionData || sessionData.otp_hash !== "GRANTED") {
                return new Response(
                    JSON.stringify({ error: "OTP verification required before resetting PIN" }),
                    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Update VAULT_PIN in otp_codes as config storage
            const { error } = await supabase
                .from("otp_codes")
                .upsert({ purpose: "vault_pin", otp_hash: newPin, expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() }, { onConflict: "purpose" });

            if (error) {
                return new Response(
                    JSON.stringify({ error: "Failed to update PIN: " + error.message }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Revoke the grant
            await supabase.from("otp_codes").delete().eq("purpose", "pin_reset_granted");

            return new Response(
                JSON.stringify({ success: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );

        } else if (action === "admin_change_pin") {
            // Admin must provide their current admin PIN
            const storedAdminPin = Deno.env.get("ADMIN_PIN");
            const { data: dbAdminPin } = await supabase
                .from("otp_codes")
                .select("otp_hash")
                .eq("purpose", "admin_pin")
                .single();

            const currentAdminPin = dbAdminPin?.otp_hash || storedAdminPin;

            if (!adminPin || adminPin !== currentAdminPin) {
                return new Response(
                    JSON.stringify({ error: "Invalid admin credentials" }),
                    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Also verify admin OTP grant
            const { data: adminGrant } = await supabase
                .from("otp_codes")
                .select("otp_hash")
                .eq("purpose", "admin_granted")
                .single();

            if (!adminGrant || adminGrant.otp_hash !== "GRANTED") {
                return new Response(
                    JSON.stringify({ error: "Admin OTP session not found. Please re-authenticate." }),
                    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const pinPurpose = targetPinType === "admin" ? "admin_pin" : "vault_pin";
            const { error } = await supabase
                .from("otp_codes")
                .upsert({ purpose: pinPurpose, otp_hash: newPin, expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() }, { onConflict: "purpose" });

            if (error) {
                return new Response(
                    JSON.stringify({ error: "Failed to update PIN: " + error.message }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            return new Response(
                JSON.stringify({ success: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ error: "Invalid action" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        return new Response(
            JSON.stringify({ error: String(err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
