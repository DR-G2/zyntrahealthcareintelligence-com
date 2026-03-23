import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Placeholder patterns to detect template markers
const PLACEHOLDER_REGEX = /\{(age|gender|symptom|diagnosis|treatment|condition|drug|finding|sign|test|result|location|duration|history|complaint|presentation|examination|investigation|lab|imaging)\}/gi;

// Garbage option patterns
const GARBAGE_OPTION_PATTERNS = [
  "initiate immediate empiric treatment targeting the suspected pathology",
  "order the most definitive diagnostic investigation",
  "prescribe the first-line pharmacological agent",
  "recommend the most appropriate screening test",
  "arrange urgent specialist referral",
  "option a", "option b", "option c", "option d", "option e",
  "answer 1", "answer 2", "answer 3", "answer 4", "answer 5",
];

// Template vignette patterns
const TEMPLATE_PATTERNS = [
  "a patient presents with a clinical scenario frequently reported in amc examination recalls",
  "a patient presents with a clinical scenario commonly tested in amc",
  "a clinical scenario frequently tested",
  "insert clinical scenario",
  "insert patient presentation",
];

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
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: adminRole } = await supabase.from("admin_roles").select("role").eq("email", userData.user.email).maybeSingle();
    if (!adminRole || adminRole.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden - Super Admin only" }), { status: 403, headers: corsHeaders });
    }

    const summary = {
      total_before: 0,
      total_after: 0,
      deleted: 0,
      fixed: 0,
      duplicates_removed: 0,
      placeholders_fixed: 0,
      garbage_deleted: 0,
      template_deleted: 0,
      weak_stems_deleted: 0,
      invalid_json_deleted: 0,
      missing_explanation_deleted: 0,
    };

    // Fetch ALL questions
    const allQuestions: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("questions")
        .select("id, question_text, category, subtopic, options, correct_answer, explanation, difficulty, question_type")
        .range(from, from + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allQuestions.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }

    summary.total_before = allQuestions.length;
    const idsToDelete = new Set<string>();
    const idsToFix: { id: string; updates: Record<string, any> }[] = [];

    for (const q of allQuestions) {
      const textLower = (q.question_text || "").toLowerCase();
      const optStr = JSON.stringify(q.options || []).toLowerCase();
      const fullText = textLower + " " + optStr;

      // 1. GARBAGE OPTIONS
      if (GARBAGE_OPTION_PATTERNS.some(p => optStr.includes(p))) {
        idsToDelete.add(q.id);
        summary.garbage_deleted++;
        continue;
      }

      // 2. TEMPLATE VIGNETTES
      if (TEMPLATE_PATTERNS.some(p => textLower.includes(p))) {
        idsToDelete.add(q.id);
        summary.template_deleted++;
        continue;
      }

      // 3. PLACEHOLDER DETECTION - delete if too many placeholders
      const placeholderMatches = (q.question_text || "").match(PLACEHOLDER_REGEX);
      if (placeholderMatches && placeholderMatches.length >= 2) {
        idsToDelete.add(q.id);
        summary.placeholders_fixed++;
        continue;
      }

      // 4. WEAK STEMS - too short (< 50 chars) or non-clinical
      if ((q.question_text || "").trim().length < 50) {
        idsToDelete.add(q.id);
        summary.weak_stems_deleted++;
        continue;
      }

      // 5. INVALID JSON STRUCTURE - options must be array of 4-5 items
      const opts = q.options;
      const isValidOptions = Array.isArray(opts) && opts.length >= 4 && opts.length <= 5;
      if (!isValidOptions) {
        idsToDelete.add(q.id);
        summary.invalid_json_deleted++;
        continue;
      }

      // 6. MISSING correct_answer or it's not A-E
      if (!q.correct_answer || !/^[A-E]$/i.test(q.correct_answer.trim())) {
        idsToDelete.add(q.id);
        summary.invalid_json_deleted++;
        continue;
      }

      // 7. FIX: Normalize difficulty
      const validDiffs = ["easy", "moderate", "difficult"];
      const normDiff = (q.difficulty || "moderate").toLowerCase().trim();
      let fixedDiff: string | null = null;
      if (!validDiffs.includes(normDiff)) {
        if (normDiff === "medium" || normDiff === "med") fixedDiff = "moderate";
        else if (normDiff === "hard") fixedDiff = "difficult";
        else fixedDiff = "moderate";
      }

      // 8. Single placeholder - fix by removing the braces
      let fixedText: string | null = null;
      if (placeholderMatches && placeholderMatches.length === 1) {
        fixedText = q.question_text.replace(PLACEHOLDER_REGEX, (_: string, p1: string) => {
          const replacements: Record<string, string> = {
            age: "45", gender: "male", symptom: "progressive fatigue",
            diagnosis: "the suspected condition", treatment: "first-line therapy",
            condition: "the presenting condition", drug: "the prescribed medication",
            finding: "the clinical finding", sign: "the examination finding",
            test: "the diagnostic test", result: "the test result",
            location: "the affected area", duration: "several weeks",
            history: "a relevant past medical history", complaint: "the presenting complaint",
            presentation: "the clinical presentation", examination: "clinical examination",
            investigation: "appropriate investigations", lab: "laboratory results",
            imaging: "imaging studies"
          };
          return replacements[p1.toLowerCase()] || p1;
        });
        summary.placeholders_fixed++;
      }

      if (fixedDiff || fixedText) {
        const updates: Record<string, any> = {};
        if (fixedDiff) updates.difficulty = fixedDiff;
        if (fixedText) updates.question_text = fixedText;
        idsToFix.push({ id: q.id, updates });
        summary.fixed++;
      }
    }

    // 9. DEDUPLICATE - by normalized question_text
    const seenTexts = new Map<string, string>();
    for (const q of allQuestions) {
      if (idsToDelete.has(q.id)) continue;
      const normalized = (q.question_text || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 300);
      if (seenTexts.has(normalized)) {
        idsToDelete.add(q.id);
        summary.duplicates_removed++;
      } else {
        seenTexts.set(normalized, q.id);
      }
    }

    // EXECUTE DELETES in batches
    if (idsToDelete.size > 0) {
      const deleteIds = Array.from(idsToDelete);
      for (let i = 0; i < deleteIds.length; i += 100) {
        const batch = deleteIds.slice(i, i + 100);
        await supabase.from("bookmarks").delete().in("question_id", batch);
        await supabase.from("user_notes").delete().in("question_id", batch);
        await supabase.from("user_attempts").delete().in("question_id", batch);
        await supabase.from("question_difficulty_tiers").delete().in("question_id", batch);
        await supabase.from("question_dna").delete().in("question_id", batch);
        await supabase.from("questions").delete().in("id", batch);
      }
    }

    // EXECUTE FIXES in batches
    for (let i = 0; i < idsToFix.length; i += 50) {
      const batch = idsToFix.slice(i, i + 50);
      await Promise.all(batch.map(({ id, updates }) =>
        supabase.from("questions").update(updates).eq("id", id)
      ));
    }

    summary.deleted = idsToDelete.size;

    // Get final count
    const { count: finalCount } = await supabase.from("questions").select("id", { count: "exact", head: true });
    summary.total_after = finalCount || 0;

    // Get category distribution
    const { data: finalQs } = await supabase.from("questions").select("category").limit(5000);
    const catDist: Record<string, number> = {};
    finalQs?.forEach(q => { catDist[q.category] = (catDist[q.category] || 0) + 1; });

    await supabase.from("admin_activity_logs").insert({
      admin_email: userData.user.email,
      action_type: "full_data_cleanup",
      details: { summary },
    });

    return new Response(JSON.stringify({
      success: true,
      ...summary,
      category_distribution: catDist,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
