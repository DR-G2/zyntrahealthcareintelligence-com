import { LabError, type GenerateInput, type ProviderAdapter } from "./types.ts";

const API = "https://generativelanguage.googleapis.com/v1beta";
const PREFERRED = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"];

async function providerError(res: Response): Promise<never> {
  const payload = await res.json().catch(() => ({}));
  const msg = typeof payload?.error?.message === "string" ? payload.error.message.slice(0, 300) : undefined;
  if (res.status === 401 || res.status === 403) throw new LabError("INVALID_PROVIDER_KEY", "Gemini rejected this API key.", res.status, msg);
  if (res.status === 429) throw new LabError("PROVIDER_RATE_LIMIT", "Gemini rate limit or quota reached. Try again later.", 429, msg);
  if (res.status >= 400 && res.status < 500) throw new LabError("PROVIDER_ERROR", "Gemini rejected the request.", 400, msg);
  throw new LabError("PROVIDER_ERROR", "Gemini is unavailable right now.", 502, msg);
}

export const geminiAdapter: ProviderAdapter = {
  id: "gemini",
  async listModels(apiKey) {
    const res = await fetch(`${API}/models?key=${encodeURIComponent(apiKey)}&pageSize=100`);
    if (!res.ok) await providerError(res);
    const payload = await res.json().catch(() => ({}));
    return (Array.isArray(payload?.models) ? payload.models : [])
      .filter((m: any) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
      .map((m: any) => typeof m?.name === "string" ? m.name.replace(/^models\\//, "") : "")
      .filter((id: string) => /^gemini-/i.test(id) && !/(embedding|tts|audio|image|veo)/i.test(id))
      .sort();
  },
  preferredModel(models) { return PREFERRED.find((m) => models.includes(m)) ?? models[0]; },
  async generate(input: GenerateInput) {
    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: input.instructions }] },
      contents: [{ role: "user", parts: [{ text: input.input }] }],
      generationConfig: { maxOutputTokens: input.maxOutputTokens, ...(input.jsonSchema ? { responseMimeType: "application/json" } : {}) },
    };
    const res = await fetch(`${API}/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) await providerError(res);
    const result = await res.json().catch(() => null);
    const text = result?.candidates?.[0]?.content?.parts?.map((p: any) => typeof p?.text === "string" ? p.text : "").join("");
    if (typeof text !== "string" || !text.trim()) throw new LabError("INVALID_MODEL_RESPONSE", "Gemini returned an empty response.", 502);
    const u = result?.usageMetadata ?? {};
    return { text, usage: { input_tokens: Number.isFinite(u.promptTokenCount) ? u.promptTokenCount : null, output_tokens: Number.isFinite(u.candidatesTokenCount) ? u.candidatesTokenCount : null, total_tokens: Number.isFinite(u.totalTokenCount) ? u.totalTokenCount : null } };
  },
  estimateCost() { return null; },
};
