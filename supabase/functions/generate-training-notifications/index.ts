import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Notification {
  user_id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  cta_label?: string;
  cta_route?: string;
  icon?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { trigger = "post_session", session_data } = await req.json().catch(() => ({}));
    const notifications: Notification[] = [];

    // Fetch user data in parallel
    const [readinessRes, behaviorRes, subjectRes, attemptsRes, recentNotifRes, profileRes] =
      await Promise.all([
        supabase.from("readiness_dna").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("behavior_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("subject_dna").select("*").eq("user_id", user.id).order("gap_score", { ascending: false }).limit(5),
        supabase.from("user_attempts").select("created_at, is_correct, time_taken_seconds, answer_changes_count").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("training_notifications").select("category, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("profiles").select("current_location, name").eq("id", user.id).maybeSingle(),
      ]);

    const readiness = readinessRes.data;
    const behavior = behaviorRes.data;
    const subjects = subjectRes.data || [];
    const attempts = attemptsRes.data || [];
    const recentNotifs = recentNotifRes.data || [];
    const profile = profileRes.data;

    // Avoid duplicate notifications (don't repeat same category within 4 hours)
    const recentCategories = new Set(
      recentNotifs
        .filter((n) => {
          const age = Date.now() - new Date(n.created_at).getTime();
          return age < 4 * 60 * 60 * 1000;
        })
        .map((n) => n.category)
    );

    const firstName = profile?.name?.split(" ")[0] || "Doctor";

    // ── PERFORMANCE INSIGHTS ──
    if (trigger === "post_session" && !recentCategories.has("performance")) {
      if (readiness && readiness.attempt_count > 10) {
        const accuracy = readiness.clinical_accuracy || 0;

        if (accuracy >= 75) {
          notifications.push({
            user_id: user.id,
            type: "insight",
            category: "performance",
            title: "Strong clinical accuracy",
            body: `${firstName}, your accuracy is at ${Math.round(accuracy)}%. You're building solid clinical reasoning patterns.`,
            cta_label: "View Performance",
            cta_route: "/intelligence",
            icon: "trending-up",
            priority: 3,
          });
        } else if (accuracy >= 50) {
          notifications.push({
            user_id: user.id,
            type: "insight",
            category: "performance",
            title: "Steady progress",
            body: `Your accuracy is ${Math.round(accuracy)}%. Focus on your weaker subjects to push past 75%.`,
            cta_label: "Review Weak Areas",
            cta_route: "/intelligence",
            icon: "target",
            priority: 4,
          });
        } else {
          notifications.push({
            user_id: user.id,
            type: "nudge",
            category: "performance",
            title: "Build your foundation",
            body: "Focus on understanding core concepts before speed. Quality thinking beats quantity.",
            cta_label: "Start Focused Drill",
            cta_route: "/practice",
            icon: "book-open",
            priority: 5,
          });
        }
      }

      // Session-specific insights
      if (session_data) {
        const { correct, total, avg_time } = session_data;
        if (total > 0) {
          const sessionAcc = (correct / total) * 100;
          if (sessionAcc >= 80) {
            notifications.push({
              user_id: user.id,
              type: "insight",
              category: "session_performance",
              title: "Excellent session",
              body: `${correct}/${total} correct — your clinical reasoning is sharpening. Keep this consistency.`,
              cta_label: "Review Mistakes",
              cta_route: "/practice",
              icon: "award",
              priority: 2,
              metadata: { session_accuracy: sessionAcc },
            });
          }
        }
      }
    }

    // ── BEHAVIOURAL FEEDBACK ──
    if (!recentCategories.has("behavior") && behavior) {
      const rushIndex = Number(behavior.rush_index) || 0;
      const hesitationIndex = Number(behavior.hesitation_index) || 0;

      if (rushIndex > 40) {
        notifications.push({
          user_id: user.id,
          type: "feedback",
          category: "behavior",
          title: "Slow down — key clues are being missed",
          body: `You're rushing through ${Math.round(rushIndex)}% of questions. Clinical stems contain critical information. Read the last line twice.`,
          cta_label: "Practice Mindfully",
          cta_route: "/practice",
          icon: "clock",
          priority: 6,
        });
      } else if (hesitationIndex > 40) {
        notifications.push({
          user_id: user.id,
          type: "feedback",
          category: "behavior",
          title: "Trust your first instinct",
          body: "You're overthinking too many questions. When you've eliminated wrong options, commit to your answer.",
          cta_label: "Trust Your Gut Analysis",
          cta_route: "/intelligence?tab=trust-your-gut",
          icon: "brain",
          priority: 5,
        });
      }

      // Answer changing pattern
      if (attempts.length >= 10) {
        const recentChanges = attempts.slice(0, 20);
        const changeRate =
          recentChanges.filter((a) => a.answer_changes_count > 0).length /
          recentChanges.length;
        if (changeRate > 0.4) {
          notifications.push({
            user_id: user.id,
            type: "feedback",
            category: "behavior_stability",
            title: "You're changing correct answers",
            body: `${Math.round(changeRate * 100)}% of your recent answers were changed. Your first instinct is often right — trust your elimination process.`,
            cta_label: "Review Answer Changes",
            cta_route: "/intelligence?tab=trust-your-gut",
            icon: "repeat",
            priority: 7,
          });
        }
      }
    }

    // ── TRAINING NUDGES (subject-specific) ──
    if (!recentCategories.has("training_nudge") && subjects.length > 0) {
      const weakest = subjects[0];
      if (weakest && (weakest.gap_score || 0) > 20) {
        notifications.push({
          user_id: user.id,
          type: "nudge",
          category: "training_nudge",
          title: `Sharpen your ${weakest.subject} skills`,
          body: `${weakest.subject} is your biggest gap area. A focused 15-question drill can make a real difference.`,
          cta_label: "Drill This Subject",
          cta_route: "/practice",
          icon: "target",
          priority: 4,
          metadata: { subject: weakest.subject },
        });
      }
    }

    // ── INACTIVITY CHECK ──
    if (trigger === "login_check" && !recentCategories.has("inactivity")) {
      if (attempts.length > 0) {
        const lastAttempt = new Date(attempts[0].created_at);
        const daysSince = (Date.now() - lastAttempt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSince >= 5) {
          notifications.push({
            user_id: user.id,
            type: "nudge",
            category: "inactivity",
            title: "You were improving — let's continue",
            body: `It's been ${Math.floor(daysSince)} days. Consistency is the #1 predictor of exam success. Even 10 questions helps.`,
            cta_label: "Quick 10-Question Drill",
            cta_route: "/practice",
            icon: "flame",
            priority: 8,
          });
        } else if (daysSince >= 2) {
          notifications.push({
            user_id: user.id,
            type: "nudge",
            category: "inactivity",
            title: "Let's get back into practice",
            body: "A short focused session keeps your clinical reasoning sharp. Your brain needs regular training.",
            cta_label: "Continue Training",
            cta_route: "/practice",
            icon: "play-circle",
            priority: 6,
          });
        }
      }
    }

    // Insert notifications
    if (notifications.length > 0) {
      await supabase.from("training_notifications").insert(notifications);
    }

    return new Response(
      JSON.stringify({ generated: notifications.length, notifications }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-training-notifications error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
