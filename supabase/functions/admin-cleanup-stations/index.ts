import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const ADMIN_EMAIL = "gopalrock.naren@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Subject normalization mapping → targets match OSCE_SUBJECTS in AdminDashboard
const SUBJECT_MAP: Record<string, string> = {
  "mental health": "Psychiatry",
  "mood disorders": "Psychiatry",
  "psychosis": "Psychiatry",
  "anxiety disorders": "Psychiatry",
  "substance use": "Psychiatry",
  "general surgery": "Surgery",
  "vascular surgery": "Surgery",
  "cardiothoracic surgery": "Surgery",
  "neurosurgery": "Surgery",
  "surgical": "Surgery",
  "orthopaedics": "Rheumatology",
  "orthopedics": "Rheumatology",
  "trauma": "Surgery",
  "trauma & emergency": "Surgery",
  "pediatrics": "Paediatrics",
  "paediatric medicine": "Paediatrics",
  "neonatology": "Paediatrics",
  "obstetrics": "Obstetrics & Gynaecology",
  "gynaecology": "Obstetrics & Gynaecology",
  "gynecology": "Obstetrics & Gynaecology",
  "o&g": "Obstetrics & Gynaecology",
  "nephrology": "Nephrology",
  "renal": "Nephrology",
  "renal medicine": "Nephrology",
  "urology": "Nephrology",
  "infectious disease": "Infectious Disease",
  "infectious diseases": "Infectious Disease",
  "infection": "Infectious Disease",
  "microbiology": "Infectious Disease",
  "cardiovascular": "Cardiology",
  "cardiac": "Cardiology",
  "respiratory medicine": "Respiratory",
  "pulmonology": "Respiratory",
  "gastroenterology": "Gastroenterology",
  "gi": "Gastroenterology",
  "digestive": "Gastroenterology",
  "gastrointestinal": "Gastroenterology",
  "hematology": "Haematology",
  "hematology/oncology": "Haematology",
  "haematology/oncology": "Haematology",
  "oncology": "Haematology",
  "ophthalmology": "ENT",
  "ent": "ENT",
  "public health": "Psychiatry",
  "palliative care": "Psychiatry",
  "ethics": "Psychiatry",
  "pharmacology": "Endocrinology",
  "musculoskeletal": "Rheumatology",
};

const VALID_SUBJECTS = new Set([
  "Cardiology", "Respiratory", "Gastroenterology", "Neurology", "Endocrinology",
  "Nephrology", "Rheumatology", "Haematology", "Infectious Disease", "Dermatology",
  "Psychiatry", "Obstetrics & Gynaecology", "Paediatrics", "Surgery", "ENT",
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

    const summary = {
      garbage_deleted: 0,
      duplicates_deleted: 0,
      subjects_normalized: 0,
    };

    // Fetch all stations in batches
    const allStations: { id: string; scenario_title: string; subject: string; scenario_data: any }[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("clinical_stations")
        .select("id, scenario_title, subject, scenario_data")
        .range(from, from + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allStations.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    const idsToDelete = new Set<string>();

    // Step 1: Identify garbage stations (generic template content)
    const garbageClues = [
      "symptoms started recently",
      "patient worried about worsening condition",
      "no major past medical issues reported",
    ];

    for (const s of allStations) {
      const dataStr = JSON.stringify(s.scenario_data).toLowerCase();
      const matchCount = garbageClues.filter(clue => dataStr.includes(clue)).length;
      if (matchCount >= 2) {
        idsToDelete.add(s.id);
        summary.garbage_deleted++;
      }
    }

    // Step 2: Deduplicate by scenario_title (keep first/oldest)
    const seenTitles = new Map<string, string>();
    for (const s of allStations) {
      if (idsToDelete.has(s.id)) continue;
      const normalized = s.scenario_title.trim().toLowerCase().replace(/\s+/g, " ");
      if (seenTitles.has(normalized)) {
        idsToDelete.add(s.id);
        summary.duplicates_deleted++;
      } else {
        seenTitles.set(normalized, s.id);
      }
    }

    // Step 3: Delete junk stations
    if (idsToDelete.size > 0) {
      const deleteIds = Array.from(idsToDelete);
      for (let i = 0; i < deleteIds.length; i += 100) {
        const batch = deleteIds.slice(i, i + 100);
        const { error } = await supabase.from("clinical_stations").delete().in("id", batch);
        if (error) throw error;
      }
    }

    // Step 4: Normalize subjects for remaining stations
    const remaining = allStations.filter(s => !idsToDelete.has(s.id));
    for (const s of remaining) {
      if (VALID_SUBJECTS.has(s.subject)) continue;
      const subLower = s.subject.trim().toLowerCase();
      const mapped = SUBJECT_MAP[subLower];
      if (mapped) {
        await supabase.from("clinical_stations").update({ subject: mapped }).eq("id", s.id);
        summary.subjects_normalized++;
      } else {
        // Partial match
        for (const [key, val] of Object.entries(SUBJECT_MAP)) {
          if (subLower.includes(key) || key.includes(subLower)) {
            await supabase.from("clinical_stations").update({ subject: val }).eq("id", s.id);
            summary.subjects_normalized++;
            break;
          }
        }
      }
    }

    // Final stats
    const { count: finalCount } = await supabase.from("clinical_stations").select("id", { count: "exact", head: true });
    const { data: finalStations } = await supabase.from("clinical_stations").select("subject").limit(5000);
    const subjectDist: Record<string, number> = {};
    finalStations?.forEach(s => { subjectDist[s.subject] = (subjectDist[s.subject] || 0) + 1; });

    return new Response(JSON.stringify({
      success: true,
      summary,
      total_before: allStations.length,
      total_after: finalCount,
      total_deleted: idsToDelete.size,
      subject_distribution: subjectDist,
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
