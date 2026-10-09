import { getSupabaseV2 } from "@/integrations/supabase/v2-client";
import { ensureV2Session } from "@/lib/migration/v2-practice-session";

export type AMCPluginStatus = "draft" | "shadow" | "active" | "retired" | string;

export interface AMCPluginSummary {
  plugin: "AMC";
  pluginVersion: string;
  status: AMCPluginStatus;
  environmentCode: string | null;
  environmentVersion: string | null;
  environment: Record<string, unknown> | null;
  readiness: null;
  nextAction: null;
}

export interface AMCBlueprintResponse {
  plugin: "AMC";
  pluginVersion: string;
  examMode: "MCQ" | "CLINICAL";
  blueprint: Record<string, unknown> | null;
  blueprintVersion: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseAMCPluginSummary(value: unknown): AMCPluginSummary {
  if (!isRecord(value) || value.plugin !== "AMC" || typeof value.pluginVersion !== "string") {
    throw new Error("AMC plugin returned an invalid summary contract.");
  }
  if (value.environment !== null && value.environment !== undefined && !isRecord(value.environment)) {
    throw new Error("AMC plugin returned an invalid exam environment.");
  }
  return {
    plugin: "AMC",
    pluginVersion: value.pluginVersion,
    status: typeof value.status === "string" ? value.status : "unknown",
    environmentCode: typeof value.environmentCode === "string" ? value.environmentCode : null,
    environmentVersion: typeof value.environmentVersion === "string" ? value.environmentVersion : null,
    environment: isRecord(value.environment) ? value.environment : null,
    readiness: null,
    nextAction: null,
  };
}

export function parseAMCBlueprintResponse(value: unknown): AMCBlueprintResponse {
  if (!isRecord(value) || value.plugin !== "AMC" || typeof value.pluginVersion !== "string") {
    throw new Error("AMC plugin returned an invalid blueprint contract.");
  }
  if (value.examMode !== "MCQ" && value.examMode !== "CLINICAL") {
    throw new Error("AMC plugin returned an invalid exam mode.");
  }
  if (value.blueprint !== null && value.blueprint !== undefined && !isRecord(value.blueprint)) {
    throw new Error("AMC plugin returned an invalid blueprint.");
  }
  return {
    plugin: "AMC",
    pluginVersion: value.pluginVersion,
    examMode: value.examMode,
    blueprint: isRecord(value.blueprint) ? value.blueprint : null,
    blueprintVersion: typeof value.blueprintVersion === "string" ? value.blueprintVersion : null,
  };
}

async function invokeAMC<T>(body: Record<string, unknown>, parse: (value: unknown) => T): Promise<T> {
  await ensureV2Session();
  const { data, error } = await getSupabaseV2().functions.invoke("amc-intelligence-v2", { body });
  if (error) throw new Error(error.message || "AMC plugin request failed.");
  return parse(data);
}

/** Read the V2 AMC plugin contract; this deliberately does not claim readiness. */
export function getAMCPluginSummary(): Promise<AMCPluginSummary> {
  return invokeAMC({ action: "get_summary" }, parseAMCPluginSummary);
}

/** Read the versioned AMC blueprint for the requested exam mode. */
export function getAMCBlueprint(examMode: "MCQ" | "CLINICAL"): Promise<AMCBlueprintResponse> {
  return invokeAMC({ action: "get_blueprint", exam_mode: examMode }, parseAMCBlueprintResponse);
}
