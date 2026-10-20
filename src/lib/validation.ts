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

/** Loose phone check: digits plus common separators, optional "ext". */
export function isValidPhone(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return /^[+()\d\s.-]+(\s*(x|ext\.?)\s*\d+)?$/i.test(v) && v.replace(/\D/g, '').length >= 7;
}

export function isValidUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  try {
    const url = new URL(v);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
  } catch {
    return false;
  }
}

export function isValidIsoDate(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime());
}
