import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: adminRole } = await supabase.from("admin_roles").select("role").eq("email", userData.user.email).maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { users } = await req.json();
    if (!Array.isArray(users) || !users.length) {
      throw new Error("Expected 'users' array");
    }

    const results: { email: string; status: string; error?: string }[] = [];

    for (const u of users) {
      const email = u.email?.trim()?.toLowerCase();
      if (!email) {
        results.push({ email: u.email || "", status: "skipped", error: "Missing email" });
        continue;
      }

      try {
        // Create auth user with a random password (they'll use password reset)
        const tempPassword = crypto.randomUUID() + "Aa1!";
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { name: u.name || "" },
        });

        if (createError) {
          if (createError.message?.includes("already been registered") || createError.message?.includes("already exists")) {
            // User exists — update profile fields if provided
            const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
            if (existingProfile && (u.name || u.exam_date || u.user_type)) {
              const updates: Record<string, unknown> = {};
              if (u.name) updates.name = u.name;
              if (u.exam_date) updates.exam_date = u.exam_date;
              if (u.user_type) updates.user_type = u.user_type;
              await supabase.from("profiles").update(updates).eq("id", existingProfile.id);
            }
            results.push({ email, status: "exists" });
          } else {
            results.push({ email, status: "error", error: createError.message });
          }
          continue;
        }

        // Update profile with additional fields
        if (newUser?.user?.id) {
          const profileUpdate: Record<string, unknown> = {};
          if (u.name) profileUpdate.name = u.name;
          if (u.exam_date) profileUpdate.exam_date = u.exam_date;
          if (u.user_type) profileUpdate.user_type = u.user_type;
          if (Object.keys(profileUpdate).length > 0) {
            await supabase.from("profiles").update(profileUpdate).eq("id", newUser.user.id);
          }

          // Grant access if tier specified
          if (u.tier && u.tier !== "free") {
            const durationDays = u.duration_days ? parseInt(u.duration_days) : null;
            const expiresAt = durationDays ? new Date(Date.now() + durationDays * 86400000).toISOString() : null;
            await supabase.from("manual_overrides").upsert({
              user_id: newUser.user.id,
              tier: u.tier,
              granted_by: userData.user.email,
              granted_at: new Date().toISOString(),
              expires_at: expiresAt,
            }, { onConflict: "user_id" });
          }
        }

        results.push({ email, status: "created" });
      } catch (e: any) {
        results.push({ email, status: "error", error: e.message });
      }
    }

    // Log the bulk action
    await supabase.from("admin_activity_logs").insert({
      admin_email: userData.user.email,
      action_type: "BULK_USER_IMPORT",
      details: {
        total: users.length,
        created: results.filter(r => r.status === "created").length,
        exists: results.filter(r => r.status === "exists").length,
        errors: results.filter(r => r.status === "error").length,
      },
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
