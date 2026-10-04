import { createOpenAICompatibleAdapter } from "./openai-compatible.ts";

const TEXT = /^(openai\\/|qwen\\/|llama|meta-llama\\/|moonshotai\\/|minimaxai\\/)/i;
const EXCLUDE = /(whisper|audio|tts|transcribe|guard|compound)/i;

export const groqAdapter = createOpenAICompatibleAdapter({
  id: "groq",
  baseUrl: "https://api.groq.com/openai/v1",
  modelsUrl: "https://api.groq.com/openai/v1/models",
  preferred: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
  modelFilter: (m) => TEXT.test(m.id ?? "") && !EXCLUDE.test(m.id ?? ""),
});
