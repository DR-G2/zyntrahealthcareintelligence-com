import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchCallerPieHistory } from "../_shared/pie-v2.ts";
import { toCompletedCandidateBehaviourAttempts } from "../_shared/pie-v2-history.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-pie-v2-authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!supabaseUrl || !supabaseKey || !anonKey || !lovableKey) {
      return new Response(JSON.stringify({ error: "Behaviour analysis is not configured." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonClient = createClient(supabaseUrl, anonKey);
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve V2 ↔ legacy identity before checking entitlements. Keep both IDs scoped
    // to this authenticated user; do not infer identity from a caller-supplied email.
    const { data: identityMap, error: identityMapError } = await supabase
      .from("pie_identity_map").select("legacy_user_id").eq("v2_user_id", user.id).maybeSingle();
    if (identityMapError) {
      console.error("Behaviour identity lookup failed:", identityMapError);
      return new Response(JSON.stringify({ error: "Behaviour access could not be verified." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const entitlementUserIds = [...new Set([user.id, identityMap?.legacy_user_id].filter((id): id is string => typeof id === "string"))];

    // Paid feature: use the deployed V2 contracts. Query errors fail closed.
    const [paidResult, overrideResult, adminResult] = await Promise.all([
      supabase.from("payments").select("id").in("user_id", entitlementUserIds).eq("status", "active").limit(1),
      supabase.schema("command").from("manual_overrides").select("id,override_data")
        .eq("target_type", "user").in("target_id", entitlementUserIds),
      supabase.schema("command").from("admin_roles").select("id")
        .in("user_id", entitlementUserIds).eq("active", true).limit(1),
    ]);
    if (paidResult.error || overrideResult.error || adminResult.error) {
      console.error("Behaviour entitlement lookup failed:", paidResult.error || overrideResult.error || adminResult.error);
      return new Response(JSON.stringify({ error: "Behaviour access could not be verified." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const nowMs = Date.now();
    const hasValidOverride = (overrideResult.data ?? []).some((row: any) => {
      const data = row?.override_data;
      if (!data || typeof data !== "object" || Array.isArray(data)) return false;
      if (data.feature !== "behavior_analysis" || data.enabled !== true) return false;
      if (data.expires_at == null) return true;
      return typeof data.expires_at === "string" && Number.isFinite(Date.parse(data.expires_at)) && Date.parse(data.expires_at) > nowMs;
    });
    if (!paidResult.data?.length && !hasValidOverride && !adminResult.data?.length) {
      return new Response(JSON.stringify({ error: "subscription_required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Candidate-wide Behaviour combines completed, verified attempts from explicitly labelled comparable MCQ modes.
    const pie = await fetchCallerPieHistory(req, user.email, 1000, { url: supabaseUrl, anonKey });
    if ("error" in pie) {
      const publicError = pie.status === 401 ? "Practice session unavailable. Please sign in again." : pie.status === 403 ? "Practice history is unavailable for this account." : "Practice history is temporarily unavailable.";
      return new Response(JSON.stringify({ error: publicError }), { status: pie.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // The shared selector excludes ambiguous modes and attempts without a completed answer key.
    const attempts = toCompletedCandidateBehaviourAttempts(pie.rows);

    if (attempts.length === 0) {
      return new Response(JSON.stringify({ error: "No completed, verified candidate Behaviour attempts found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── MCQ Metrics ──
    const totalAttempts = attempts.length;
    const timedAttempts = attempts.filter((a) => typeof a.time_taken_seconds === "number" && Number.isFinite(a.time_taken_seconds) && a.time_taken_seconds >= 0);
    const avgTime = timedAttempts.length ? timedAttempts.reduce((s, a) => s + (a.time_taken_seconds as number), 0) / timedAttempts.length : null;
    const changeEvidence = attempts.filter((a) => a.answer_changes_count !== null);
    const changedAttempts = changeEvidence.filter((a) => (a.answer_changes_count as number) > 0).length;
    const changeRate = changeEvidence.length > 0 ? changedAttempts / changeEvidence.length : null;
    const totalRecordedChanges = changeEvidence.reduce((sum, a) => sum + (a.answer_changes_count as number), 0);
    const meanChangesPerAttempt = changeEvidence.length > 0 ? totalRecordedChanges / changeEvidence.length : null;
    const correctRate = totalAttempts > 0 ? attempts.filter(a => a.is_correct).length / totalAttempts : 0;
    
    const firstClickAttempts = attempts.filter((a) => typeof a.time_to_first_click === "number" && Number.isFinite(a.time_to_first_click) && a.time_to_first_click >= 0);
    const avgFirstClick = firstClickAttempts.length ? firstClickAttempts.reduce((s, a) => s + (a.time_to_first_click as number), 0) / firstClickAttempts.length : null;

    // Per-subject MCQ stats
    const subjectMap: Record<string, { correct: number; total: number; changedAttempts: number; totalChanges: number; changeEvidenceCount: number; avgTime: number | null; times: number[] }> = {};
    attempts.forEach(a => {
      const cat = (a.questions as any)?.category || "Unknown";
      if (!subjectMap[cat]) subjectMap[cat] = { correct: 0, total: 0, changedAttempts: 0, totalChanges: 0, changeEvidenceCount: 0, avgTime: 0, times: [] };
      subjectMap[cat].total++;
      if (a.is_correct) subjectMap[cat].correct++;
      if (a.answer_changes_count !== null) { subjectMap[cat].changeEvidenceCount++; subjectMap[cat].totalChanges += a.answer_changes_count; if (a.answer_changes_count > 0) subjectMap[cat].changedAttempts++; }
      if (typeof a.time_taken_seconds === "number" && Number.isFinite(a.time_taken_seconds) && a.time_taken_seconds >= 0) subjectMap[cat].times.push(a.time_taken_seconds);
    });
    Object.values(subjectMap).forEach(s => {
      s.avgTime = s.times.length ? s.times.reduce((a, b) => a + b, 0) / s.times.length : null;
    });

    // Block segmented performance
    const sessions: Record<string, typeof attempts> = {};
    attempts.forEach(a => {
      if (!sessions[a.session_id]) sessions[a.session_id] = [];
      sessions[a.session_id].push(a);
    });

    const blockPerf: Record<string, { accuracy: number; avgTime: number | null; changeRate: number | null; meanChangesPerAttempt: number | null }> = {};
    const latestSession = Object.values(sessions).sort((a, b) =>
      new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime()
    )[0];

    if (latestSession) {
      const segments = [
        { key: "Q1-20", start: 0, end: 20 },
        { key: "Q21-40", start: 20, end: 40 },
        { key: "Q41-60", start: 40, end: 60 },
      ];
      segments.forEach(seg => {
        const slice = latestSession.slice(seg.start, seg.end);
        if (slice.length > 0) {
          blockPerf[seg.key] = {
            accuracy: Math.round((slice.filter(a => a.is_correct).length / slice.length) * 100),
            avgTime: (() => { const validTimes = slice.map((a) => a.time_taken_seconds).filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0); return validTimes.length ? Math.round(validTimes.reduce((sum, v) => sum + v, 0) / validTimes.length) : null; })(),
            changeRate: (() => { const validChanges = slice.filter((a) => a.answer_changes_count !== null); return validChanges.length ? Math.round((validChanges.filter((a) => (a.answer_changes_count as number) > 0).length / validChanges.length) * 100) : null; })(),
            meanChangesPerAttempt: (() => { const validChanges = slice.filter((a) => a.answer_changes_count !== null); return validChanges.length ? validChanges.reduce((sum, a) => sum + (a.answer_changes_count as number), 0) / validChanges.length : null; })(),
          };
        }
      });
    }

    // Fatigue detection
    // Fatigue is a within-session comparison, never a comparison across separate sessions.
    const latestSessionTimedAttempts = (latestSession ?? []).filter((a) =>
      typeof a.time_taken_seconds === "number" && Number.isFinite(a.time_taken_seconds) && a.time_taken_seconds >= 0
    );
    const halfPoint = Math.floor(latestSessionTimedAttempts.length / 2);
    const firstHalfTimes = latestSessionTimedAttempts.slice(0, halfPoint).map((a) => a.time_taken_seconds as number);
    const secondHalfTimes = latestSessionTimedAttempts.slice(halfPoint).map((a) => a.time_taken_seconds as number);
    const firstHalfAvgTime = firstHalfTimes.length ? firstHalfTimes.reduce((sum, value) => sum + value, 0) / firstHalfTimes.length : null;
    const secondHalfAvgTime = secondHalfTimes.length ? secondHalfTimes.reduce((sum, value) => sum + value, 0) / secondHalfTimes.length : null;
    const fatigueIncrease = firstHalfAvgTime !== null && firstHalfAvgTime > 0 && secondHalfAvgTime !== null ? secondHalfAvgTime / firstHalfAvgTime : null;

    // Candidate-wide summary plus a mode-labelled context breakdown. These are
    // descriptive strata, not independent candidate profiles or comparative grades.
    const modeBreakdown = Object.fromEntries(
      [...new Set(attempts.map((a) => a.session_mode))].sort().map((mode) => {
        const modeRows = attempts.filter((a) => a.session_mode === mode);
        const modeTimed = modeRows.filter((a) => typeof a.time_taken_seconds === "number" && Number.isFinite(a.time_taken_seconds) && a.time_taken_seconds >= 0);
        const modeChangeEvidence = modeRows.filter((a) => a.answer_changes_count !== null);
        return [mode, {
          attempts: modeRows.length,
          accuracy: modeRows.length ? Math.round((modeRows.filter((a) => a.is_correct).length / modeRows.length) * 100) : null,
          avgTime: modeTimed.length ? Math.round(modeTimed.reduce((sum, a) => sum + (a.time_taken_seconds as number), 0) / modeTimed.length) : null,
          changeRate: modeChangeEvidence.length ? Math.round((modeChangeEvidence.filter((a) => (a.answer_changes_count ?? 0) > 0).length / modeChangeEvidence.length) * 100) : null,
          changeEvidenceCount: modeChangeEvidence.length,
        }];
      })
    );

    // Build unified signals
    const signals = {
      totalAttempts,
      modeBreakdown,
      avgTime: avgTime === null ? null : Math.round(avgTime),
      changeRate: changeRate === null ? null : Math.round(changeRate * 100) / 100,
      meanChangesPerAttempt: meanChangesPerAttempt === null ? null : Math.round(meanChangesPerAttempt * 100) / 100,
      correctRate: Math.round(correctRate * 100) / 100,
      
      avgFirstClick: avgFirstClick === null ? null : Math.round(avgFirstClick),
      fatigueIncrease: fatigueIncrease === null ? null : Math.round(fatigueIncrease * 100) / 100,
      subjectStats: Object.entries(subjectMap).map(([cat, s]) => ({
        category: cat,
        accuracy: Math.round((s.correct / s.total) * 100),
        changeRate: s.changeEvidenceCount > 0 ? Math.round((s.changedAttempts / s.changeEvidenceCount) * 100) : null,
        meanChangesPerAttempt: s.changeEvidenceCount > 0 ? Math.round((s.totalChanges / s.changeEvidenceCount) * 100) / 100 : null,
        avgTime: s.avgTime === null ? null : Math.round(s.avgTime),
        total: s.total,
      })),
      blockPerformance: blockPerf,
      // OSCE
      // Trust Your Gut
    };

    // AI classification
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a candidate-wide MCQ practice behaviour analyst. Describe patterns supported by completed attempts from explicitly labelled comparable MCQ modes. Use modeBreakdown only as context; do not assume differences between modes prove a candidate trait. Do not combine OSCE telemetry because it uses a different evidence contract. Trust Your Gut is a related but distinct answer-change view. If a metric is null or unavailable, do not infer or replace it. Change rates use only valid recorded change-count observations; null means unavailable, not zero. The top-level changeRate is a fraction from 0 to 1; subjectStats and blockPerformance changeRate values are percentages from 0 to 100. meanChangesPerAttempt is the mean recorded change count per attempt with valid count evidence; null means unavailable. Do not predict exam scores, pass likelihood, or clinical readiness.\n\nArchetypes:
- panic_changer: only when meanChangesPerAttempt is greater than 2 and avgTime is available; first-instinct correctness is not supplied
- rusher: only when avgTime is under 45 seconds and correctRate is available; question difficulty is not supplied, so do not claim hard-question errors
- paralyzer: only when avgTime is greater than 300 seconds and correctRate is available; pause data is unavailable
- strategist: only when changeRate and avgTime are available and at least two blocks have valid timing and change-rate evidence; elimination behaviour is not supplied, and do not label this optimal
- fatigue_victim: only when fatigueIncrease is at least 1.4 (a 40% increase over baseline) and later-block meanChangesPerAttempt is greater than the early block; if those signals are unavailable, do not classify
- subject_avoider: only when at least two subjectStats entries show an observed accuracy or timing difference; stress markers are not supplied
- unavailable: use when the required signals for a supported archetype are absent; return no trap flags or recommendations because no pattern-specific intervention is supported

Trap flags:
- rushing_at_end is the only supported trap flag, and only when Q1-20 and Q41-60 both have valid timing and accuracy, with the later block faster and less accurate
- first-instinct correctness, question-stem subtype, eliminated options, pauses, and re-reads are not supplied; do not emit any trap flag that requires those observations

The top-level changeRate is a fraction from 0 to 1; subjectStats and blockPerformance changeRate values are percentages from 0 to 100. meanChangesPerAttempt is the mean recorded change count per attempt with valid count evidence; null means unavailable. Do not infer personality, motivation, clinical competence, causation, exam score, pass likelihood, or clinical readiness from these behavioural signals.`,
          },
          {
            role: "user",
            content: `Analyze this candidate's candidate-wide behavioural evidence, preserving practice-mode context:\n${JSON.stringify(signals, null, 2)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_behavior",
              description: "Summarize candidate-wide observed MCQ behaviour using explicitly labelled, comparable modes and preserve mode context; do not generate exam-score or pass predictions.",
              parameters: {
                type: "object",
                properties: {
                  archetype: {
                    type: "string",
                    enum: ["panic_changer", "rusher", "paralyzer", "strategist", "fatigue_victim", "subject_avoider", "unavailable"],
                  },
                  trap_flags: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        trap: { type: "string", enum: ["rushing_at_end"] },
                        description: { type: "string" },
                        severity: { type: "string", enum: ["low", "medium", "high"] },
                      },
                      required: ["trap", "description", "severity"],
                    },
                  },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                        action_link: { type: "string" },
                      },
                      required: ["title", "description", "priority"],
                    },
                  },
                  critical_finding: { type: "string" },
                },
                required: ["archetype", "trap_flags", "recommendations", "critical_finding"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_behavior" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI classification failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let classification;
    try {
      if (!toolCall?.function?.arguments) throw new Error("Missing classification arguments");
      classification = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Behaviour classification unavailable; no unsupported pattern was substituted." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedArchetypes = new Set(["panic_changer", "rusher", "paralyzer", "strategist", "fatigue_victim", "subject_avoider", "unavailable"]);
    const finiteMetric = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
    const blocks = signals.blockPerformance && typeof signals.blockPerformance === "object" ? signals.blockPerformance : {};
    const earlyBlock = (blocks as Record<string, any>)["Q1-20"];
    const lateBlock = (blocks as Record<string, any>)["Q41-60"];
    const hasRushingAtEndEvidence = finiteMetric(earlyBlock?.avgTime) && finiteMetric(lateBlock?.avgTime)
      && finiteMetric(earlyBlock?.accuracy) && finiteMetric(lateBlock?.accuracy)
      && lateBlock.avgTime < earlyBlock.avgTime && lateBlock.accuracy < earlyBlock.accuracy;
    const subjectStats = Array.isArray(signals.subjectStats) ? signals.subjectStats : [];
    const hasSubjectDifference = subjectStats.some((subject: any, index: number) => subjectStats.slice(index + 1).some((other: any) =>
      (finiteMetric(subject.accuracy) && finiteMetric(other.accuracy) && subject.accuracy !== other.accuracy)
      || (finiteMetric(subject.avgTime) && finiteMetric(other.avgTime) && subject.avgTime !== other.avgTime)));
    const hasBlockTimingAndChangeEvidence = Object.values(blocks as Record<string, any>).filter((block: any) =>
      finiteMetric(block?.avgTime) && finiteMetric(block?.meanChangesPerAttempt)).length >= 2;
    const hasFatigueTrend = finiteMetric(signals.fatigueIncrease) && signals.fatigueIncrease >= 1.4
      && finiteMetric(signals.meanChangesPerAttempt) && signals.meanChangesPerAttempt > 0
      && finiteMetric(earlyBlock?.meanChangesPerAttempt) && finiteMetric(lateBlock?.meanChangesPerAttempt)
      && lateBlock.meanChangesPerAttempt > earlyBlock.meanChangesPerAttempt;
    const archetypeHasEvidence = (archetype: string): boolean => {
      switch (archetype) {
        case "panic_changer": return finiteMetric(signals.meanChangesPerAttempt) && signals.meanChangesPerAttempt > 2 && finiteMetric(signals.avgTime);
        case "rusher": return finiteMetric(signals.avgTime) && signals.avgTime < 45 && finiteMetric(signals.correctRate);
        case "paralyzer": return finiteMetric(signals.avgTime) && signals.avgTime > 300 && finiteMetric(signals.correctRate);
        case "strategist": return finiteMetric(signals.meanChangesPerAttempt) && signals.meanChangesPerAttempt > 0 && finiteMetric(signals.avgTime) && hasBlockTimingAndChangeEvidence;
        case "fatigue_victim": return hasFatigueTrend;
        case "subject_avoider": return hasSubjectDifference;
        case "unavailable": return true;
        default: return false;
      }
    };
    const trapFlagsSupported = Array.isArray(classification?.trap_flags) && classification.trap_flags.every((item: any) =>
      item?.trap === "rushing_at_end" && hasRushingAtEndEvidence);
    const unsupportedClaimPattern = /\b(?:predict(?:ed|ion)?\s+(?:(?:your|an?)\s+)?(?:(?:AMC|exam)\s+)?score|score\s+(?:range|prediction|estimate)|pass\s+(?:score|rate|likelihood|probability|chance|prediction|percentage)|guarantee(?:d)?\s+(?:you\s+)?(?:will\s+)?pass|you\s+will\s+pass|you\s+should\s+pass|readiness|out\s+of\s+300)\b/i;
    const visibleClaimsSupported = classification
      && typeof classification.critical_finding === "string"
      && !unsupportedClaimPattern.test(classification.critical_finding)
      && Array.isArray(classification.trap_flags)
      && classification.trap_flags.every((item: any) => typeof item?.description === "string" && !unsupportedClaimPattern.test(item.description))
      && Array.isArray(classification.recommendations)
      && classification.recommendations.every((item: any) =>
        typeof item?.title === "string" && typeof item?.description === "string"
        && !unsupportedClaimPattern.test(item.title) && !unsupportedClaimPattern.test(item.description));
    const validClassification = classification
      && typeof classification === "object"
      && allowedArchetypes.has(classification.archetype)
      && archetypeHasEvidence(classification.archetype)
      && typeof classification.critical_finding === "string"
      && Array.isArray(classification.trap_flags)
      && trapFlagsSupported
      && visibleClaimsSupported
      && (classification.archetype !== "unavailable" || (classification.trap_flags.length === 0 && classification.recommendations.length === 0))
      && classification.trap_flags.every((item: any) => item
        && typeof item.trap === "string"
        && typeof item.description === "string"
        && ["low", "medium", "high"].includes(item.severity))
      && Array.isArray(classification.recommendations)
      && classification.recommendations.every((item: any) => item
        && typeof item.title === "string"
        && typeof item.description === "string"
        && ["high", "medium", "low"].includes(item.priority));

    if (!validClassification) {
      return new Response(JSON.stringify({ error: "Behaviour classification unavailable; returned evidence was invalid." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert behavior_profiles
    const profileData = {
      user_id: user.id,
      session_mode: "candidate_wide",
      evidence_count: totalAttempts,
      model_version: "behavior-v1",
      archetype: classification.archetype,
      archetype_signals: signals,
      block_performance: blockPerf,
      subject_patterns: Object.fromEntries(
        Object.entries(subjectMap).map(([cat, s]) => [cat, {
          accuracy: Math.round((s.correct / s.total) * 100),
          changeRate: s.changeEvidenceCount > 0 ? Math.round((s.changedAttempts / s.changeEvidenceCount) * 100) : null,
          avgTime: s.avgTime === null ? null : Math.round(s.avgTime),
          total: s.total,
          type: s.changeEvidenceCount === 0 ? "unavailable" : (s.totalChanges / s.changeEvidenceCount) > 0.5 ? "behavioral" : (s.correct / s.total) < 0.5 ? "knowledge" : "stable",
        }])
      ),
      trap_flags: classification.trap_flags,
      // Historical score prediction fields are deliberately cleared; no validated score model exists.
      predicted_score_low: null,
      predicted_score_high: null,
      predicted_score_potential: null,
      recommendations: classification.recommendations,
      updated_at: new Date().toISOString(),
    };

    const { data: existingProfile, error: profileLookupError } = await supabase
      .schema("intelligence").from("behavior_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileLookupError) {
      console.error("Behaviour profile lookup failed:", profileLookupError);
      return new Response(JSON.stringify({ error: "Behaviour profile could not be saved." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: profileWriteError } = existingProfile
      ? await supabase.schema("intelligence").from("behavior_profiles").update(profileData).eq("user_id", user.id)
      : await supabase.schema("intelligence").from("behavior_profiles").insert(profileData);

    if (profileWriteError) {
      console.error("Behaviour profile write failed:", profileWriteError);
      return new Response(JSON.stringify({ error: "Behaviour profile could not be saved." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ...classification,
      signals,
      block_performance: blockPerf,
      subject_patterns: profileData.subject_patterns,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-behavior error:", e);
    return new Response(JSON.stringify({ error: "Behaviour analysis is temporarily unavailable." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
