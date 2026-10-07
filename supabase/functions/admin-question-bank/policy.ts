// Pure policy helpers (vitest + deno check).
import { hasAdminRole, isExactAdminRow, normaliseEmail, type AdminRow } from "../_shared/admin-gate.ts";
export { isExactAdminRow, normaliseEmail };

/**
 * admin-question-bank returns every question WITH keys and explanations, so it is super_admin
 * only. Nothing in the app needs broader access: its only caller is the /questions bank browser
 * (src/pages/Questions.tsx, also /questions/mcq), whose UI gate is SUPER_ADMIN_EMAIL. Plain
 * "admin" rows get 403. (Day-to-day question editing for admins stays in admin-manage-questions.)
 */
export const QUESTION_BANK_ROLES = ["super_admin"] as const;
export function canReadQuestionBank(row: AdminRow | null | undefined, callerEmail: string | null): boolean {
  return hasAdminRole(row, callerEmail, QUESTION_BANK_ROLES);
}

export function clampPage(offset: unknown, limit: unknown): { from: number; to: number } {
  const o = Math.max(0, Math.floor(Number(offset) || 0));
  const l = Math.max(1, Math.min(1000, Math.floor(Number(limit) || 1000)));
  return { from: o, to: o + l - 1 };
}
