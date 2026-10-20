import type { Application } from '../types';
import {
  APPLICATION_STAGES,
  AWAITING_REVIEW_STAGES,
  CLOSED_STAGES,
  TERM_SEASONS,
  UNCONFIRMED_STAGES,
  type ApplicationStage,
} from './options';
import { daysFromToday } from './dates';

export const DEADLINE_SOON_DAYS = 14;

export function termLabel(a: Pick<Application, 'termSeason' | 'termYear'>): string {
  return [a.termSeason, a.termYear ?? ''].filter(Boolean).join(' ');
}

/** Calendar order: Winter (Jan) → Summer (May) → Fall (Sep). Applications without a term sort last. */
export function termSortKey(a: Pick<Application, 'termSeason' | 'termYear'>): number {
  if (!a.termYear) return Number.MAX_SAFE_INTEGER;
  const order = { Winter: 0, Summer: 1, Fall: 2 } as Record<string, number>;
  return a.termYear * 10 + (order[a.termSeason] ?? 3);
}

export const isStage = (s: string): s is ApplicationStage => (APPLICATION_STAGES as readonly string[]).includes(s);
export const isAwaitingReview = (a: Application) => (AWAITING_REVIEW_STAGES as readonly string[]).includes(a.stage);
export const isClosed = (a: Application) => (CLOSED_STAGES as readonly string[]).includes(a.stage);
export const isUnconfirmed = (a: Application) => (UNCONFIRMED_STAGES as readonly string[]).includes(a.stage);

export type DeadlineState = 'none' | 'confirmed' | 'passed' | 'soon' | 'later';

/** The participation confirmation deadline only matters until the partner has confirmed. */
export function deadlineState(a: Application): DeadlineState {
  if (!a.confirmationDeadline) return 'none';
  if (!isUnconfirmed(a)) return 'confirmed';
  const days = daysFromToday(a.confirmationDeadline);
  if (days < 0) return 'passed';
  return days <= DEADLINE_SOON_DAYS ? 'soon' : 'later';
}

export function stageIndex(stage: string): number {
  return APPLICATION_STAGES.indexOf(stage as ApplicationStage);
}

export function termOptions(now = new Date()): number[] {
  const y = now.getFullYear();
  return Array.from({ length: 6 }, (_, i) => y - 1 + i);
}

export { TERM_SEASONS };
