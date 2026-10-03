import { corsHeaders, json, requireUser, serviceClient, safeLabel } from "../_shared/auth.ts";

const OPENAI_API = "https://api.openai.com/v1";

function jsonHeaders() {
  return { ...corsHeaders, "Content-Type": "application/json" };
}

function encryptPlaintext(plaintext: string, secret: string): string {
  // V1 uses WebCrypto AES-GCM with a SHA-256 derived key.
  // The plaintext never returns to the client after this function completes.
  throw new Error("Encryption helper must run in async path");
}

async function deriveCryptoKey(secret: string) {
  const bytes = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptApiKey(value: string, secret: string): Promise<string> {
  const key = await deriveCryptoKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  const out = new Uint8Array(iv.length + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...out));
}

async function decryptApiKey(value: string, secret: string): Promise<string> {
  const raw = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const ciphertext = raw.slice(12);
  const key = await deriveCryptoKey(secret);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

function validateGeneratedQuestions(payload: unknown) {
  if (!Array.isArray(payload)) return null;
  const cleaned = payload.map((q: any) => {
    if (!q || typeof q !== "object" || typeof q.stem !== "string" || !Array.isArray(q.options) || q.options.length < 2 || typeof q.correct_answer !== "string" || typeof q.explanation !== "string") return null;
    const options = q.options.filter((o: unknown): o is string => typeof o === "string").map(o => o.slice(0, 1000));
    if (!options.length || !options.includes(q.correct_answer)) return null;
    return { stem: q.stem.slice(0, 5000), options, correct_answer: q.correct_answer.slice(0, 1000), explanation: q.explanation.slice(0, 5000) };
  });
  return cleaned.every(Boolean) ? cleaned : null;
}

async function buildContext(sb: ReturnType<typeof serviceClient>, userId: string) {
  const [r, s, b] = await Promise.all([
    sb.from("readiness_dna").select("clinical_accuracy, answer_stability, time_management, confidence_calibration, readiness_score, distance_from_ideal, attempt_count").eq("user_id", userId).maybeSingle(),
    sb.from("subject_dna").select("subject, accuracy, attempt_count, avg_time, stability, gap_score").eq("user_id", userId).order("gap_score", { ascending: false }).limit(8),
    sb.from("behavior_profiles").select("archetype, rush_index, hesitation_index, fatigue_index").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    readiness: r.data ?? null,
    subjects: s.data ?? [],
    behavior: b.data ?? null,
  };
}

function systemPrompt(context: any) {
  return [
    "You are an external AI training assistant operating inside Zyntra AI Lab.",
    "Use the supplied Zyntra Training Context only to personalize educational guidance.",
    "Do not claim to be the AMC, do not claim official assessment status, and do not expose hidden Zyntra algorithms.",
    "Treat the candidate context as private and do not infer information that is not supplied.",
    "For question generation, create AMC-style single-best-answer educational practice, not copied official questions.",
    "",
    "BOUNDED ZYNTRA TRAINING CONTEXT:",
    JSON.stringify(context),
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const caller = await requireUser(req);
  if (caller instanceof Response) return caller;

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const sb = serviceClient();
  const encryptionSecret = Deno.env.get("AI_LAB_ENCRYPTION_SECRET");
  if (!encryptionSecret) return json({ success: false, error: "AI Lab encryption secret is not configured." }, 500);

  try {
    if (action === "connect") {
      if (body.provider !== "openai" || typeof body.api_key !== "string" || !body.api_key.trim()) {
        return json({ success: false, error: "OpenAI API key is required." }, 400);
      }
      const apiKey = body.api_key.trim();
      const response = await fetch(`${OPENAI_API}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!response.ok) return json({ success: false, error: "OpenAI rejected the API credential." }, 400);
      const encrypted = await encryptApiKey(apiKey, encryptionSecret);
      const defaultModel = "gpt-5.6";
      await sb.from("ai_lab_connections").upsert({
        user_id: caller.userId,
        provider: "openai",
        encrypted_api_key: encrypted,
        selected_model: defaultModel,
        status: "connected",
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider" });
      return json({ success: true, model: defaultModel });
    }

    if (action === "disconnect") {
      await sb.from("ai_lab_connections").delete().eq("user_id", caller.userId).eq("provider", "openai");
      return json({ success: true });
    }

    if (action === "run") {
      if (body.provider !== "openai") return json({ success: false, error: "Provider not supported in V1." }, 400);
      const connection = await sb.from("ai_lab_connections").select("encrypted_api_key, selected_model").eq("user_id", caller.userId).eq("provider", "openai").maybeSingle();
      if (connection.error || !connection.data) return json({ success: false, error: "Connect OpenAI before starting an AI Lab session." }, 400);
      const apiKey = await decryptApiKey(connection.data.encrypted_api_key, encryptionSecret);
      const model = safeLabel(body.model, connection.data.selected_model || "gpt-5.6", 80);
      const mode = safeLabel(body.mode, "performance", 30);
      const useIntelligence = body.use_intelligence !== false;
      const context = useIntelligence ? await buildContext(sb, caller.userId) : null;

      let userTask = "";
      if (mode === "performance") {
        userTask = typeof body.prompt === "string" ? body.prompt.slice(0, 4000) : "";
        if (!userTask) return json({ success: false, error: "A prompt is required." }, 400);
      } else if (mode === "questions") {
        const g = body.generation ?? {};
        const subject = safeLabel(g.subject, "Adult Medicine");
        const focus = safeLabel(g.focus, "Clinical reasoning");
        const difficulty = safeLabel(g.difficulty, "moderate");
        const count = Math.min(10, Math.max(1, Number(g.count) || 5));
        userTask = `Generate ${count} AMC-style single-best-answer practice questions. Subject: ${subject}. Focus: ${focus}. Difficulty: ${difficulty}. Return ONLY a JSON array. Each object must contain stem, options, correct_answer and explanation.`;
      } else {
        userTask = "Design a focused educational weak-area drill from the supplied training context. Ask one question or exercise at a time and adapt to the candidate's responses.";
      }

      const messages = [
        { role: "system", content: systemPrompt(context) },
        { role: "user", content: userTask },
      ];
      const response = await fetch(`${OPENAI_API}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: mode === "questions" ? 5000 : 1800 }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return json({ success: false, error: result?.error?.message || "OpenAI request failed." }, 400);

      const responseText = result?.choices?.[0]?.message?.content ?? "";
      let rendered: unknown = responseText;
      if (mode === "questions") {
        try {
          const parsed = JSON.parse(responseText);
          rendered = validateGeneratedQuestions(parsed);
          if (!rendered) return json({ success: false, error: "AI returned an invalid question structure." }, 502);
        } catch {
          return json({ success: false, error: "AI returned malformed question JSON." }, 502);
        }
      }

      await sb.from("ai_lab_sessions").insert({
        user_id: caller.userId,
        provider: "openai",
        model,
        mode,
        use_intelligence: useIntelligence,
        status: "completed",
        prompt: userTask,
        response_text: typeof rendered === "string" ? rendered : JSON.stringify(rendered),
        request_tokens: result?.usage?.prompt_tokens ?? null,
        response_tokens: result?.usage?.completion_tokens ?? null,
        updated_at: new Date().toISOString(),
      });

      return json({ success: true, mode, result: rendered, usage: result?.usage ?? null });
    }

    return json({ success: false, error: "Unsupported AI Lab action." }, 400);
  } catch (error) {
    console.error("ai-lab error", error);
    return json({ success: false, error: "AI Lab request failed." }, 500);
  }
});
