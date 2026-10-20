// Helpers for the "Add email" intake. Plain text rules only: nothing is guessed or extracted
// from the message body. Lauren enters the details and confirms every link.
import type { Activity, Company, Contact, Database } from '../types';
import { normalizeName } from '../import/plan';
import { toDateString } from './dates';
import { fullName } from './selectors';

/** Personal mail providers: a shared domain here says nothing about the company. */
const PERSONAL_DOMAINS = new Set(['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'live.com', 'me.com', 'proton.me', 'protonmail.com', 'aol.com']);

export function domainOf(address: string): string {
  const m = /@([^\s>@]+)$/.exec(address.trim().toLowerCase());
  return m ? m[1] : '';
}

export function isCompanyDomain(domain: string): boolean {
  return !!domain && !PERSONAL_DOMAINS.has(domain);
}

/** "Re: Fwd: Project idea" → "project idea" */
export function normalizeSubject(subject: string): string {
  return subject.toLowerCase().replace(/^\s*((re|fwd?|fw)\s*:\s*)+/i, '').replace(/\s+/g, ' ').trim();
}

export function normalizeBody(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Small stable hash (djb2) so the fingerprint doesn't store the message twice. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function emailFingerprint(originalText: string): string {
  return hash(normalizeBody(originalText));
}

/** Splits the name Lauren typed into first / last for a new contact (editable before saving). */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/** First email address in a recipients line such as "Lauren <lauren@ivey.example>; Sam <sam@x.example>". */
export function firstAddress(text: string): string {
  const m = /[^\s<>,;"]+@[^\s<>,;"]+/.exec(text);
  return m ? m[0].toLowerCase() : '';
}

export interface ContactSuggestion {
  contact: Contact;
  reason: 'Same email address' | 'Same name' | 'Same email domain';
}

export function suggestContacts(db: Database, partner: { name: string; email: string }): ContactSuggestion[] {
  const out: ContactSuggestion[] = [];
  const seen = new Set<string>();
  const add = (contact: Contact, reason: ContactSuggestion['reason']) => {
    if (seen.has(contact.id)) return;
    seen.add(contact.id);
    out.push({ contact, reason });
  };
  const email = partner.email.trim().toLowerCase();
  if (email) db.contacts.filter((c) => c.email.toLowerCase() === email).forEach((c) => add(c, 'Same email address'));
  const name = partner.name.trim().toLowerCase();
  if (name) db.contacts.filter((c) => fullName(c).toLowerCase() === name).forEach((c) => add(c, 'Same name'));
  const domain = domainOf(email);
  if (isCompanyDomain(domain)) db.contacts.filter((c) => domainOf(c.email) === domain).slice(0, 5).forEach((c) => add(c, 'Same email domain'));
  return out;
}

export interface CompanySuggestion {
  company: Company;
  reason: string;
}

export function suggestCompanies(db: Database, opts: { companyName: string; email: string; contact?: Contact | null }): CompanySuggestion[] {
  const out: CompanySuggestion[] = [];
  const seen = new Set<string>();
  const add = (company: Company | undefined, reason: string) => {
    if (!company || seen.has(company.id)) return;
    seen.add(company.id);
    out.push({ company, reason });
  };
  if (opts.contact?.companyId) add(db.companies.find((c) => c.id === opts.contact!.companyId), "The contact's company");
  const key = normalizeName(opts.companyName);
  if (key) {
    db.companies.filter((c) => normalizeName(c.name) === key).forEach((c) => add(c, 'Same name'));
    const core = key.split(' ')[0];
    if (core.length >= 4) db.companies.filter((c) => normalizeName(c.name).startsWith(core)).forEach((c) => add(c, 'Similar name'));
  }
  const domain = domainOf(opts.email);
  if (isCompanyDomain(domain)) {
    db.companies.filter((c) => c.website.toLowerCase().replace(/^www\./, '').split('/')[0] === domain).forEach((c) => add(c, 'Website matches the email domain'));
    db.contacts
      .filter((c) => c.companyId && domainOf(c.email) === domain)
      .forEach((c) => add(db.companies.find((co) => co.id === c.companyId), 'Other contacts there use this email domain'));
  }
  return out;
}

export interface DuplicateHit {
  activity: Activity;
  level: 'exact' | 'possible';
  reason: string;
}

/**
 * Emails already in the workspace that may be the same message: identical pasted text (exact), or
 * the same subject on the same day with the same contact or address (possible). Manually logged
 * email activities are checked too.
 */
export function findDuplicateEmails(
  db: Database,
  draft: { originalText: string; subject: string; occurredAt: string; dateKnown: boolean; partnerEmail: string; contactId: string | null },
): DuplicateHit[] {
  const fp = emailFingerprint(draft.originalText);
  const subject = normalizeSubject(draft.subject);
  const day = draft.dateKnown ? toDateString(new Date(draft.occurredAt)) : null;
  const partner = draft.partnerEmail.toLowerCase();
  const hits: DuplicateHit[] = [];
  for (const a of db.activities) {
    if (a.type !== 'email') continue;
    if (a.email && a.email.fingerprint === fp) {
      hits.push({ activity: a, level: 'exact', reason: 'The same message text is already saved.' });
      continue;
    }
    if (!subject || normalizeSubject(a.subject) !== subject) continue;
    const sameDay = day !== null && toDateString(new Date(a.occurredAt)) === day && (!a.email || a.email.dateKnown);
    const aPartner = a.email ? (a.email.originalSender?.email || (a.email.direction === 'received' ? a.email.from.email : firstAddress(a.email.to))).toLowerCase() : '';
    const samePerson = (draft.contactId && a.contactId === draft.contactId) || (partner && aPartner === partner);
    if (sameDay && (samePerson || !a.email)) {
      hits.push({ activity: a, level: 'possible', reason: a.email ? 'Same subject, same day and same person.' : 'A manually logged email with the same subject on the same day.' });
    } else if (samePerson && !day) {
      hits.push({ activity: a, level: 'possible', reason: 'Same subject and same person (this email has no date).' });
    }
  }
  return hits;
}
