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
        const { pin, oldFileName, newDisplayName } = await req.json();

        // Only admin PIN can rename
        if (!pin || pin !== Deno.env.get("ADMIN_PIN")) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!oldFileName || !newDisplayName) {
            return new Response(
                JSON.stringify({ error: "oldFileName and newDisplayName required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Sanitize: strip dangerous chars, ensure .pdf extension
        const safeName = newDisplayName
            .replace(/[^a-zA-Z0-9 _\-().]/g, "")
            .trim()
            .replace(/\.pdf$/i, "");

        if (!safeName) {
            return new Response(
                JSON.stringify({ error: "Invalid file name" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Keep the original timestamp prefix from the old filename
        const timestampMatch = oldFileName.match(/^(\d+)-/);
        const prefix = timestampMatch ? timestampMatch[1] : Date.now().toString();
        const newFileName = `${prefix}-${safeName}.pdf`;

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { error } = await supabase.storage
            .from("pdfs")
            .move(oldFileName, newFileName);

        if (error) {
            return new Response(
                JSON.stringify({ error: error.message }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, newFileName }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ error: String(err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
