import { LabError, type GenerateInput, type ProviderAdapter, type Usage } from "./types.ts";

type Config = {
  id: string;
  baseUrl: string;
  modelsUrl: string;
  preferred: string[];
  modelFilter: (m: any) => boolean;
};

function usageOf(u: any): Usage {
  return {
    input_tokens: Number.isFinite(u?.prompt_tokens) ? u.prompt_tokens : Number.isFinite(u?.input_tokens) ? u.input_tokens : null,
    output_tokens: Number.isFinite(u?.completion_tokens) ? u.completion_tokens : Number.isFinite(u?.output_tokens) ? u.output_tokens : null,
    total_tokens: Number.isFinite(u?.total_tokens) ? u.total_tokens : null,
  };
}

async function providerError(res: Response, provider: string): Promise<never> {
  const payload = await res.json().catch(() => ({}));
  const msg = typeof payload?.error?.message === "string" ? payload.error.message.slice(0, 300) : undefined;
  if (res.status === 401) throw new LabError("INVALID_PROVIDER_KEY", `${provider} rejected this API key.`, 401, msg);
  if (res.status === 403) throw new LabError("PROVIDER_ACCESS_DENIED", `${provider} denied access to this resource.`, 403, msg);
  if (res.status === 429) throw new LabError("PROVIDER_RATE_LIMIT", `${provider} rate limit or quota reached. Try again later.`, 429, msg);
  if (res.status >= 400 && res.status < 500) throw new LabError("PROVIDER_ERROR", `${provider} rejected the request.`, 400, msg);
  throw new LabError("PROVIDER_ERROR", `${provider} is unavailable right now.`, 502, msg);
}

export function createOpenAICompatibleAdapter(config: Config): ProviderAdapter {
  return {
    id: config.id,
    async listModels(apiKey) {
      const res = await fetch(config.modelsUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!res.ok) await providerError(res, config.id);
      const payload = await res.json().catch(() => ({}));
      const ids = Array.isArray(payload?.data) ? payload.data.map((m: any) => typeof m?.id === "string" ? m.id : "").filter(Boolean) : [];
      return ids.filter(config.modelFilter).sort();
    },
    preferredModel(models) { return config.preferred.find((m) => models.includes(m)) ?? models[0]; },
    async generate(input: GenerateInput) {
      const body: Record<string, unknown> = {
        model: input.model,
        messages: [{ role: "system", content: input.instructions }, { role: "user", content: input.input }],
        max_tokens: input.maxOutputTokens,
      };
      if (input.jsonSchema) body.response_format = { type: "json_object" };
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) await providerError(res, config.id);
      const result = await res.json().catch(() => null);
      const text = result?.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim()) throw new LabError("INVALID_MODEL_RESPONSE", `${config.id} returned an empty response.`, 502);
      return { text, usage: usageOf(result?.usage) };
    },
    estimateCost() { return null; },
  };
}
