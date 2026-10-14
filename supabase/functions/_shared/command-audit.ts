// Two-phase admin audit into command.admin_activity_logs (V2/hkow) via public SECURITY INVOKER RPCs
// (0087; the command schema is NOT exposed). Service-role client only.
// Usage: const a = await auditBegin(...); if ("error" in a) return 500; <action>; await auditFinish(...).
// Structural client type so callers using npm: or esm.sh supabase-js both type-check.
// deno-lint-ignore no-explicit-any
type SupabaseClient = { rpc: (fn: string, args?: Record<string, unknown>) => any };
import { errCode, hmacTarget, redactReason, stripPii, type AuditStatus } from "./audit-pure.ts";
export { hmacTarget, stripPii } from "./audit-pure.ts";

export interface AuditBeginInput {
  actorUserId: string;
  actorRole: string;
  action: string;
  targetType: string;
  /** Raw uuid or email: only its HMAC is stored. */
  target: string | null;
  before?: unknown;
  reason?: string | null;
}

/** HMAC of the target with AUDIT_HMAC_KEY; null when the key is missing (callers must fail closed). */
export async function auditTargetId(target: string | null): Promise<{ id: string | null } | { error: string }> {
  const key = Deno.env.get("AUDIT_HMAC_KEY");
  if (!key) return { error: "audit_key_missing" };
  if (!target) return { id: null };
  return { id: await hmacTarget(key, target) };
}

/** Inserts status='pending' BEFORE the action (RPC command_audit_begin). Any error => { error }; caller must not act. */
export async function auditBegin(sb: SupabaseClient, input: AuditBeginInput): Promise<{ id: string } | { error: string }> {
  try {
    const t = await auditTargetId(input.target);
    if ("error" in t) {
      console.error("[audit] begin failed stage=hmac_secret code=missing");
      return { error: t.error };
    }
    const { data, error } = await sb.rpc("command_audit_begin", {
      p_actor_user_id: input.actorUserId,
      p_actor_role: input.actorRole,
      p_action: input.action,
      p_target_type: input.targetType,
      p_target_id: t.id,
      p_reason: redactReason(input.reason),
      p_before: input.before === undefined ? null : stripPii(input.before),
    });
    if (error || typeof data !== "string") {
      console.error("[audit] begin failed stage=rpc code=", errCode(error));
      return { error: "audit_insert_failed" };
    }
    return { id: data };
  } catch (e) {
    console.error("[audit] begin failed stage=exception code=", errCode(e));
    return { error: "audit_exception" };
  }
}

/** Marks the pending row done/failed (RPC command_audit_finish). Never throws; false (logged stage+code) on error. */
export async function auditFinish(sb: SupabaseClient, id: string, status: Exclude<AuditStatus, "pending">, after?: unknown): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("command_audit_finish", {
      p_id: id, p_status: status, p_after: after === undefined ? null : stripPii(after),
    });
    if (error || data !== true) {
      console.error("[audit] finish failed stage=rpc code=", errCode(error ?? { code: "not_pending" }));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[audit] finish failed stage=exception code=", errCode(e));
    return false;
  }
}

/**
 * Destructive-action guard (RPC command_admin_target_status): 'admin' if the target is in
 * pie.security_admin_allowlist, command.admin_roles, or an actor in command.admin_activity_logs.
 * Any error / unexpected value => 'error' (callers fail closed).
 */
export async function adminTargetStatus(sb: SupabaseClient, userId: string): Promise<"clear" | "admin" | "error"> {
  try {
    const { data, error } = await sb.rpc("command_admin_target_status", { p_user_id: userId });
    if (error) {
      console.error("[audit] admin-guard check failed stage=rpc code=", errCode(error));
      return "error";
    }
    return data === "clear" || data === "admin" ? data : "error";
  } catch (e) {
    console.error("[audit] admin-guard check failed stage=exception code=", errCode(e));
    return "error";
  }
}

/** Read path for get_logs (RPC command_audit_list). */
export async function auditList(sb: SupabaseClient, limit = 500): Promise<{ data: unknown[] } | { error: string }> {
  const { data, error } = await sb.rpc("command_audit_list", { p_limit: limit });
  if (error) {
    console.error("[audit] list failed stage=rpc code=", errCode(error));
    return { error: "audit_list_failed" };
  }
  return { data: (data ?? []) as unknown[] };
}

/** Single-shot record for non-destructive actions already performed (begin + finish). Never throws. */
export async function auditRecord(sb: SupabaseClient, input: AuditBeginInput & { after?: unknown; status?: "done" | "failed" }): Promise<boolean> {
  const b = await auditBegin(sb, input);
  if ("error" in b) return false;
  return auditFinish(sb, b.id, input.status ?? "done", input.after);
}
