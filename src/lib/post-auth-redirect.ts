const KEY = 'zyntra_post_auth_redirect';

/** Only same-origin relative paths are allowed as a post-login destination. */
export function sanitizeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  // Same-origin relative paths only: reject protocol-relative ('//'), any backslash ('/\\evil' is
  // treated as '//evil' by browsers), and control characters/whitespace that URL parsers strip.
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || /[\u0000-\u001f\u007f\s]/.test(value)) return null;
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
