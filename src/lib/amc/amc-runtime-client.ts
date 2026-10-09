import { getSupabaseV2 } from "@/integrations/supabase/v2-client";
import { ensureV2Session } from "@/lib/migration/v2-practice-session";

export type AMCExamMode = "MCQ" | "CLINICAL";

export interface AMCPluginSummary {
  plugin: "AMC";
  pluginVersion: string;
  status: string;
  environmentCode: string | null;
  environmentVersion: string | null;
  environmentStatus: string | null;
  examMode: AMCExamMode;
  readiness: {
    probability: null;
    index: null;
    uncertainty: null;
    status: string;
    probabilityStatus: "NOT_CALIBRATED";
  };
}

export interface AMCBlueprintRow {
  exam_mode: AMCExamMode;
  patient_group: string;
  task_domain: string | null;
  proportion: number | null;
  item_target: number | null;
}

export interface AMCBlueprintResponse {
  plugin: "AMC";
  pluginVersion: string;
  examMode: AMCExamMode;
  blueprint: AMCBlueprintRow[];
}

export interface AMCPracticeStatus {
  plugin: "AMC";
  pluginVersion: string;
  examMode: AMCExamMode;
  mappedQuestionCount: number;
  approvedQuestionCount: number;
  mappingStatus: "MAPPING_REQUIRED" | "REVIEWED_METADATA_PRESENT";
  eligibleLearningObjectiveCount: number;
  selectorStatus: "NOT_CERTIFIED" | "MAPPING_REQUIRED" | "READY";
  canStartAMCPractice: boolean;
  reason: string;
}

export interface AMCReadinessResponse {
  plugin: "AMC";
  pluginVersion: string;
  examMode: AMCExamMode;
  environmentCode: string | null;
  readiness: {
    probability: null;
    status: "INSUFFICIENT_EVIDENCE";
  };
  dimensionCount: number;
  probabilityStatus: "NOT_CALIBRATED";
  modelVersion: string;
}

let sessionPromise: Promise<void> | null = null;

function ensureAMCV2Session(): Promise<void> {
  if (!sessionPromise) {
    sessionPromise = ensureV2Session().finally(() => { sessionPromise = null; });
  }
  return sessionPromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validMode(value: unknown): value is AMCExamMode {
  return value === "MCQ" || value === "CLINICAL";
}

export function parseAMCPluginSummary(value: unknown): AMCPluginSummary {
  if (!isRecord(value) || value.plugin !== "AMC" || typeof value.pluginVersion !== "string" ||
      !validMode(value.examMode) || !isRecord(value.readiness)) {
    throw new Error("AMC plugin returned an invalid summary contract.");
  }
  const readiness = value.readiness;
  if (readiness.probability !== null || readiness.probabilityStatus !== "NOT_CALIBRATED") {
    throw new Error("AMC plugin returned an unsafe readiness probability contract.");
  }
  return {
    plugin: "AMC",
    pluginVersion: value.pluginVersion,
    status: typeof value.status === "string" ? value.status : "unknown",
    environmentCode: typeof value.environmentCode === "string" ? value.environmentCode : null,
    environmentVersion: typeof value.environmentVersion === "string" ? value.environmentVersion : null,
    environmentStatus: typeof value.environmentStatus === "string" ? value.environmentStatus : null,
    examMode: value.examMode,
    readiness: {
      probability: null,
      index: null,
      uncertainty: null,
      status: typeof readiness.status === "string" ? readiness.status : "INSUFFICIENT_EVIDENCE",
      probabilityStatus: "NOT_CALIBRATED",
    },
  };
}

export function parseAMCBlueprintResponse(value: unknown): AMCBlueprintResponse {
  if (!isRecord(value) || value.plugin !== "AMC" || typeof value.pluginVersion !== "string" ||
      !validMode(value.examMode) || !Array.isArray(value.blueprint)) {
    throw new Error("AMC plugin returned an invalid blueprint contract.");
  }
  const blueprint = value.blueprint.map((row) => {
    if (!isRecord(row) || !validMode(row.exam_mode) || typeof row.patient_group !== "string") {
      throw new Error("AMC plugin returned an invalid blueprint row.");
    }
    const proportion = row.proportion;
    const itemTarget = row.item_target;
    if (proportion !== null && proportion !== undefined &&
        (typeof proportion !== "number" || !Number.isFinite(proportion) || proportion < 0 || proportion > 1)) {
      throw new Error("AMC plugin returned an invalid blueprint proportion.");
    }
    if (itemTarget !== null && itemTarget !== undefined &&
        (!Number.isInteger(itemTarget) || (itemTarget as number) < 1)) {
      throw new Error("AMC plugin returned an invalid blueprint item target.");
    }
    return {
      exam_mode: row.exam_mode,
      patient_group: row.patient_group,
      task_domain: typeof row.task_domain === "string" ? row.task_domain : null,
      proportion: typeof proportion === "number" ? proportion : null,
      item_target: typeof itemTarget === "number" ? itemTarget : null,
    };
  });
  return { plugin: "AMC", pluginVersion: value.pluginVersion, examMode: value.examMode, blueprint };
}

export function parseAMCPracticeStatus(value: unknown): AMCPracticeStatus {
  if (!isRecord(value) || value.plugin !== "AMC" || typeof value.pluginVersion !== "string" ||
      !validMode(value.examMode) ||
      (value.selectorStatus !== "NOT_CERTIFIED" && value.selectorStatus !== "MAPPING_REQUIRED" && value.selectorStatus !== "READY") ||
      typeof value.canStartAMCPractice !== "boolean" ||
      value.canStartAMCPractice !== (value.selectorStatus === "READY")) {
    throw new Error("AMC plugin returned an invalid practice-status contract.");
  }
  const count = (candidate: unknown) =>
    Number.isInteger(candidate) && (candidate as number) >= 0 ? candidate as number : 0;
  const mappedQuestionCount = count(value.mappedQuestionCount);
  const approvedQuestionCount = count(value.approvedQuestionCount);
  const eligibleLearningObjectiveCount = count(value.eligibleLearningObjectiveCount);
  const mappingStatus = value.mappingStatus === "REVIEWED_METADATA_PRESENT" ? "REVIEWED_METADATA_PRESENT" : "MAPPING_REQUIRED";
  if (value.selectorStatus === "READY" &&
      (mappedQuestionCount < 1 || approvedQuestionCount < 1 || eligibleLearningObjectiveCount < 1 ||
       mappingStatus !== "REVIEWED_METADATA_PRESENT")) {
    throw new Error("AMC plugin claimed readiness without complete question and blueprint mappings.");
  }
  return {
    plugin: "AMC",
    pluginVersion: value.pluginVersion,
    examMode: value.examMode,
    mappedQuestionCount,
    approvedQuestionCount,
    mappingStatus,
    eligibleLearningObjectiveCount,
    selectorStatus: value.selectorStatus,
    canStartAMCPractice: value.canStartAMCPractice,
    reason: typeof value.reason === "string" ? value.reason : "AMC question selection is not certified.",
  };
}

export function parseAMCReadinessResponse(value: unknown): AMCReadinessResponse {
  if (!isRecord(value) || value.plugin !== "AMC" || typeof value.pluginVersion !== "string" ||
      !validMode(value.examMode) || !isRecord(value.readiness) ||
      value.readiness.probability !== null ||
      value.readiness.status !== "INSUFFICIENT_EVIDENCE" ||
      value.probabilityStatus !== "NOT_CALIBRATED") {
    throw new Error("AMC plugin returned an invalid readiness contract.");
  }
  return {
    plugin: "AMC",
    pluginVersion: value.pluginVersion,
    examMode: value.examMode,
    environmentCode: typeof value.environmentCode === "string" ? value.environmentCode : null,
    readiness: { probability: null, status: "INSUFFICIENT_EVIDENCE" },
    dimensionCount: Number.isInteger(value.dimensionCount) && (value.dimensionCount as number) >= 0
      ? value.dimensionCount as number : 0,
    probabilityStatus: "NOT_CALIBRATED",
    modelVersion: typeof value.modelVersion === "string" ? value.modelVersion : "amc-readiness-v1.0",
  };
}

async function invokeAMC<T>(body: Record<string, unknown>, parse: (value: unknown) => T): Promise<T> {
  await ensureAMCV2Session();
  const { data, error } = await getSupabaseV2().functions.invoke("amc-intelligence", { body });
  if (error) throw new Error(error.message || "AMC plugin request failed.");
  return parse(data);
}

export function getAMCPluginSummary(examMode: AMCExamMode): Promise<AMCPluginSummary> {
  return invokeAMC({ action: "get_summary", exam_mode: examMode }, parseAMCPluginSummary);
}

export function getAMCBlueprint(examMode: AMCExamMode): Promise<AMCBlueprintResponse> {
  return invokeAMC({ action: "get_blueprint", exam_mode: examMode }, parseAMCBlueprintResponse);
}

export function getAMCPracticeStatus(examMode: AMCExamMode): Promise<AMCPracticeStatus> {
  return invokeAMC({ action: "get_practice_status", exam_mode: examMode }, parseAMCPracticeStatus);
}

export function getAMCReadiness(examMode: AMCExamMode): Promise<AMCReadinessResponse> {
  return invokeAMC({ action: "get_readiness", exam_mode: examMode }, parseAMCReadinessResponse);
}
