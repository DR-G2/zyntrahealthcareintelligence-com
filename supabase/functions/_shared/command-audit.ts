// Two-phase admin audit into command.admin_activity_logs (V2/hkow). Service-role client only.
// Usage: const a = await auditBegin(...); if ("error" in a) return 500; <action>; await auditFinish(...).
// Structural client type so callers using npm: or esm.sh supabase-js both type-check.
// deno-lint-ignore no-explicit-any
type SupabaseClient = { schema: (s: string) => any };
import { errCode, hmacTarget, stripPii, type AuditStatus } from "./audit-pure.ts";
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

/** Inserts status='pending' BEFORE the action. Any error => { error } and the caller must not act. */
export async function auditBegin(sb: SupabaseClient, input: AuditBeginInput): Promise<{ id: string } | { error: string }> {
  try {
    const t = await auditTargetId(input.target);
    if ("error" in t) {
      console.error("[audit] begin failed stage=hmac_secret code=missing");
      return { error: t.error };
    }
    const { data, error } = await sb.schema("command").from("admin_activity_logs").insert({
      actor_user_id: input.actorUserId,
      actor_role: input.actorRole,
      action: input.action,
      target_type: input.targetType,
      target_id: t.id,
      reason: input.reason ?? null,
      before_snapshot: input.before === undefined ? null : stripPii(input.before),
      status: "pending",
    }).select("id").single();
    if (error || !data?.id) {
      console.error("[audit] begin failed stage=insert code=", errCode(error));
      return { error: "audit_insert_failed" };
    }
    return { id: data.id as string };
  } catch (e) {
    console.error("[audit] begin failed stage=exception code=", errCode(e));
    return { error: "audit_exception" };
  }
}

/** Marks the pending row done/failed. Never throws; returns false (and logs stage+code) on error. */
export async function auditFinish(sb: SupabaseClient, id: string, status: Exclude<AuditStatus, "pending">, after?: unknown): Promise<boolean> {
  try {
    const { error } = await sb.schema("command").from("admin_activity_logs")
      .update({ status, after_snapshot: after === undefined ? null : stripPii(after) })
      .eq("id", id);
    if (error) {
      console.error("[audit] finish failed stage=update code=", errCode(error));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[audit] finish failed stage=exception code=", errCode(e));
    return false;
  }
}

/**
 * Destructive-action guard: the target must not be (or have been) an admin.
 * 'admin' if in pie.security_admin_allowlist, command.admin_roles, or an actor in command.admin_activity_logs.
 * Any lookup error => 'error' (callers fail closed).
 */
export async function adminTargetStatus(sb: SupabaseClient, userId: string): Promise<"clear" | "admin" | "error"> {
  try {
    const [allow, roles, acted] = await Promise.all([
      sb.schema("pie").from("security_admin_allowlist").select("user_id").eq("user_id", userId).limit(1),
      sb.schema("command").from("admin_roles").select("user_id").eq("user_id", userId).limit(1),
      sb.schema("command").from("admin_activity_logs").select("id").eq("actor_user_id", userId).limit(1),
    ]);
    for (const [stage, r] of [["allowlist", allow], ["admin_roles", roles], ["activity", acted]] as const) {
      if (r.error) {
        console.error("[audit] admin-guard check failed stage=", stage, "code=", errCode(r.error));
        return "error";
      }
    }
    return [allow, roles, acted].some((r) => (r.data ?? []).length > 0) ? "admin" : "clear";
  } catch (e) {
    console.error("[audit] admin-guard check failed stage=exception code=", errCode(e));
    return "error";
  }
}

/** Single-shot record for non-destructive actions already performed (status done/failed). Never throws. */
export async function auditRecord(sb: SupabaseClient, input: AuditBeginInput & { after?: unknown; status?: "done" | "failed" }): Promise<boolean> {
  const b = await auditBegin(sb, input);
  if ("error" in b) return false;
  return auditFinish(sb, b.id, input.status ?? "done", input.after);
}
