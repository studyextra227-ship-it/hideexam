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
        const { otp, purpose } = await req.json();
        // purpose: "admin_verify" | "pin_reset"

        if (!otp || !purpose) {
            return new Response(
                JSON.stringify({ error: "otp and purpose required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Fetch stored OTP for this purpose
        const { data, error } = await supabase
            .from("otp_codes")
            .select("otp_hash, expires_at")
            .eq("purpose", purpose)
            .single();

        if (error || !data) {
            return new Response(
                JSON.stringify({ valid: false, error: "No OTP found. Please request a new one." }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const now = new Date();
        const expiresAt = new Date(data.expires_at);

        if (now > expiresAt) {
            await supabase.from("otp_codes").delete().eq("purpose", purpose);
            return new Response(
                JSON.stringify({ valid: false, error: "OTP expired. Please request a new one." }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (data.otp_hash !== otp) {
            return new Response(
                JSON.stringify({ valid: false, error: "Invalid OTP code." }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // OTP is valid — delete it (single-use)
        await supabase.from("otp_codes").delete().eq("purpose", purpose);

        // Grant a session for 15 minutes
        const grantPurpose = purpose === "admin_verify" ? "admin_granted" : "pin_reset_granted";
        const grantExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        await supabase
            .from("otp_codes")
            .upsert({ purpose: grantPurpose, otp_hash: "GRANTED", expires_at: grantExpiry }, { onConflict: "purpose" });

        return new Response(
            JSON.stringify({ valid: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ error: String(err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
