/**
 * `?next=` return addresses after login / sign-up. Only same-site paths are accepted
 * ("/my-abstracts", "/abstracts/submit"), never "//evil.com" or "https://…".
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}

/** "/login?next=…" / "/create-account?next=…" */
export function withNext(path: string, next: string | null | undefined): string {
  const n = safeNext(next);
  return n ? `${path}?next=${encodeURIComponent(n)}` : path;
}

/** The abstract submission page (its own page, like conference registration). */
export const ABSTRACT_FORM_PATH = '/abstracts/submit';

/** "My ENDOCON": choose conference registration or abstract submission. Default after login / sign-up. */
export const DASHBOARD_PATH = '/dashboard';
