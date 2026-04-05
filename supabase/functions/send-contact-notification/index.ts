import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const ADMIN_EMAIL = "heisenberg@zyntrahealthcareintelligence.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, category, message } = await req.json();

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Store as admin notification via training_notifications for super admin
    // Find admin user by email in profiles
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", ADMIN_EMAIL)
      .maybeSingle();

    if (adminProfile) {
      await supabase.from("training_notifications").insert({
        user_id: adminProfile.id,
        title: `📩 Contact Form: ${category}`,
        body: `From: ${name} (${email})\n\n${message}`,
        category: "system",
        type: "contact_form",
        priority: 9,
        cta_label: "View Submissions",
        cta_route: "/admin",
      });
    }

    // Log activity
    await supabase.from("admin_activity_logs").insert({
      admin_email: "system",
      action_type: "contact_form_received",
      target_user_email: email,
      details: { name, category, message: message.substring(0, 200) },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
