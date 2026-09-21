const KEY = 'zyntra_post_auth_redirect';

/** Only same-origin relative paths are allowed as a post-login destination. */
export function sanitizeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export function rememberNextPath(value: string | null | undefined) {
  const safe = sanitizeNextPath(value);
  if (safe) sessionStorage.setItem(KEY, safe);
}

export function takeNextPath(): string | null {
  const stored = sanitizeNextPath(sessionStorage.getItem(KEY));
  return stored;
}

export function clearNextPath() {
  sessionStorage.removeItem(KEY);
}
