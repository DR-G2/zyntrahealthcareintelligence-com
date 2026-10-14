/** B1: admin-bulk-delete-users returns 410 { error: 'disabled_until_p5' } until P5 (full erasure). */
export const BULK_DELETE_DISABLED = true;
export const BULK_DELETE_DISABLED_MESSAGE = 'Bulk delete disabled until P5';

/** Maps any bulk-delete failure to a safe message (never the raw server/error text). */
export function bulkDeleteErrorMessage(error: unknown, data?: unknown): string {
  const status = (error as { context?: { status?: number }; status?: number } | null)?.context?.status
    ?? (error as { status?: number } | null)?.status;
  const code = (data as { error?: unknown } | null)?.error;
  if (status === 410 || code === 'disabled_until_p5') return BULK_DELETE_DISABLED_MESSAGE;
  return 'Bulk delete failed. Please try again later.';
}
