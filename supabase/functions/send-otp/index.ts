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
        const { purpose } = await req.json();
        // purpose: "admin_verify" | "pin_reset"

        const adminEmail = Deno.env.get("ADMIN_EMAIL");
        const resendApiKey = Deno.env.get("RESEND_API_KEY");

        if (!adminEmail) {
            return new Response(
                JSON.stringify({ error: "ADMIN_EMAIL not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!resendApiKey) {
            return new Response(
                JSON.stringify({ error: "RESEND_API_KEY not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min expiry

        // Store OTP in Supabase DB
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Upsert OTP (one row per purpose)
        const { error: dbError } = await supabase
            .from("otp_codes")
            .upsert({ purpose, otp_hash: otp, expires_at: expiresAt }, { onConflict: "purpose" });

        if (dbError) {
            return new Response(
                JSON.stringify({ error: "Failed to store OTP: " + dbError.message }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const subjectMap: Record<string, string> = {
            admin_verify: "🔐 Admin Portal — OTP Verification",
            pin_reset: "🔑 Abyss Vault — PIN Reset Code",
        };

        const bodyMap: Record<string, string> = {
            admin_verify: `
        <div style="font-family: monospace; background: #010a0f; color: #00ffcc; padding: 32px; border-radius: 12px; border: 1px solid rgba(0,255,204,0.2);">
          <h2 style="color: #00ffcc; letter-spacing: 2px;">🛡️ ADMIN PORTAL ACCESS</h2>
          <p style="color: #8899aa;">Two-step verification is required to access the Admin Panel.</p>
          <div style="background: rgba(0,255,204,0.08); border: 1px solid rgba(0,255,204,0.3); border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="color: #8899aa; font-size: 12px; margin: 0 0 8px;">Your OTP Code (valid for 10 minutes)</p>
            <h1 style="color: #00ffcc; font-size: 42px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #556677; font-size: 12px;">Do not share this code. If you didn't request this, someone may be trying to access the Admin Panel.</p>
        </div>
      `,
            pin_reset: `
        <div style="font-family: monospace; background: #010a0f; color: #00ffcc; padding: 32px; border-radius: 12px; border: 1px solid rgba(0,255,204,0.2);">
          <h2 style="color: #00ffcc; letter-spacing: 2px;">🔑 PIN RESET REQUEST</h2>
          <p style="color: #8899aa;">A PIN reset was requested for Abyss Vault.</p>
          <div style="background: rgba(0,255,204,0.08); border: 1px solid rgba(0,255,204,0.3); border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="color: #8899aa; font-size: 12px; margin: 0 0 8px;">Your OTP Code (valid for 10 minutes)</p>
            <h1 style="color: #00ffcc; font-size: 42px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #556677; font-size: 12px;">Use this code to reset your vault PIN. If you didn't request this, please ignore this email.</p>
        </div>
      `,
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
                to: [adminEmail],
                subject: subjectMap[purpose] || "Abyss Vault — OTP Code",
                html: bodyMap[purpose] || `<p>Your OTP: <strong>${otp}</strong></p>`,
            }),
        });

        if (!emailRes.ok) {
            const errText = await emailRes.text();
            return new Response(
                JSON.stringify({ error: "Failed to send email: " + errText }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, maskedEmail: adminEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3") }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ error: String(err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
