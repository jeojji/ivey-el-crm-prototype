import type { Company, Contact } from '../types';
import {
  ALUMNI_OPTIONS,
  CONTACT_PRIORITIES,
  CONTACT_ROLES,
  INDUSTRIES,
  PARTNER_STATUSES,
  PREFERRED_CONTACT_METHODS,
  PRIORITIES,
  PROJECT_TYPES,
  SOURCES,
  isKnown,
} from './options';

/** Values that aren't one of Lauren's options. They're preserved but need a human decision. */
export interface ReviewIssue {
  field: string;
  value: string;
}

function check(issues: ReviewIssue[], field: string, options: readonly string[], values: string | string[]) {
  for (const v of Array.isArray(values) ? values : [values]) {
    if (!isKnown(options, v)) issues.push({ field, value: v });
  }
}

export function companyReviewIssues(c: Company): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  check(issues, 'Partner status', PARTNER_STATUSES, c.statuses);
  check(issues, 'Industry', INDUSTRIES, c.industry);
  check(issues, 'Partnership priority', PRIORITIES, c.priority);
  check(issues, 'Project participation', PROJECT_TYPES, c.projectParticipation);
  return issues;
}

export function contactReviewIssues(c: Contact): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  check(issues, 'Contact status', PARTNER_STATUSES, c.statuses);
  check(issues, 'Contact priority', CONTACT_PRIORITIES, c.priority);
  check(issues, 'Contact role', CONTACT_ROLES, c.roles);
  check(issues, 'EL project participation', PROJECT_TYPES, c.projectParticipation);
  check(issues, 'Preferred contact method', PREFERRED_CONTACT_METHODS, c.preferredContactMethod);
  check(issues, 'Source', SOURCES, c.source);
  check(issues, 'Alumni', ALUMNI_OPTIONS, c.alumniPrograms);
  return issues;
}

export function formatAddress(a: Company['address'], multiline = false): string {
  const line2 = [a.city, a.province].filter(Boolean).join(', ');
  const parts = [a.street, [line2, a.postalCode].filter(Boolean).join(' '), a.country].filter(Boolean);
  return parts.join(multiline ? '\n' : ', ');
}
