import { createOpenAICompatibleAdapter } from "./openai-compatible.ts";

export const openrouterAdapter = createOpenAICompatibleAdapter({
  id: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  modelsUrl: "https://openrouter.ai/api/v1/models",
  preferred: ["openai/gpt-oss-120b:free", "openai/gpt-oss-20b:free", "google/gemma-3-27b-it:free"],
  modelFilter: (m) => {
    const id = typeof m?.id === "string" ? m.id : "";
    const p = m?.pricing;
    return id.endsWith(":free") || (!!p && p.prompt === "0" && p.completion === "0");
  },
});
