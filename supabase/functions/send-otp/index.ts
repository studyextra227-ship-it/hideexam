import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a 6-digit OTP
function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { purpose, email } = await req.json();

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Fetch dynamic admin email from DB, fallback to env
        const { data: dbAdminRow } = await supabase.from("otp_codes").select("otp_hash").eq("purpose", "admin_email").single();
        const adminEmail = dbAdminRow?.otp_hash || Deno.env.get("ADMIN_EMAIL");

        const resendApiKey = Deno.env.get("RESEND_API_KEY");

        if (!adminEmail) {
            return new Response(
                JSON.stringify({ success: false, error: "ADMIN_EMAIL not configured" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (purpose === "admin_verify") {
            if (!email) {
                return new Response(
                    JSON.stringify({ success: false, error: "Email is required to verify admin access." }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            if (email.toLowerCase().trim() !== adminEmail.toLowerCase().trim()) {
                return new Response(
                    JSON.stringify({ success: false, error: "Incorrect admin email address. Access Denied." }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        if (purpose === "change_email_new") {
            if (!email || !email.includes("@")) {
                return new Response(
                    JSON.stringify({ success: false, error: "Valid new email is required." }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        if (!resendApiKey) {
            return new Response(
                JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min expiry

        // Upsert OTP (one row per purpose)
        const { error: dbError } = await supabase
            .from("otp_codes")
            .upsert({ purpose, otp_hash: otp, expires_at: expiresAt }, { onConflict: "purpose" });

        if (dbError) {
            return new Response(
                JSON.stringify({ success: false, error: "Failed to store OTP: " + dbError.message }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const subjectMap: Record<string, string> = {
            admin_verify: "🔐 Admin Portal — OTP Verification",
            pin_reset: "🔑 Abyss Vault — PIN Reset Code",
            change_email_old: "🔐 Verify Email Change Request",
            change_email_new: "🔐 Confirm New Admin Email",
        };

        const targetEmail = purpose === "change_email_new" ? email : adminEmail;

        const htmlMap: Record<string, string> = {
            admin_verify: `
        <div style="font-family: monospace; background: #010a0f; color: #00ffcc; padding: 32px; border-radius: 12px; border: 1px solid rgba(0,255,204,0.2);">
          <h2 style="color: #00ffcc; letter-spacing: 2px;">🛡️ ADMIN PORTAL ACCESS</h2>
          <p style="color: #8899aa;">Two-step verification is required to access the Admin Panel.</p>
          <div style="background: rgba(0,255,204,0.08); border: 1px solid rgba(0,255,204,0.3); border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;"><h1>${otp}</h1></div>
        </div>`,
            pin_reset: `
        <div style="font-family: monospace; background: #010a0f; color: #00ffcc; padding: 32px; border-radius: 12px; border: 1px solid rgba(0,255,204,0.2);">
          <h2 style="color: #00ffcc; letter-spacing: 2px;">🔑 PIN RESET REQUEST</h2>
          <div style="background: rgba(0,255,204,0.08); border: 1px solid rgba(0,255,204,0.3); border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;"><h1>${otp}</h1></div>
        </div>`,
            change_email_old: `
        <div style="font-family: monospace; background: #010a0f; color: #ff6060; padding: 32px; border-radius: 12px; border: 1px solid rgba(255,96,96,0.2);">
          <h2 style="color: #ff6060; letter-spacing: 2px;">⚠️ EMAIL CHANGE REQUEST</h2>
          <p style="color: #8899aa;">Someone is trying to change the admin email address.</p>
          <div style="background: rgba(255,96,96,0.08); border: 1px solid rgba(255,96,96,0.3); border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;"><h1>${otp}</h1></div>
        </div>`,
            change_email_new: `
        <div style="font-family: monospace; background: #010a0f; color: #ff6060; padding: 32px; border-radius: 12px; border: 1px solid rgba(255,96,96,0.2);">
          <h2 style="color: #ff6060; letter-spacing: 2px;">✅ VERIFY NEW ADMIN EMAIL</h2>
          <p style="color: #8899aa;">You requested to set this email as the new Admin contact for Abyss Vault.</p>
          <div style="background: rgba(255,96,96,0.08); border: 1px solid rgba(255,96,96,0.3); border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;"><h1>${otp}</h1></div>
        </div>`
        };

        // Send email via Resend
        const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "Abyss Vault <onboarding@resend.dev>",
                to: [targetEmail],
                subject: subjectMap[purpose] || "Abyss Vault — OTP Code",
                html: htmlMap[purpose] || `<p>Your OTP: <strong>${otp}</strong></p>`,
            }),
        });

        if (!emailRes.ok) {
            const errText = await emailRes.text();
            return new Response(
                JSON.stringify({ success: false, error: "Failed to send email OTP network check: " + errText }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, maskedEmail: targetEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3") }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ success: false, error: "Internal Server Error: " + String(err) }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
