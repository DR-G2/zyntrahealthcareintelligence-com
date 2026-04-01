import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AMC_SUBJECTS = ["Medicine", "Surgery", "Obstetrics & Gynaecology", "Paediatrics", "Psychiatry", "Population Health"];
const ARCHETYPES = ["strategist", "sprinter", "deep-diver", "second-guesser", "balanced"];
const COUNTRIES = ["India", "Sri Lanka", "Pakistan", "Bangladesh", "Nepal", "Philippines", "Nigeria", "Egypt", "Iran", "Malaysia"];
const COLLEGES = [
  "AIIMS New Delhi", "CMC Vellore", "JIPMER", "KMC Manipal", "Osmania Medical College",
  "Grant Medical College", "Maulana Azad Medical College", "Seth GS Medical College",
  "Colombo Medical Faculty", "Aga Khan University", "King Edward Medical University",
  "Dhaka Medical College", "University of Santo Tomas", "Cairo University Faculty of Medicine"
];
const FIRST_NAMES = ["Aarav","Aditi","Amit","Ananya","Arjun","Diya","Harsh","Isha","Kiran","Lakshmi","Meera","Nikhil","Priya","Rahul","Riya","Rohan","Sanya","Shreya","Varun","Zara","Akash","Neha","Pooja","Raj","Simran","Tanvi","Vikram","Yash","Ayesha","Dev"];
const LAST_NAMES = ["Patel","Sharma","Kumar","Singh","Gupta","Reddy","Nair","Joshi","Mehta","Chatterjee","Das","Shah","Verma","Rao","Pillai","Mishra","Agarwal","Bhat","Desai","Iyer"];

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
// Normal-ish distribution via central limit theorem
function normalRand(mean: number, stddev: number, min: number, max: number): number {
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += Math.random();
  const val = mean + (sum / 6 - 0.5) * 2 * stddev * 3;
  return Math.max(min, Math.min(max, Math.round(val * 100) / 100));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Verify admin
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: adminRole } = await supabase.from("admin_roles").select("role").eq("email", userData.user.email).maybeSingle();
    if (!adminRole || adminRole.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Only Super Admin can seed synthetic users" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const count = Math.min(body.count || 100, 200);

    // Fetch question IDs for generating attempts
    const { data: questionRows } = await supabase
      .from("questions")
      .select("id, category, correct_answer, options")
      .limit(500);
    const questions = questionRows || [];

    const created: string[] = [];
    const errors: string[] = [];

    for (let i = 1; i <= count; i++) {
      const email = `synth-student-${String(i).padStart(3, "0")}@zyntra-demo.test`;
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const name = `${firstName} ${lastName}`;
      const password = `Synth!${crypto.randomUUID().slice(0, 8)}`;

      try {
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: name },
        });

        if (authError) {
          if (authError.message?.includes("already been registered")) {
            errors.push(`${email}: already exists`);
            continue;
          }
          throw authError;
        }

        const userId = authData.user.id;

        // Profile (handle_new_user trigger creates basic row, we update it)
        const examDate = new Date(Date.now() + randInt(30, 365) * 86400000).toISOString().split("T")[0];
        await supabase.from("profiles").update({
          name,
          email,
          user_type: "img",
          exam_stage: pick(["preparing", "booked", "attempted_once"]),
          exam_target: "AMC Part 2",
          exam_date: examDate,
          country_of_origin: pick(COUNTRIES),
          country_of_graduation: pick(COUNTRIES),
          medical_college: pick(COLLEGES),
          current_location: pick(["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Auckland"]),
          graduation_year: randInt(2015, 2024),
          onboarding_complete: true,
          amc1_score: randInt(55, 95),
        }).eq("id", userId);

        // Readiness DNA
        const accuracy = normalRand(68, 15, 35, 98);
        const stability = normalRand(75, 12, 40, 99);
        const timeMgmt = normalRand(55, 20, 20, 130);
        const calibration = normalRand(65, 15, 30, 95);
        const attemptCount = randInt(20, 300);
        const readinessScore = Math.round(accuracy * 0.4 + stability * 0.2 + Math.min(100, (90 / Math.max(timeMgmt, 1)) * 100) * 0.2 + calibration * 0.2);

        await supabase.from("readiness_dna").insert({
          user_id: userId,
          clinical_accuracy: accuracy,
          answer_stability: stability,
          time_management: timeMgmt,
          confidence_calibration: calibration,
          readiness_score: Math.min(100, readinessScore),
          distance_from_ideal: normalRand(40, 25, 5, 120),
          attempt_count: attemptCount,
        });

        // Behavior profile
        await supabase.from("behavior_profiles").insert({
          user_id: userId,
          archetype: pick(ARCHETYPES),
          rush_index: normalRand(15, 12, 0, 80),
          hesitation_index: normalRand(20, 15, 0, 75),
          fatigue_index: normalRand(12, 10, 0, 60),
          predicted_score_low: randInt(45, 65),
          predicted_score_high: randInt(70, 95),
          predicted_score_potential: randInt(75, 99),
        });

        // Subject DNA — all 6 AMC subjects
        const subjectRows = AMC_SUBJECTS.map(subject => ({
          user_id: userId,
          subject,
          accuracy: normalRand(65, 18, 25, 98),
          attempt_count: randInt(5, 80),
          avg_time: normalRand(52, 20, 15, 140),
          stability: normalRand(72, 15, 35, 99),
          gap_score: normalRand(12, 10, 0, 50),
        }));
        await supabase.from("subject_dna").insert(subjectRows);

        // Performance profile
        await supabase.from("performance_profiles").insert({
          user_id: userId,
          clinical_accuracy: accuracy,
          stability_score: stability,
          time_sensitivity: normalRand(50, 20, 10, 95),
          confidence_gap: normalRand(15, 10, 0, 50),
          readiness_score: Math.min(100, readinessScore),
        });

        // User attempts (5-30 per user using real questions)
        if (questions.length > 0) {
          const numAttempts = randInt(5, 30);
          const sessionId = crypto.randomUUID();
          const attemptRows = [];
          for (let a = 0; a < numAttempts && a < questions.length; a++) {
            const q = questions[randInt(0, questions.length - 1)];
            const options = (q.options as string[]) || ["A", "B", "C", "D", "E"];
            const isCorrect = Math.random() < (accuracy / 100);
            const selectedAnswer = isCorrect ? q.correct_answer : pick(options.filter((o: string) => o !== q.correct_answer));
            const answerChanges = Math.random() < 0.3 ? randInt(1, 3) : 0;

            attemptRows.push({
              user_id: userId,
              question_id: q.id,
              session_id: sessionId,
              is_correct: isCorrect,
              selected_answer: selectedAnswer || q.correct_answer,
              time_taken_seconds: randInt(15, 180),
              answer_changes_count: answerChanges,
              question_position: a + 1,
              time_to_first_click: randInt(2, 25),
              pause_events: Math.random() < 0.15 ? 1 : 0,
            });
          }
          // Insert in batch
          const { error: attErr } = await supabase.from("user_attempts").insert(attemptRows);
          if (attErr) console.error(`Attempts error for ${email}:`, attErr.message);
        }

        // Grant full_access subscription
        await supabase.from("manual_overrides").upsert({
          user_id: userId,
          tier: "full_access",
          granted_by: userData.user.email,
          granted_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
        }, { onConflict: "user_id" });

        created.push(email);
      } catch (e: any) {
        errors.push(`${email}: ${e.message}`);
      }
    }

    // Log activity
    await supabase.from("admin_activity_logs").insert({
      admin_email: userData.user.email,
      action_type: "SEED_SYNTHETIC_USERS",
      details: { count: created.length, errors: errors.length },
    });

    return new Response(JSON.stringify({
      success: true,
      created_count: created.length,
      error_count: errors.length,
      created_emails: created.slice(0, 10),
      errors: errors.slice(0, 20),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("admin-seed-synthetic-users error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
