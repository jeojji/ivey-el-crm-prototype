// Campaign helpers. Nothing here sends anything: templates are filled for copying, and exports
// leave out Do Not Contact contacts.
import type { Campaign, Database } from '../types';
import { DO_NOT_CONTACT } from './options';
import { fullName } from './selectors';
import { toCsv } from './csv';

export const TEMPLATE_PLACEHOLDERS = ['{{firstName}}', '{{lastName}}', '{{companyName}}', '{{term}}', '{{projectTypes}}'] as const;

export function campaignTerm(c: Pick<Campaign, 'termSeason' | 'termYear'>): string {
  return [c.termSeason, c.termYear ?? ''].filter(Boolean).join(' ');
}

/** Fills placeholders. Unknown values become an empty string rather than invented text. */
export function fillTemplate(template: string, values: { firstName: string; lastName: string; companyName: string; term: string; projectTypes: string }): string {
  return template
    .replace(/\{\{\s*firstName\s*\}\}/g, values.firstName)
    .replace(/\{\{\s*lastName\s*\}\}/g, values.lastName)
    .replace(/\{\{\s*companyName\s*\}\}/g, values.companyName)
    .replace(/\{\{\s*term\s*\}\}/g, values.term)
    .replace(/\{\{\s*projectTypes\s*\}\}/g, values.projectTypes);
}

export function templateValues(db: Database, campaign: Campaign, contactId: string) {
  const c = db.contacts.find((x) => x.id === contactId);
  const company = c?.companyId ? db.companies.find((x) => x.id === c.companyId) : undefined;
  return {
    firstName: c?.firstName ?? '',
    lastName: c?.lastName ?? '',
    companyName: company?.name ?? '',
    term: campaignTerm(campaign),
    projectTypes: campaign.projectTypes.join(' / '),
  };
}

/** Participants as CSV. Do Not Contact and deleted contacts are excluded and counted. */
export function participantsCsv(db: Database, campaign: Campaign): { csv: string; included: number; excludedDnc: number; excludedMissing: number } {
  let excludedDnc = 0;
  let excludedMissing = 0;
  const rows: (string | number)[][] = [];
  for (const p of campaign.participants) {
    const c = db.contacts.find((x) => x.id === p.contactId);
    if (!c) {
      excludedMissing++;
      continue;
    }
    if (c.priority === DO_NOT_CONTACT) {
      excludedDnc++;
      continue;
    }
    const company = c.companyId ? db.companies.find((x) => x.id === c.companyId) : undefined;
    rows.push([c.firstName, c.lastName, c.email, company?.name ?? '', p.status, p.statusHistory.at(-1)?.changedAt.slice(0, 10) ?? '', p.notes, campaign.name]);
  }
  return {
    csv: toCsv(['First Name', 'Last Name', 'Email', 'Account Name', 'Campaign Status', 'Status Changed On', 'Notes', 'Campaign'], rows),
    included: rows.length,
    excludedDnc,
    excludedMissing,
  };
}

export const contactLabel = (db: Database, contactId: string) => {
  const c = db.contacts.find((x) => x.id === contactId);
  return c ? fullName(c) : '(deleted contact)';
};
