import { corsHeaders, json, requireUser, serviceClient, safeLabel } from "../_shared/auth.ts";

const OPENAI_API = "https://api.openai.com/v1";
const SUPPORTED_MODELS = new Set([
  "gpt-6-astra",
  "gpt-6-sol",
  "gpt-6-luna",
  "gpt-6.1-sol",
  "gpt-5.6-sol",
]);

const QUESTION_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      stem: { type: "string" },
      options: { type: "array", items: { type: "string" }, minItems: 2 },
      correct_answer: { type: "string" },
      explanation: { type: "string" },
    },
    required: ["stem", "options", "correct_answer", "explanation"],
  },
};

async function deriveCryptoKey(secret: string) {
  const bytes = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptApiKey(value: string, secret: string): Promise<string> {
  const key = await deriveCryptoKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
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
    if (
      !q ||
      typeof q !== "object" ||
      typeof q.stem !== "string" ||
      !Array.isArray(q.options) ||
      q.options.length < 2 ||
      typeof q.correct_answer !== "string" ||
      typeof q.explanation !== "string"
    ) return null;

    const options = q.options
      .filter((o: unknown): o is string => typeof o === "string")
      .map(o => o.slice(0, 1000));

    if (!options.length || !options.includes(q.correct_answer)) return null;

    return {
      stem: q.stem.slice(0, 5000),
      options,
      correct_answer: q.correct_answer.slice(0, 1000),
      explanation: q.explanation.slice(0, 5000),
    };
  });

  return cleaned.every(Boolean) ? cleaned : null;
}

async function buildContext(sb: ReturnType<typeof serviceClient>, userId: string) {
  const [r, s, b] = await Promise.all([
    sb.from("readiness_dna")
      .select("clinical_accuracy, answer_stability, time_management, confidence_calibration, readiness_score, distance_from_ideal, attempt_count")
      .eq("user_id", userId)
      .maybeSingle(),
    sb.from("subject_dna")
      .select("subject, accuracy, attempt_count, avg_time, stability, gap_score")
      .eq("user_id", userId)
      .order("gap_score", { ascending: false })
      .limit(8),
    sb.from("behavior_profiles")
      .select("archetype, rush_index, hesitation_index, fatigue_index")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return {
    readiness: r.data ?? null,
    subjects: s.data ?? [],
    behavior: b.data ?? null,
  };
}

function systemPrompt(context: unknown) {
  return [
    "You are an external AI training assistant operating inside Zyntra AI Lab.",
    "Use the supplied Zyntra Training Context only to personalize educational guidance.",
    "Do not claim to be the AMC, do not claim official assessment status, and do not expose hidden Zyntra algorithms.",
    "Treat candidate context as private and do not infer information that is not supplied.",
    "For question generation, create AMC-style single-best-answer educational practice, not copied official questions.",
    "",
    "BOUNDED ZYNTRA TRAINING CONTEXT:",
    JSON.stringify(context),
  ].join("\n");
}

async function getAvailableModels(apiKey: string): Promise<string[]> {
  const response = await fetch(`${OPENAI_API}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload?.error?.message === "string"
      ? payload.error.message
      : "OpenAI rejected the API credential.";
    throw new Error(message);
  }

  if (!Array.isArray(payload?.data)) return [];

  return payload.data
    .map((m: any) => typeof m?.id === "string" ? m.id : "")
    .filter((id: string) => SUPPORTED_MODELS.has(id));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const caller = await requireUser(req);
  if (caller instanceof Response) return caller;

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const sb = serviceClient();
  const encryptionSecret = Deno.env.get("AI_LAB_ENCRYPTION_SECRET");

  if (!encryptionSecret) {
    return json({
      success: false,
      error: "AI Lab encryption secret is not configured on the server.",
    }, 500);
  }

  try {
    if (action === "status") {
      const { data, error } = await sb
        .from("ai_lab_connections")
        .select("selected_model, status")
        .eq("user_id", caller.userId)
        .eq("provider", "openai")
        .maybeSingle();

      if (error) {
        console.error("ai-lab status database error", error);
        return json({ success: false, error: "Unable to read the provider connection." }, 500);
      }

      if (!data || data.status !== "connected") {
        return json({ success: true, connected: false, models: [] });
      }

      const available = [...SUPPORTED_MODELS];
      const selectedModel = available.includes(data.selected_model ?? "")
        ? data.selected_model
        : available[0] ?? null;

      return json({
        success: true,
        connected: true,
        model: selectedModel,
        models: available,
      });
    }

    if (action === "connect") {
      if (body.provider !== "openai" || typeof body.api_key !== "string" || !body.api_key.trim()) {
        return json({ success: false, error: "OpenAI API key is required." }, 400);
      }

      const apiKey = body.api_key.trim();
      const models = await getAvailableModels(apiKey);

      if (!models.length) {
        return json({
          success: false,
          error: "The API credential was accepted, but no supported text model is available to this credential.",
        }, 403);
      }

      const preferred = ["gpt-6-luna", "gpt-6-sol", "gpt-6.1-sol", "gpt-5.6-sol", "gpt-6-astra"];
      const defaultModel = preferred.find(id => models.includes(id)) ?? models[0];

      const encrypted = await encryptApiKey(apiKey, encryptionSecret);

      const { error } = await sb.from("ai_lab_connections").upsert({
        user_id: caller.userId,
        provider: "openai",
        encrypted_api_key: encrypted,
        selected_model: defaultModel,
        status: "connected",
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider" });

      if (error) {
        console.error("ai-lab connection save error", error);
        return json({ success: false, error: "Unable to save the provider connection." }, 500);
      }

      return json({ success: true, model: defaultModel, models });
    }

    if (action === "disconnect") {
      const { error } = await sb
        .from("ai_lab_connections")
        .delete()
        .eq("user_id", caller.userId)
        .eq("provider", "openai");

      if (error) {
        console.error("ai-lab disconnect error", error);
        return json({ success: false, error: "Unable to disconnect the provider." }, 500);
      }

      return json({ success: true });
    }

    if (action === "run") {
      if (body.provider !== "openai") {
        return json({ success: false, error: "Provider not supported in V1." }, 400);
      }

      const connection = await sb
        .from("ai_lab_connections")
        .select("encrypted_api_key, selected_model")
        .eq("user_id", caller.userId)
        .eq("provider", "openai")
        .maybeSingle();

      if (connection.error || !connection.data) {
        return json({ success: false, error: "Connect OpenAI before starting an AI Lab session." }, 400);
      }

      const requestedModel = safeLabel(body.model, connection.data.selected_model || "");
      if (!SUPPORTED_MODELS.has(requestedModel)) {
        return json({ success: false, error: "Unsupported model selected." }, 400);
      }

      const apiKey = await decryptApiKey(connection.data.encrypted_api_key, encryptionSecret);
      const model = requestedModel;
      const mode = safeLabel(body.mode, "performance", 30);

      if (!["performance", "questions", "weak-area"].includes(mode)) {
        return json({ success: false, error: "Unsupported AI Lab mode." }, 400);
      }

      const useIntelligence = body.use_intelligence === true;
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

        userTask =
          `Generate ${count} AMC-style single-best-answer practice questions. Subject: ${subject}. Focus: ${focus}. Difficulty: ${difficulty}. Return ONLY the requested structured question array.`;
      } else {
        if (!useIntelligence) {
          return json({ success: false, error: "Enable Training Context for Weak Area Drill." }, 400);
        }
        userTask =
          "Design a focused educational weak-area drill from the supplied training context. Ask one question or exercise at a time and adapt to the candidate's responses.";
      }

      const requestBody: Record<string, unknown> = {
        model,
        instructions: systemPrompt(context),
        input: userTask,
        max_output_tokens: mode === "questions" ? 5000 : 1800,
      };

      if (mode === "questions") {
        requestBody.text = {
          format: {
            type: "json_schema",
            name: "amc_questions",
            strict: true,
            schema: QUESTION_SCHEMA,
          },
        };
      }

      const response = await fetch(`${OPENAI_API}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = typeof result?.error?.message === "string"
          ? result.error.message
          : "OpenAI request failed.";
        return json({ success: false, error: message }, response.status >= 400 && response.status < 500 ? response.status : 502);
      }

      const responseText = typeof result?.output_text === "string"
        ? result.output_text
        : "";

      if (!responseText) {
        return json({ success: false, error: "OpenAI returned an empty response." }, 502);
      }

      let rendered: unknown = responseText;

      if (mode === "questions") {
        try {
          const parsed = JSON.parse(responseText);
          rendered = validateGeneratedQuestions(parsed);

          if (!rendered) {
            return json({ success: false, error: "AI returned an invalid question structure." }, 502);
          }
        } catch {
          return json({ success: false, error: "AI returned malformed question JSON." }, 502);
        }
      }

      const usage = result?.usage ?? {};
      const { error: sessionError } = await sb.from("ai_lab_sessions").insert({
        user_id: caller.userId,
        provider: "openai",
        model,
        mode,
        use_intelligence: useIntelligence,
        status: "completed",
        prompt: userTask,
        response_text: typeof rendered === "string" ? rendered : JSON.stringify(rendered),
        request_tokens: usage?.input_tokens ?? null,
        response_tokens: usage?.output_tokens ?? null,
        updated_at: new Date().toISOString(),
      });

      if (sessionError) {
        console.error("ai-lab session save error", sessionError);
        return json({ success: false, error: "AI completed, but the session could not be saved." }, 500);
      }

      return json({
        success: true,
        mode,
        result: rendered,
        usage,
      });
    }

    return json({ success: false, error: "Unsupported AI Lab action." }, 400);
  } catch (error) {
    console.error("ai-lab error", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "AI Lab request failed.",
    }, 500);
  }
});
