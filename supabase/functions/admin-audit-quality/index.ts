import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["gopalrock.naren@gmail.com", "amc.osce.2026@gmail.com", "testuser123@zyntr.website"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const email = claims.claims.email as string;
    if (!ADMIN_EMAILS.includes(email)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Scan MCQs
    const { data: mcqs, error: mcqErr } = await admin
      .from("questions")
      .select("id, zyntra_id, question_text, options, correct_answer, explanation, category");
    if (mcqErr) throw mcqErr;

    const mcqFlags: any[] = [];
    for (const q of mcqs || []) {
      const reasons: string[] = [];
      const opts = Array.isArray(q.options) ? q.options : [];
      if (opts.length < 5) reasons.push(`< 5 options (${opts.length})`);
      const wordCount = (q.question_text || "").split(/\s+/).filter(Boolean).length;
      if (wordCount < 80) reasons.push(`short stem (${wordCount} words)`);
      if (!q.explanation) reasons.push("missing explanation");
      if (!q.correct_answer) reasons.push("missing correct_answer");
      if (!q.category) reasons.push("missing category");
      if (reasons.length > 0) {
        mcqFlags.push({
          id: q.id,
          zyntra_id: q.zyntra_id,
          title: (q.question_text || "").substring(0, 80) + ((q.question_text || "").length > 80 ? "..." : ""),
          reasons,
        });
      }
    }

    // Scan OSCE stations
    const { data: stations, error: osceErr } = await admin
      .from("clinical_stations")
      .select("id, zyntra_id, scenario_title, candidate_instructions, examiner_instructions, marking_checklist");
    if (osceErr) throw osceErr;

    const osceFlags: any[] = [];
    for (const s of stations || []) {
      const reasons: string[] = [];
      if (!s.scenario_title) reasons.push("missing scenario_title");
      if (!s.candidate_instructions) reasons.push("missing candidate_instructions");
      if (!s.examiner_instructions) reasons.push("missing examiner_instructions");
      const checklist = Array.isArray(s.marking_checklist) ? s.marking_checklist : [];
      if (checklist.length === 0) reasons.push("missing/empty checklist");
      if (reasons.length > 0) {
        osceFlags.push({
          id: s.id,
          zyntra_id: s.zyntra_id,
          title: (s.scenario_title || "Untitled").substring(0, 80),
          reasons,
        });
      }
    }

    return new Response(JSON.stringify({
      mcq: { total: (mcqs || []).length, flagged: mcqFlags.length, flags: mcqFlags },
      osce: { total: (stations || []).length, flagged: osceFlags.length, flags: osceFlags },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
