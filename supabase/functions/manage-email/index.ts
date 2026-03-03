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
        const { action, newEmail, adminPin } = await req.json();

        if (action !== "admin_change_email") {
            return new Response(
                JSON.stringify({ success: false, error: "Invalid action" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        if (!newEmail || !newEmail.includes("@")) {
            return new Response(
                JSON.stringify({ success: false, error: "Invalid new email" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Verify admin pin
        const storedAdminPin = Deno.env.get("ADMIN_PIN");
        const { data: dbAdminPin } = await supabase.from("otp_codes").select("otp_hash").eq("purpose", "admin_pin").single();
        const currentAdminPin = dbAdminPin?.otp_hash || storedAdminPin;

        if (adminPin !== currentAdminPin) {
            return new Response(
                JSON.stringify({ success: false, error: "Invalid admin credentials" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Verify both OTP grants
        const { data: grantOld } = await supabase.from("otp_codes").select("otp_hash").eq("purpose", "change_email_old_granted").single();
        const { data: grantNew } = await supabase.from("otp_codes").select("otp_hash").eq("purpose", "change_email_new_granted").single();

        if (!grantOld || grantOld.otp_hash !== "GRANTED") {
            return new Response(
                JSON.stringify({ success: false, error: "Old email must be verified first." }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!grantNew || grantNew.otp_hash !== "GRANTED") {
            return new Response(
                JSON.stringify({ success: false, error: "New email must be verified." }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Save new email to database permanently
        const { error } = await supabase
            .from("otp_codes")
            .upsert(
                { purpose: "admin_email", otp_hash: newEmail, expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
                { onConflict: "purpose" }
            );

        if (error) {
            return new Response(
                JSON.stringify({ success: false, error: "Failed to persist new email: " + error.message }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Cleanup grants
        await supabase.from("otp_codes").delete().in("purpose", ["change_email_old_granted", "change_email_new_granted"]);

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        return new Response(
            JSON.stringify({ success: false, error: String(err) }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
