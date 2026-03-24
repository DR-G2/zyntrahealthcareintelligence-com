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
      const { question_type } = body;
      let query = supabase
        .from("questions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (question_type) {
        query = query.eq("question_type", question_type);
      }
      const { data, error } = await query;
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

    // ─── Subtopic management ───
    if (action === "manage_subtopic") {
      const { subtopic_action, subtopic_id, subtopic_name, subject_id: st_subject_id, display_order: st_order } = body;

      if (subtopic_action === "list") {
        let query = supabase.from("subtopics").select("*").order("display_order");
        if (st_subject_id) query = query.eq("subject_id", st_subject_id);
        const { data, error } = await query;
        if (error) throw error;
        return new Response(JSON.stringify({ subtopics: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (subtopic_action === "add") {
        const { error } = await supabase.from("subtopics").insert({ name: subtopic_name, subject_id: st_subject_id, display_order: st_order || 0 });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (subtopic_action === "rename") {
        const { error } = await supabase.from("subtopics").update({ name: subtopic_name }).eq("id", subtopic_id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (subtopic_action === "delete") {
        const { error } = await supabase.from("subtopics").delete().eq("id", subtopic_id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      throw new Error("Invalid subtopic_action");
    }

    // ─── Delete all questions by subject (category) ───
    if (action === "delete_by_subject") {
      const { subject_name } = body;
      if (!subject_name) throw new Error("Missing subject_name");

      // Count first
      const { count: beforeCount } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("category", subject_name);

      // Get all question IDs
      const allIds: string[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase.from("questions").select("id").eq("category", subject_name).range(from, from + 999);
        if (!data || data.length === 0) break;
        allIds.push(...data.map(d => d.id));
        if (data.length < 1000) break;
        from += 1000;
      }

      // Delete related records then questions in batches
      for (let i = 0; i < allIds.length; i += 100) {
        const batch = allIds.slice(i, i + 100);
        await supabase.from("bookmarks").delete().in("question_id", batch);
        await supabase.from("user_notes").delete().in("question_id", batch);
        await supabase.from("user_attempts").delete().in("question_id", batch);
        await supabase.from("question_difficulty_tiers").delete().in("question_id", batch);
        await supabase.from("question_dna").delete().in("question_id", batch);
        await supabase.from("questions").delete().in("id", batch);
      }

      await supabase.from("admin_activity_logs").insert({
        admin_email: userData.user.email,
        action_type: "delete_by_subject",
        details: { subject_name, deleted_count: allIds.length },
      });

      return new Response(JSON.stringify({ success: true, deleted_count: allIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Delete all questions by subtopic ───
    if (action === "delete_by_subtopic") {
      const { subtopic_name } = body;
      if (!subtopic_name) throw new Error("Missing subtopic_name");

      const allIds: string[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase.from("questions").select("id").eq("subtopic", subtopic_name).range(from, from + 999);
        if (!data || data.length === 0) break;
        allIds.push(...data.map(d => d.id));
        if (data.length < 1000) break;
        from += 1000;
      }

      for (let i = 0; i < allIds.length; i += 100) {
        const batch = allIds.slice(i, i + 100);
        await supabase.from("bookmarks").delete().in("question_id", batch);
        await supabase.from("user_notes").delete().in("question_id", batch);
        await supabase.from("user_attempts").delete().in("question_id", batch);
        await supabase.from("question_difficulty_tiers").delete().in("question_id", batch);
        await supabase.from("question_dna").delete().in("question_id", batch);
        await supabase.from("questions").delete().in("id", batch);
      }

      await supabase.from("admin_activity_logs").insert({
        admin_email: userData.user.email,
        action_type: "delete_by_subtopic",
        details: { subtopic_name, deleted_count: allIds.length },
      });

      return new Response(JSON.stringify({ success: true, deleted_count: allIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Delete ALL questions by type (mcq / mcq_temp / osce) ───
    if (action === "delete_all_by_type") {
      const { question_type } = body;
      if (!question_type) throw new Error("Missing question_type");

      const allIds: string[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase.from("questions").select("id").eq("question_type", question_type).range(from, from + 999);
        if (!data || data.length === 0) break;
        allIds.push(...data.map(d => d.id));
        if (data.length < 1000) break;
        from += 1000;
      }

      for (let i = 0; i < allIds.length; i += 100) {
        const batch = allIds.slice(i, i + 100);
        await supabase.from("bookmarks").delete().in("question_id", batch);
        await supabase.from("user_notes").delete().in("question_id", batch);
        await supabase.from("user_attempts").delete().in("question_id", batch);
        await supabase.from("question_difficulty_tiers").delete().in("question_id", batch);
        await supabase.from("question_dna").delete().in("question_id", batch);
        await supabase.from("questions").delete().in("id", batch);
      }

      await supabase.from("admin_activity_logs").insert({
        admin_email: userData.user.email,
        action_type: "delete_all_by_type",
        details: { question_type, deleted_count: allIds.length },
      });

      return new Response(JSON.stringify({ success: true, deleted_count: allIds.length }), {
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
