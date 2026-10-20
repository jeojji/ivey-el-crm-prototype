const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** Accepts "example.com" or "https://example.com". */
export function isValidWebsite(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return url.hostname.includes('.');
  } catch {
    return false;
  }
}

export function normalizeWebsite(value: string): string {
  return value.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

export type FieldErrors<T extends string> = Partial<Record<T, string>>;
