import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifySuperAdmin(supabase: any, authHeader: string) {
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");

  const { data: role } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("email", user.email)
    .single();

  if (!role || role.role !== "super_admin") throw new Error("Super admin access required");
  return user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const user = await verifySuperAdmin(supabase, authHeader);
    const body = await req.json();
    const { action = "generate" } = body;

    if (action === "generate") {
      const { prompt } = body;
      if (!prompt || typeof prompt !== "string" || prompt.trim().length < 10) {
        throw new Error("Prompt must be at least 10 characters");
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content: `You are an expert full-stack developer for a React + Supabase platform called Zyntra (medical exam prep). When given a feature request, analyze it and return a structured implementation plan using the provided tool. The platform uses: React 18, Vite, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL, Edge Functions, Auth), Framer Motion, React Router v6. Always consider security (RLS policies), existing database schema, and admin role system.`,
            },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "feature_plan",
                description: "Return a structured implementation plan for the requested feature",
                parameters: {
                  type: "object",
                  properties: {
                    summary: { type: "string", description: "Brief summary of what will be built" },
                    affected_modules: {
                      type: "array",
                      items: { type: "string" },
                      description: "List of files/modules affected",
                    },
                    steps: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          step_number: { type: "number" },
                          title: { type: "string" },
                          description: { type: "string" },
                          type: { type: "string", enum: ["database", "api", "ui", "config"] },
                        },
                        required: ["step_number", "title", "description", "type"],
                        additionalProperties: false,
                      },
                    },
                    database_changes: { type: "string", description: "SQL migration code if needed" },
                    api_changes: { type: "string", description: "Edge function code if needed" },
                    ui_changes: { type: "string", description: "React component code if needed" },
                    security_notes: { type: "string", description: "RLS policies and security considerations" },
                  },
                  required: ["summary", "affected_modules", "steps"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "feature_plan" } },
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI gateway error: ${status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let plan = {};
      let generatedCode = {};

      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        plan = {
          summary: parsed.summary,
          affected_modules: parsed.affected_modules,
          steps: parsed.steps,
          security_notes: parsed.security_notes,
        };
        generatedCode = {
          database_changes: parsed.database_changes || null,
          api_changes: parsed.api_changes || null,
          ui_changes: parsed.ui_changes || null,
        };
      }

      const { data: request, error: insertError } = await supabase
        .from("ai_feature_requests")
        .insert({
          prompt: prompt.trim(),
          plan,
          generated_code: generatedCode,
          status: "pending",
          created_by: user.email,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return new Response(JSON.stringify(request), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve") {
      const { request_id } = body;
      if (!request_id) throw new Error("request_id required");

      const { data: req_data, error: fetchErr } = await supabase
        .from("ai_feature_requests")
        .select("*")
        .eq("id", request_id)
        .single();

      if (fetchErr || !req_data) throw new Error("Feature request not found");

      await supabase
        .from("ai_feature_requests")
        .update({ status: "approved" })
        .eq("id", request_id);

      await supabase.from("ai_patch_logs").insert({
        feature_request_id: request_id,
        files_modified: (req_data.plan as any)?.affected_modules || [],
        changes: req_data.generated_code || {},
        approved_by: user.email,
      });

      return new Response(JSON.stringify({ success: true, status: "approved" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject") {
      const { request_id } = body;
      if (!request_id) throw new Error("request_id required");

      await supabase
        .from("ai_feature_requests")
        .update({ status: "rejected" })
        .eq("id", request_id);

      return new Response(JSON.stringify({ success: true, status: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "history") {
      const { data, error } = await supabase
        .from("ai_feature_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("ai-feature-builder error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
