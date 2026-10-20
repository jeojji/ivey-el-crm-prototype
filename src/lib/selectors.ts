import type { Activity, ActivityType, Contact, Task } from '../types';
import { todayDateString } from './dates';

export function fullName(contact: Pick<Contact, 'firstName' | 'lastName'>): string {
  return `${contact.firstName} ${contact.lastName}`.trim();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function isFuture(activity: Activity, now = Date.now()): boolean {
  return new Date(activity.occurredAt).getTime() > now;
}

export function byOccurredDesc(a: Activity, b: Activity): number {
  return b.occurredAt.localeCompare(a.occurredAt);
}

export function byOccurredAsc(a: Activity, b: Activity): number {
  return a.occurredAt.localeCompare(b.occurredAt);
}

/** Most recent past activity timestamp in the list, or null. */
export function lastActivityAt(activities: Activity[]): string | null {
  const now = Date.now();
  let latest: string | null = null;
  for (const a of activities) {
    if (new Date(a.occurredAt).getTime() > now) continue;
    if (!latest || a.occurredAt > latest) latest = a.occurredAt;
  }
  return latest;
}

export function isOverdue(task: Task, today = todayDateString()): boolean {
  return task.status === 'open' && task.dueDate < today;
}

export function byDueAsc(a: Task, b: Task): number {
  return a.dueDate.localeCompare(b.dueDate);
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  email: 'Email',
  call: 'Call',
  meeting: 'Meeting',
  note: 'Note',
};

/** Case-insensitive "does any field contain the query" check. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}

/**
 * Most recent past email, call or meeting (notes aren't communication). Kept separate from a
 * record's "Last project participated" date, which describes EL project involvement.
 */
export function lastCommunicationAt(activities: Activity[]): string | null {
  return lastActivityAt(activities.filter((a) => a.type !== 'note'));
}
