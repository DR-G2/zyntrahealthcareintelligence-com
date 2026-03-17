import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: adminRole } = await supabase.from("admin_roles").select("role").eq("email", userData.user.email).maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "list") {
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return new Response(JSON.stringify({ questions: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { question_data } = body;
      if (!question_data) throw new Error("Missing question_data");
      const { data, error } = await supabase.from("questions").insert(question_data).select("id").single();
      if (error) throw error;
      await supabase.from("admin_activity_logs").insert({
        admin_email: userData.user.email,
        action_type: "create_question",
        details: { question_id: data.id },
      });
      return new Response(JSON.stringify({ success: true, id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { question_id, question_data } = body;
      if (!question_id || !question_data) throw new Error("Missing question_id or question_data");
      const { error } = await supabase.from("questions").update(question_data).eq("id", question_id);
      if (error) throw error;
      await supabase.from("admin_activity_logs").insert({
        admin_email: userData.user.email,
        action_type: "update_question",
        details: { question_id, fields: Object.keys(question_data) },
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { question_id } = body;
      if (!question_id) throw new Error("Missing question_id");
      await supabase.from("bookmarks").delete().eq("question_id", question_id);
      await supabase.from("user_notes").delete().eq("question_id", question_id);
      await supabase.from("user_attempts").delete().eq("question_id", question_id);
      await supabase.from("question_difficulty_tiers").delete().eq("question_id", question_id);
      const { error } = await supabase.from("questions").delete().eq("id", question_id);
      if (error) throw error;
      await supabase.from("admin_activity_logs").insert({
        admin_email: userData.user.email,
        action_type: "delete_question",
        details: { question_id },
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Subject management ───
    if (action === "manage_subject") {
      const { subject_action, subject_id, subject_name, old_name, new_name, display_order } = body;

      if (subject_action === "add") {
        const { error } = await supabase.from("subjects").insert({ name: subject_name, display_order: display_order || 0 });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (subject_action === "rename") {
        const { error } = await supabase.from("subjects").update({ name: new_name }).eq("id", subject_id);
        if (error) throw error;
        // Also update questions with old category name
        if (old_name && new_name) {
          await supabase.from("questions").update({ category: new_name }).eq("category", old_name);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (subject_action === "delete") {
        const { error } = await supabase.from("subjects").delete().eq("id", subject_id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (subject_action === "list") {
        const { data, error } = await supabase.from("subjects").select("*").order("display_order");
        if (error) throw error;
        return new Response(JSON.stringify({ subjects: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      throw new Error("Invalid subject_action");
    }

    throw new Error("Invalid action");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
