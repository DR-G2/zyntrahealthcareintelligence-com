import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUBJECT_ALIAS_SEEDS: Record<string, string[]> = {
  medicine: ["cardiology", "cardiovascular", "respiratory", "gastroenterology", "gastrointestinal", "renal", "nephrology", "endocrinology", "neurology", "haematology", "hematology", "infectious disease", "infectious diseases", "psychiatry", "dermatology", "paediatrics", "pediatrics", "musculoskeletal"],
  surgery: ["surgery", "surgical", "upper gi", "lower gi", "colorectal", "hepatobiliary", "breast", "urology", "vascular", "trauma", "neurosurgery", "orthopaedics", "orthopedics", "ent", "ophthalmology"],
  acutemedicine: ["acute medicine", "acute emergency", "emergency medicine", "emergency", "toxicology", "critical care", "icu"],
  obg: ["obg", "ob and g", "obstetrics", "gynaecology", "gynecology", "obstetrics and gynaecology", "obstetrics and gynecology", "antenatal care", "reproductive medicine"],
  populationhealth: ["population health", "public health", "epidemiology", "biostatistics", "preventive medicine", "indigenous health", "ethics", "law"],
  basicscience: ["basic science", "anatomy", "physiology", "biochemistry", "pathology", "pharmacology", "microbiology", "genetics", "immunology"],
};

const SUBTOPIC_ALIAS_SEEDS: Record<string, string[]> = {
  "gastroenterology": ["gastrointestinal"],
  "emergency medicine": ["acute emergency", "acute / emergency"],
  "gynaecology": ["gynecology"],
  "haematology": ["hematology"],
  "orthopaedics": ["orthopedics"],
  "paediatrics": ["pediatrics"],
  "public health": ["population health"],
  "infectious diseases": ["infectious disease"],
};

const normalizeTopicLabel = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dedupeAliases = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => normalizeTopicLabel(value)).filter(Boolean)));

const aliasMatch = (value: string, aliases: string[]) =>
  aliases.some((alias) => value === alias || value.includes(alias) || alias.includes(value));

const getCanonicalSubjectKey = (subjectName: string) => {
  const normalized = normalizeTopicLabel(subjectName);

  if (normalized === "ob g" || normalized === "ob and g" || normalized === "obg") return "obg";
  if (normalized === "acute medicine" || normalized === "acute emergency") return "acutemedicine";
  if (normalized === "population health") return "populationhealth";
  if (normalized === "basic science") return "basicscience";

  return normalized.replace(/\s+/g, "");
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

    const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
    const subjectEntries = subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      aliases: dedupeAliases([subject.name, ...(SUBJECT_ALIAS_SEEDS[getCanonicalSubjectKey(subject.name)] || [])]),
    }));
    const subtopicEntries = (subtopics || [])
      .map((subtopic) => {
        const subjectName = subjectMap.get(subtopic.subject_id);
        if (!subjectName) return null;

        return {
          subtopicName: subtopic.name,
          subjectName,
          aliases: dedupeAliases([subtopic.name, ...(SUBTOPIC_ALIAS_SEEDS[normalizeTopicLabel(subtopic.name)] || [])]),
        };
      })
      .filter((entry): entry is { subtopicName: string; subjectName: string; aliases: string[] } => Boolean(entry))
      .sort((a, b) => b.aliases[0].length - a.aliases[0].length);

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
    let failedUpdates = 0;

    for (const q of allQuestions) {
      const normalizedCategory = normalizeTopicLabel(q.category);
      const normalizedSubtopic = normalizeTopicLabel(q.subtopic);
      const searchText = normalizeTopicLabel([q.question_text, q.category, q.subtopic].filter(Boolean).join(" "));
      let newCategory = q.category;
      let newSubtopic = q.subtopic;
      let resolvedSubject: string | null = null;
      let resolvedSubtopic: string | null = null;

      if (normalizedSubtopic) {
        const directSubtopic = subtopicEntries.find((entry) => aliasMatch(normalizedSubtopic, entry.aliases));
        if (directSubtopic) {
          resolvedSubject = directSubtopic.subjectName;
          resolvedSubtopic = directSubtopic.subtopicName;
        }
      }

      if (!resolvedSubject && normalizedCategory) {
        const categorySubtopic = subtopicEntries.find((entry) => aliasMatch(normalizedCategory, entry.aliases));
        if (categorySubtopic) {
          resolvedSubject = categorySubtopic.subjectName;
          resolvedSubtopic = categorySubtopic.subtopicName;
        }
      }

      if (!resolvedSubject && searchText) {
        const textSubtopic = subtopicEntries.find((entry) => entry.aliases.some((alias) => searchText.includes(alias)));
        if (textSubtopic) {
          resolvedSubject = textSubtopic.subjectName;
          resolvedSubtopic = textSubtopic.subtopicName;
        }
      }

      if (!resolvedSubject && normalizedCategory) {
        const categorySubject = subjectEntries.find((entry) => aliasMatch(normalizedCategory, entry.aliases));
        if (categorySubject) {
          resolvedSubject = categorySubject.name;
        }
      }

      if (!resolvedSubject && searchText) {
        const textSubject = subjectEntries.find((entry) => entry.aliases.some((alias) => searchText.includes(alias)));
        if (textSubject) {
          resolvedSubject = textSubject.name;
        }
      }

      if (resolvedSubject) newCategory = resolvedSubject;
      if (resolvedSubtopic) newSubtopic = resolvedSubtopic;

      const needsUpdate = newCategory !== q.category || newSubtopic !== q.subtopic;

      if (needsUpdate) {
        const updateData: any = {};
        if (newCategory !== q.category) updateData.category = newCategory;
        if (newSubtopic !== q.subtopic) updateData.subtopic = newSubtopic;
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase.from("questions").update(updateData).eq("id", q.id);
          if (updateError) {
            failedUpdates++;
            continue;
          }
          if (updateData.category) categoryUpdated++;
          if (updateData.subtopic) subtopicUpdated++;
        }
      } else {
        unchanged++;
      }
    }

    // Log the action
    await supabase.from("admin_activity_logs").insert({
      admin_email: userData.user.email,
      action_type: "auto_classify_questions",
      details: { total: allQuestions.length, categoryUpdated, subtopicUpdated, unchanged, failedUpdates },
    });

    return new Response(JSON.stringify({
      success: true,
      total: allQuestions.length,
      category_updated: categoryUpdated,
      subtopic_updated: subtopicUpdated,
      unchanged,
      failed_updates: failedUpdates,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("auto-classify error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
