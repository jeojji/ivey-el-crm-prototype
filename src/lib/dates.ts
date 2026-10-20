const DAY_MS = 86_400_000;

/** Local calendar date as YYYY-MM-DD. */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayDateString(): string {
  return toDateString(new Date());
}

export function parseDateString(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Whole days from today to a YYYY-MM-DD date (negative = in the past). */
export function daysFromToday(dateString: string): number {
  const today = parseDateString(todayDateString());
  return Math.round((parseDateString(dateString).getTime() - today.getTime()) / DAY_MS);
}

export function relativeDay(dateString: string): string {
  const diff = daysFromToday(dateString);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return diff > 0 ? `In ${diff} days` : `${Math.abs(diff)} days ago`;
}

export function relativeFromIso(iso: string): string {
  return relativeDay(toDateString(new Date(iso)));
}

export function formatDate(value: string): string {
  const date = value.length === 10 ? parseDateString(value) : new Date(value);
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatLongToday(): string {
  return new Date().toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** ISO timestamp -> value for <input type="datetime-local">. */
export function toDateTimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${toDateString(d)}T${hh}:${mm}`;
}

/** <input type="datetime-local"> value (local time) -> ISO timestamp, or null if invalid. */
export function fromDateTimeLocalValue(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
