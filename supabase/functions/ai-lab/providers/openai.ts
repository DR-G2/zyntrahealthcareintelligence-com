import { LabError, type GenerateInput, type ProviderAdapter, type Usage } from "./types.ts";

const API = "https://api.openai.com/v1";
const PREFERRED = ["gpt-6-luna", "gpt-6-sol", "gpt-6.1-sol", "gpt-5.6-sol", "gpt-6-astra"];
const EXCLUDE = /(audio|realtime|tts|transcribe|whisper|image|dall-e|embedding|moderation|search|codex|instruct)/i;

function isTextModel(id: string) {
  return /^(gpt-[4-9]|o[1-9])/i.test(id) && !EXCLUDE.test(id);
}

async function mapError(res: Response): Promise<never> {
  const payload = await res.json().catch(() => ({}));
  const msg = typeof payload?.error?.message === "string" ? payload.error.message.slice(0, 300) : undefined;
  if (res.status === 401) throw new LabError("INVALID_PROVIDER_KEY", "OpenAI rejected this API key.", 401, msg);
  if (res.status === 403) throw new LabError("PROVIDER_ACCESS_DENIED", "This API key does not have access to that OpenAI resource.", 403, msg);
  if (res.status === 429) {
    const retry = res.headers.get("retry-after");
    throw new LabError("PROVIDER_RATE_LIMIT", "OpenAI rate limit or quota reached. Wait and try again, or check your OpenAI usage limits.", 429, retry ? `Retry after ${retry}s` : msg);
  }
  if (res.status >= 400 && res.status < 500) throw new LabError("PROVIDER_ERROR", "OpenAI rejected the request.", 400, msg);
  throw new LabError("PROVIDER_ERROR", "OpenAI is unavailable right now. Try again shortly.", 502, msg);
}

function extractText(result: any): string {
  if (typeof result?.output_text === "string" && result.output_text) return result.output_text;
  const parts: string[] = [];
  for (const item of Array.isArray(result?.output) ? result.output : []) {
    if (item?.type !== "message") continue;
    for (const c of Array.isArray(item.content) ? item.content : []) {
      if (c?.type === "output_text" && typeof c.text === "string") parts.push(c.text);
      if (c?.type === "refusal") throw new LabError("INVALID_MODEL_RESPONSE", "The model declined this request.", 422);
    }
  }
  return parts.join("");
}

export const openaiAdapter: ProviderAdapter = {
  id: "openai",

  async listModels(apiKey) {
    const res = await fetch(`${API}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) await mapError(res);
    const payload = await res.json().catch(() => ({}));
    const ids: string[] = Array.isArray(payload?.data) ? payload.data.map((m: any) => (typeof m?.id === "string" ? m.id : "")) : [];
    return ids.filter(isTextModel).sort();
  },

  preferredModel(models) {
    return PREFERRED.find((m) => models.includes(m)) ?? models[0];
  },

  async generate(input: GenerateInput) {
    const body: Record<string, unknown> = {
      model: input.model,
      instructions: input.instructions,
      input: input.input,
      max_output_tokens: input.maxOutputTokens,
      store: false,
    };
    if (input.jsonSchema) {
      body.text = { format: { type: "json_schema", name: input.jsonSchema.name, strict: true, schema: input.jsonSchema.schema } };
    }
    const res = await fetch(`${API}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) await mapError(res);
    const result = await res.json().catch(() => null);
    const text = extractText(result);
    if (!text) throw new LabError("INVALID_MODEL_RESPONSE", "OpenAI returned an empty response.", 502);
    const u = result?.usage ?? {};
    const usage: Usage = {
      input_tokens: Number.isFinite(u.input_tokens) ? u.input_tokens : null,
      output_tokens: Number.isFinite(u.output_tokens) ? u.output_tokens : null,
      total_tokens: Number.isFinite(u.total_tokens) ? u.total_tokens : null,
    };
    return { text, usage };
  },

  estimateCost() {
    return null; // No verified price table is maintained; cost is reported as unavailable.
  },
};
