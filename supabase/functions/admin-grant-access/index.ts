import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { adminRoleRow } from "../_shared/admin-rpc.ts";
import { auditRecord } from "../_shared/command-audit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ADMIN_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Check admin role
    const { data: adminRole, error: adminGateErr } = await adminRoleRow(req, userData.user.email);
    // P2: explicit fail-closed on ANY RPC error (42883/42P01/missing bearer/throw/...).
    if (adminGateErr) {
      console.error("[admin-grant-access] admin RPC check failed (denying):", adminGateErr);
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, user_id, tier, duration_days } = await req.json();

    if (action === "grant") {
      const expires_at = duration_days
        ? new Date(Date.now() + duration_days * 86400000).toISOString()
        : null;

      const { error } = await supabase.from("manual_overrides").upsert({
        user_id,
        tier: tier || "full_access",
        granted_by: userData.user.email,
        granted_at: new Date().toISOString(),
        expires_at,
      }, { onConflict: "user_id" });

      if (error) throw error;

      // P2c: command.admin_activity_logs (HMAC target, PII-stripped snapshot); errors logged as stage+code.
      await auditRecord(supabase, {
        actorUserId: userData.user.id,
        actorRole: adminRole?.role ?? "admin",
        action: "grant_access",
        targetType: "user",
        target: user_id,
        after: { tier: tier || "full_access", duration_days, expires_at },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "revoke") {
      const { error } = await supabase.from("manual_overrides").delete().eq("user_id", user_id);
      if (error) throw error;

      // P2c: command.admin_activity_logs (HMAC target, PII-stripped snapshot); errors logged as stage+code.
      await auditRecord(supabase, {
        actorUserId: userData.user.id,
        actorRole: adminRole?.role ?? "admin",
        action: "revoke_access",
        targetType: "user",
        target: user_id,
        after: {},
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
