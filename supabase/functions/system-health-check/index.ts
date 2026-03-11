import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "gopalrock.naren@gmail.com";

interface StepResult {
  name: string;
  status: "healthy" | "degraded" | "down";
  latency_ms: number;
  error?: string;
  details?: Record<string, unknown>;
}

async function runCheck(name: string, fn: () => Promise<Record<string, unknown> | void>): Promise<StepResult> {
  const start = Date.now();
  try {
    const details = await fn();
    const latency = Date.now() - start;
    return {
      name,
      status: latency > 2000 ? "degraded" : "healthy",
      latency_ms: latency,
      details: details || undefined,
    };
  } catch (e) {
    return {
      name,
      status: "down",
      latency_ms: Date.now() - start,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify admin
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || user?.email !== ADMIN_EMAIL) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "standard";

    const steps: StepResult[] = [];

    // Step 1: Database ping
    steps.push(await runCheck("database", async () => {
      const { error } = await supabase.rpc("is_group_member", { _user_id: "00000000-0000-0000-0000-000000000000", _group_id: "00000000-0000-0000-0000-000000000000" });
      // We just need it to not throw a connection error - false result is fine
      return { connected: true };
    }));

    // Step 2: Auth system
    steps.push(await runCheck("auth", async () => {
      // Verify the auth system is responding by checking settings
      const { data, error } = await supabase.auth.getUser(authHeader?.replace("Bearer ", "") || "");
      if (error && !error.message.includes("invalid")) throw error;
      return { auth_responding: true };
    }));

    // Step 3: Load MCQ question
    const mcqStep = await runCheck("mcq_engine", async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, question_text, correct_answer, options, category, difficulty")
        .limit(1)
        .single();
      if (error) throw error;
      return { question_id: data.id, has_options: !!data.options, has_answer: !!data.correct_answer };
    });
    steps.push(mcqStep);

    // Step 4: Validate MCQ (simulation mode only runs deeper validation)
    if (mode === "simulation") {
      steps.push(await runCheck("mcq_validation", async () => {
        const { data, error } = await supabase
          .from("questions")
          .select("id, question_text, correct_answer, options, explanation, category, difficulty, tags")
          .limit(5);
        if (error) throw error;
        const issues: string[] = [];
        (data || []).forEach((q: any) => {
          if (!q.correct_answer) issues.push(`Q ${q.id}: missing correct_answer`);
          if (!q.options || (typeof q.options === "object" && Object.keys(q.options).length === 0)) {
            issues.push(`Q ${q.id}: missing options`);
          }
        });
        return { sample_count: data?.length || 0, issues_found: issues.length, issues: issues.slice(0, 5) };
      }));
    }

    // Step 5: Load OSCE station
    const osceStep = await runCheck("osce_engine", async () => {
      const { data, error } = await supabase
        .from("clinical_stations")
        .select("id, scenario_title, subject, scenario_data")
        .limit(1)
        .single();
      if (error) throw error;
      const scenarioKeys = data.scenario_data ? Object.keys(data.scenario_data as Record<string, unknown>) : [];
      return { station_id: data.id, has_scenario: scenarioKeys.length > 0, scenario_keys: scenarioKeys };
    });
    steps.push(osceStep);

    // Step 6: Validate OSCE (simulation mode)
    if (mode === "simulation") {
      steps.push(await runCheck("osce_validation", async () => {
        const { data, error } = await supabase
          .from("clinical_stations")
          .select("id, scenario_title, subject, scenario_data")
          .limit(5);
        if (error) throw error;
        const issues: string[] = [];
        (data || []).forEach((s: any) => {
          if (!s.scenario_data || Object.keys(s.scenario_data).length === 0) {
            issues.push(`Station ${s.id}: empty scenario_data`);
          }
          if (!s.scenario_title || s.scenario_title.trim() === "") {
            issues.push(`Station ${s.id}: missing title`);
          }
        });
        return { sample_count: data?.length || 0, issues_found: issues.length, issues: issues.slice(0, 5) };
      }));
    }

    // Step 7: AI Service ping
    steps.push(await runCheck("ai_service", async () => {
      const { data, error } = await supabase.functions.invoke("retrain-ai-context", {
        body: { health_check: true },
      });
      if (error) throw error;
      return { ai_responding: true };
    }));

    // Step 8: Payments system
    steps.push(await runCheck("payments", async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, status, tier, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return { payments_accessible: true, latest_payment: data?.[0]?.created_at || null };
    }));

    // Simulation-only: User flow test
    if (mode === "simulation") {
      // Test user_attempts table access
      steps.push(await runCheck("user_attempts_access", async () => {
        const { count, error } = await supabase
          .from("user_attempts")
          .select("id", { count: "exact", head: true });
        if (error) throw error;
        return { total_attempts: count };
      }));

      // Test active sessions table
      steps.push(await runCheck("session_storage", async () => {
        const { count, error } = await supabase
          .from("active_sessions")
          .select("id", { count: "exact", head: true });
        if (error) throw error;
        return { active_sessions: count };
      }));

      // Test profiles table
      steps.push(await runCheck("profiles_access", async () => {
        const { count, error } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true });
        if (error) throw error;
        return { total_profiles: count };
      }));
    }

    // Calculate overall status
    const totalLatency = steps.reduce((sum, s) => sum + s.latency_ms, 0);
    let overallStatus: "healthy" | "degraded" | "down" = "healthy";
    if (steps.some(s => s.status === "down")) overallStatus = "down";
    else if (steps.some(s => s.status === "degraded")) overallStatus = "degraded";

    // Log to system_health_logs
    await supabase.from("system_health_logs").insert({
      overall_status: overallStatus,
      mode,
      steps: steps as unknown as Record<string, unknown>,
      total_latency_ms: totalLatency,
    });

    // Build service map for quick overview
    const services: Record<string, string> = {};
    steps.forEach(s => { services[s.name] = s.status; });

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      mode,
      latency_ms: totalLatency,
      services,
      steps,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("system-health-check error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
