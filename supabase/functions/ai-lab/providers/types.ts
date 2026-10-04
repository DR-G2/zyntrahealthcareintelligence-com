export type ErrorCode =
  | "AUTH_REQUIRED" | "ENCRYPTION_SECRET_MISSING" | "INVALID_PROVIDER_KEY" | "PROVIDER_ACCESS_DENIED"
  | "NO_SUPPORTED_MODEL" | "PROVIDER_RATE_LIMIT" | "PROVIDER_ERROR" | "DATABASE_ERROR"
  | "INVALID_MODEL_RESPONSE" | "CONFIGURATION_ERROR" | "INVALID_REQUEST";

export class LabError extends Error {
  constructor(public code: ErrorCode, message: string, public status = 400, public details?: string) {
    super(message);
  }
}

export interface Usage { input_tokens: number | null; output_tokens: number | null; total_tokens: number | null }

export interface GenerateInput {
  apiKey: string;
  model: string;
  instructions: string;
  input: string;
  maxOutputTokens: number;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

export interface ProviderAdapter {
  id: string;
  /** Verifies the credential and returns the supported text models it can use. */
  listModels(apiKey: string): Promise<string[]>;
  preferredModel(models: string[]): string;
  generate(input: GenerateInput): Promise<{ text: string; usage: Usage }>;
  /** Returns null when no trusted price table exists. Never guesses. */
  estimateCost(model: string, usage: Usage): number | null;
}
