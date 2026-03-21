import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: adminRole } = await supabase.from("admin_roles").select("role").eq("email", userData.user.email).maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch subjects and subtopics
    const { data: subjects } = await supabase.from("subjects").select("id, name");
    const { data: subtopics } = await supabase.from("subtopics").select("id, name, subject_id");

    if (!subjects?.length) throw new Error("No subjects found");

    // Build lookup: subtopic name → parent subject name
    const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
    const subtopicEntries = (subtopics || []).map(st => ({
      subtopicName: st.name,
      subtopicLower: st.name.toLowerCase(),
      subjectName: subjectMap.get(st.subject_id) || "",
    }));
    const subjectNames = subjects.map(s => ({ name: s.name, lower: s.name.toLowerCase() }));

    // Fetch ALL questions in pages of 1000
    let allQuestions: any[] = [];
    let offset = 0;
    while (true) {
      const { data: batch, error } = await supabase
        .from("questions")
        .select("id, question_text, category, subtopic")
        .range(offset, offset + 999);
      if (error) throw error;
      if (!batch || batch.length === 0) break;
      allQuestions = allQuestions.concat(batch);
      if (batch.length < 1000) break;
      offset += 1000;
    }

    let categoryUpdated = 0;
    let subtopicUpdated = 0;
    let unchanged = 0;

    for (const q of allQuestions) {
      const text = (q.question_text || "").toLowerCase();
      let newCategory = q.category;
      let newSubtopic = q.subtopic;
      let needsUpdate = false;

      // Classify category if missing or "Uncategorized"
      if (!q.category || q.category === "Uncategorized") {
        // Try subtopic match first
        const stMatch = subtopicEntries.find(e => text.includes(e.subtopicLower));
        if (stMatch) {
          newCategory = stMatch.subjectName;
          if (!newSubtopic) newSubtopic = stMatch.subtopicName;
          needsUpdate = true;
          categoryUpdated++;
        } else {
          const subMatch = subjectNames.find(s => text.includes(s.lower));
          if (subMatch) {
            newCategory = subMatch.name;
            needsUpdate = true;
            categoryUpdated++;
          }
        }
      }

      // Classify subtopic if missing
      if (!q.subtopic && newCategory) {
        const relevantSts = subtopicEntries.filter(e => e.subjectName === newCategory);
        const stMatch = relevantSts.find(e => text.includes(e.subtopicLower));
        if (stMatch) {
          newSubtopic = stMatch.subtopicName;
          needsUpdate = true;
          subtopicUpdated++;
        }
      } else if (!q.subtopic && !newCategory) {
        // Try any subtopic
        const stMatch = subtopicEntries.find(e => text.includes(e.subtopicLower));
        if (stMatch) {
          newSubtopic = stMatch.subtopicName;
          needsUpdate = true;
          subtopicUpdated++;
        }
      }

      if (needsUpdate) {
        const updateData: any = {};
        if (newCategory !== q.category) updateData.category = newCategory;
        if (newSubtopic !== q.subtopic) updateData.subtopic = newSubtopic;
        if (Object.keys(updateData).length > 0) {
          await supabase.from("questions").update(updateData).eq("id", q.id);
        }
      } else {
        unchanged++;
      }
    }

    // Log the action
    await supabase.from("admin_activity_logs").insert({
      admin_email: userData.user.email,
      action_type: "auto_classify_questions",
      details: { total: allQuestions.length, categoryUpdated, subtopicUpdated, unchanged },
    });

    return new Response(JSON.stringify({
      success: true,
      total: allQuestions.length,
      category_updated: categoryUpdated,
      subtopic_updated: subtopicUpdated,
      unchanged,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("auto-classify error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
