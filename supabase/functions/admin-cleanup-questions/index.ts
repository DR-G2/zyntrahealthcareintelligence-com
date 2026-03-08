import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const ADMIN_EMAIL = "gopalrock.naren@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Category normalization mapping
const CATEGORY_MAP: Record<string, string> = {
  "cardiovascular": "Cardiology",
  "cardiovascular system": "Cardiology",
  "cardiac": "Cardiology",
  "respiratory medicine": "Respiratory",
  "respiratory system": "Respiratory",
  "pulmonology": "Respiratory",
  "gastroenterology": "Gastrointestinal",
  "gi": "Gastrointestinal",
  "digestive": "Gastrointestinal",
  "hematology": "Haematology",
  "haematology/oncology": "Haematology",
  "hematology/oncology": "Haematology",
  "oncology": "Haematology",
  "mental health": "Psychiatry",
  "mood disorders": "Psychiatry",
  "psychosis": "Psychiatry",
  "anxiety/ocd/ptsd": "Psychiatry",
  "anxiety disorders": "Psychiatry",
  "substance use": "Psychiatry",
  "substance use disorders": "Psychiatry",
  "organic/psychogeriatric": "Psychiatry",
  "child & adolescent psychiatry": "Psychiatry",
  "orthopaedics": "Musculoskeletal",
  "orthopedics": "Musculoskeletal",
  "orthopedic": "Musculoskeletal",
  "rheumatology": "Musculoskeletal",
  "trauma": "Emergency Medicine",
  "trauma & emergency": "Emergency Medicine",
  "general surgery": "Surgery",
  "vascular surgery": "Surgery",
  "cardiothoracic surgery": "Surgery",
  "neurosurgery": "Surgery",
  "surgical": "Surgery",
  "neonatology": "Paediatrics",
  "pediatrics": "Paediatrics",
  "common paediatric conditions": "Paediatrics",
  "paediatric emergencies": "Paediatrics",
  "paediatric medicine": "Paediatrics",
  "obstetrics": "Obstetrics & Gynaecology",
  "gynaecology": "Obstetrics & Gynaecology",
  "gynecology": "Obstetrics & Gynaecology",
  "o&g": "Obstetrics & Gynaecology",
  "urology": "Renal",
  "nephrology": "Renal",
  "renal medicine": "Renal",
  "infectious disease": "Infectious Diseases",
  "infection": "Infectious Diseases",
  "microbiology": "Infectious Diseases",
  "ethics/legal": "Population Health",
  "ethics & law": "Population Health",
  "ethics": "Population Health",
  "epidemiology/screening": "Population Health",
  "epidemiology": "Population Health",
  "indigenous health": "Population Health",
  "public health": "Population Health",
  "public health/palliative": "Population Health",
  "palliative care": "Population Health",
  "preventive medicine": "Population Health",
  "ophthalmology": "ENT",
  "pharmacology": "Endocrinology",
};

// Valid normalized categories
const VALID_SYSTEMS = new Set([
  "Cardiology", "Respiratory", "Gastrointestinal", "Neurology", "Endocrinology",
  "Renal", "Dermatology", "Psychiatry", "Paediatrics", "Obstetrics & Gynaecology",
  "Emergency Medicine", "Infectious Diseases", "Population Health", "ENT",
  "Haematology", "Musculoskeletal", "Surgery"
]);

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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || userData.user?.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const summary: Record<string, number> = {
      garbage_deleted: 0,
      template_deleted: 0,
      duplicates_deleted: 0,
      categories_normalized: 0,
      orphan_records_cleaned: 0,
    };

    // Step 1: Fetch ALL question IDs and texts in batches
    const allQuestions: { id: string; question_text: string; category: string; options: any }[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("questions")
        .select("id, question_text, category, options")
        .range(from, from + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allQuestions.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    const idsToDelete = new Set<string>();

    // Step 2: Identify garbage questions (generic template options)
    const garbagePatterns = [
      "initiate immediate empiric treatment targeting the suspected pathology",
      "order the most definitive diagnostic investigation",
      "prescribe the first-line pharmacological agent",
      "recommend the most appropriate screening test",
      "arrange urgent specialist referral",
    ];

    for (const q of allQuestions) {
      const optStr = JSON.stringify(q.options).toLowerCase();
      if (garbagePatterns.some(p => optStr.includes(p))) {
        idsToDelete.add(q.id);
      }
    }
    summary.garbage_deleted = idsToDelete.size;

    // Step 3: Identify template vignette duplicates
    const templatePatterns = [
      "a patient presents with a clinical scenario frequently reported in amc examination recalls",
      "a patient presents with a clinical scenario commonly tested in amc",
    ];

    for (const q of allQuestions) {
      if (idsToDelete.has(q.id)) continue;
      const textLower = q.question_text.toLowerCase();
      if (templatePatterns.some(p => textLower.includes(p))) {
        idsToDelete.add(q.id);
        summary.template_deleted++;
      }
    }

    // Step 4: Deduplicate by question_text (keep first occurrence)
    const seenTexts = new Map<string, string>();
    for (const q of allQuestions) {
      if (idsToDelete.has(q.id)) continue;
      const normalized = q.question_text.trim().toLowerCase().replace(/\s+/g, ' ');
      if (seenTexts.has(normalized)) {
        idsToDelete.add(q.id);
        summary.duplicates_deleted++;
      } else {
        seenTexts.set(normalized, q.id);
      }
    }

    // Step 5: Delete junk questions and clean related tables
    if (idsToDelete.size > 0) {
      const deleteIds = Array.from(idsToDelete);
      // Process in batches of 100
      for (let i = 0; i < deleteIds.length; i += 100) {
        const batch = deleteIds.slice(i, i + 100);
        // Clean related tables first
        await supabase.from("bookmarks").delete().in("question_id", batch);
        await supabase.from("user_notes").delete().in("question_id", batch);
        await supabase.from("user_attempts").delete().in("question_id", batch);
        await supabase.from("question_difficulty_tiers").delete().in("question_id", batch);
        // Delete questions
        const { error } = await supabase.from("questions").delete().in("id", batch);
        if (error) throw error;
        summary.orphan_records_cleaned += batch.length;
      }
    }

    // Step 6: Normalize categories for remaining questions
    const remainingQuestions = allQuestions.filter(q => !idsToDelete.has(q.id));
    const categoryUpdates: { id: string; newCat: string }[] = [];

    for (const q of remainingQuestions) {
      const catLower = q.category.trim().toLowerCase();
      // Already valid?
      if (VALID_SYSTEMS.has(q.category)) continue;
      // Check mapping
      const mapped = CATEGORY_MAP[catLower];
      if (mapped) {
        categoryUpdates.push({ id: q.id, newCat: mapped });
      }
      // If not in map and not valid, try partial match
      else {
        let found = false;
        for (const [key, val] of Object.entries(CATEGORY_MAP)) {
          if (catLower.includes(key) || key.includes(catLower)) {
            categoryUpdates.push({ id: q.id, newCat: val });
            found = true;
            break;
          }
        }
        // If still no match, leave as-is (will show up in unmapped report)
      }
    }

    // Apply category updates in batches
    for (const upd of categoryUpdates) {
      await supabase.from("questions").update({ category: upd.newCat }).eq("id", upd.id);
      summary.categories_normalized++;
    }

    // Get final count and category distribution
    const { count: finalCount } = await supabase.from("questions").select("id", { count: "exact", head: true });
    
    // Get category distribution
    const { data: finalQs } = await supabase.from("questions").select("category").limit(5000);
    const catDist: Record<string, number> = {};
    finalQs?.forEach(q => { catDist[q.category] = (catDist[q.category] || 0) + 1; });

    return new Response(JSON.stringify({
      success: true,
      summary,
      total_before: allQuestions.length,
      total_after: finalCount,
      total_deleted: idsToDelete.size,
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
