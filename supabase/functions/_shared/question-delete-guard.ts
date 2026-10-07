// Guard for admin question deletion (admin-manage-questions, admin-cleanup-questions).
//
// public.user_attempts.question_id REFERENCES questions(id) ON DELETE CASCADE, so deleting a
// question silently deletes every learner attempt on it. By default these functions now REFUSE:
// a question with any user_attempts row is retained (reported back), and user_attempts is never
// deleted. Deleting attempts requires the explicit request flag
//   { "confirm_delete_user_attempts": "DELETE_LEARNER_ATTEMPTS" }.
// The attempt lookup is paginated and fails closed: on any error nothing is deleted.

export const CONFIRM_DELETE_USER_ATTEMPTS = "DELETE_LEARNER_ATTEMPTS";
const BATCH = 100;
const PAGE = 1000;
const SIDE_TABLES = ["bookmarks", "user_notes", "question_difficulty_tiers", "question_dna"] as const;

export function attemptDeletionConfirmed(body: unknown): boolean {
  return Boolean(body && typeof body === "object" &&
    (body as Record<string, unknown>).confirm_delete_user_attempts === CONFIRM_DELETE_USER_ATTEMPTS);
}

export function partitionForDelete(ids: readonly string[], withAttempts: ReadonlySet<string>, allowAttemptDeletion: boolean) {
  if (allowAttemptDeletion) return { deletable: [...ids], retained: [] as string[] };
  return { deletable: ids.filter((id) => !withAttempts.has(id)), retained: ids.filter((id) => withAttempts.has(id)) };
}

// deno-lint-ignore no-explicit-any
type Db = { from: (table: string) => any };

/** Distinct question ids (within `ids`) that have at least one user_attempts row. Throws on error. */
export async function questionIdsWithAttempts(db: Db, ids: readonly string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from("user_attempts").select("id, question_id").in("question_id", batch)
        .order("id").range(from, from + PAGE - 1);
      if (error) throw new Error(`attempt lookup failed, nothing deleted: ${error.message ?? error}`);
      for (const r of data ?? []) found.add(String(r.question_id));
      if (!data || data.length < PAGE) break;
    }
  }
  return found;
}

export interface GuardedDeleteResult { deleted: string[]; retained_with_attempts: string[]; attempts_deleted: boolean }

export async function deleteQuestionsGuarded(db: Db, ids: readonly string[], allowAttemptDeletion: boolean): Promise<GuardedDeleteResult> {
  const unique = [...new Set(ids)];
  const withAttempts = allowAttemptDeletion ? new Set<string>() : await questionIdsWithAttempts(db, unique);
  const { deletable, retained } = partitionForDelete(unique, withAttempts, allowAttemptDeletion);
  for (let i = 0; i < deletable.length; i += BATCH) {
    const batch = deletable.slice(i, i + BATCH);
    for (const t of SIDE_TABLES) await db.from(t).delete().in("question_id", batch);
    if (allowAttemptDeletion) {
      const { error } = await db.from("user_attempts").delete().in("question_id", batch);
      if (error) throw new Error(`user_attempts delete failed: ${error.message ?? error}`);
    }
    const { error } = await db.from("questions").delete().in("id", batch);
    if (error) throw new Error(`question delete failed: ${error.message ?? error}`);
  }
  return { deleted: deletable, retained_with_attempts: retained, attempts_deleted: allowAttemptDeletion && deletable.length > 0 };
}
