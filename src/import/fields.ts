// Import/export column definitions. Template headers from Lauren's Salesforce CSV templates come
// first in each `headers` list and are what exports use, so an exported file can be re-imported.
// See REQUIREMENTS.md for where each mapping comes from.

import {
  ALIASES,
  ALUMNI_OPTIONS,
  CONTACT_PRIORITIES,
  CONTACT_ROLES,
  INDUSTRIES,
  PARTNER_STATUSES,
  PREFERRED_CONTACT_METHODS,
  PRIORITIES,
  PROJECT_TYPES,
  SOURCES,
} from '../lib/options';

export type ImportKind = 'companies' | 'contacts';

export type FieldType =
  | 'id' // Workspace ID from a previous export, used for exact matching
  | 'text'
  | 'longtext' // notes: never overwritten without an explicit choice
  | 'single' // picklist
  | 'multi' // picklist, semicolon-separated
  | 'date' // YYYY-MM-DD
  | 'year'
  | 'email'
  | 'url'
  | 'website'
  | 'phone'
  | 'company'; // contacts: Account Name, resolved to a company

export interface FieldDef {
  /** Dotted path into the record, e.g. "address.city". */
  key: string;
  label: string;
  type: FieldType;
  /** Accepted column headers. The first is the template header used for export. */
  headers: string[];
  options?: readonly string[];
  aliases?: Record<string, string>;
  required?: boolean;
}

export const COMPANY_FIELDS: FieldDef[] = [
  { key: 'id', label: 'Workspace ID', type: 'id', headers: ['Workspace ID'] },
  { key: 'name', label: 'Company name', type: 'text', headers: ['Account Name', 'Company Name', 'Company'], required: true },
  { key: 'phone', label: 'Company phone', type: 'phone', headers: ['Phone', 'Company Phone'] },
  { key: 'website', label: 'Website', type: 'website', headers: ['Website'] },
  { key: 'industry', label: 'Industry', type: 'single', headers: ['Industry'], options: INDUSTRIES, aliases: ALIASES.industry },
  { key: 'address.street', label: 'Street', type: 'text', headers: ['Billing Street', 'Street'] },
  { key: 'address.city', label: 'City', type: 'text', headers: ['Billing City', 'City'] },
  { key: 'address.province', label: 'Province / state', type: 'text', headers: ['Billing State/Province', 'Province', 'State/Province'] },
  { key: 'address.postalCode', label: 'Postal / ZIP code', type: 'text', headers: ['Billing Postal Code', 'Postal Code'] },
  { key: 'address.country', label: 'Country', type: 'text', headers: ['Billing Country', 'Country'] },
  { key: 'priority', label: 'Partnership priority', type: 'single', headers: ['Partnership Priority'], options: PRIORITIES },
  { key: 'statuses', label: 'Partner status', type: 'multi', headers: ['Partner Status', 'Parnter Status'], options: PARTNER_STATUSES },
  {
    key: 'projectParticipation',
    label: 'Project participation',
    type: 'multi',
    headers: ['EL Project Participation (Account)', 'Project Participation', 'EL Project Participation'],
    options: PROJECT_TYPES,
    aliases: ALIASES.projectType,
  },
  { key: 'lastProjectDate', label: 'Last project participated', type: 'date', headers: ['Last Project Participated (Account)', 'Last Project Participated'] },
  { key: 'notes', label: 'Relationship notes', type: 'longtext', headers: ['Description/Notes', 'Notes / Relationship Context', 'Relationship Notes', 'Notes'] },
  { key: 'description', label: 'About the company', type: 'longtext', headers: ['About'] },
];

export const CONTACT_FIELDS: FieldDef[] = [
  { key: 'id', label: 'Workspace ID', type: 'id', headers: ['Workspace ID'] },
  { key: 'firstName', label: 'First name', type: 'text', headers: ['First Name'], required: true },
  { key: 'lastName', label: 'Last name', type: 'text', headers: ['Last Name'], required: true },
  { key: 'jobTitle', label: 'Job title', type: 'text', headers: ['Title', 'Job Title'] },
  { key: 'companyId', label: 'Company (Account Name)', type: 'company', headers: ['Account Name', 'Company', 'Company Name'] },
  { key: 'email', label: 'Email', type: 'email', headers: ['Email'] },
  { key: 'workPhone', label: 'Work phone', type: 'phone', headers: ['Phone', 'Work Phone'] },
  { key: 'mobilePhone', label: 'Mobile', type: 'phone', headers: ['Mobile', 'Mobile Phone'] },
  { key: 'statuses', label: 'Contact status', type: 'multi', headers: ['Contact Status'], options: PARTNER_STATUSES },
  { key: 'priority', label: 'Contact priority', type: 'single', headers: ['Contact Priority'], options: CONTACT_PRIORITIES },
  { key: 'roles', label: 'Contact role', type: 'multi', headers: ['Contact Role'], options: CONTACT_ROLES },
  {
    key: 'projectParticipation',
    label: 'EL project participation',
    type: 'multi',
    headers: ['EL Project Participation (Contact)', 'EL Project Participation'],
    options: PROJECT_TYPES,
    aliases: ALIASES.projectType,
  },
  { key: 'lastProjectDate', label: 'Last project participated', type: 'date', headers: ['Last Project Participated (Contact)', 'Last Project Participated'] },
  { key: 'linkedInUrl', label: 'LinkedIn URL', type: 'url', headers: ['LinkedIn URL', 'LinkedIn'] },
  { key: 'preferredContactMethod', label: 'Preferred contact method', type: 'single', headers: ['Preferred Contact Method'], options: PREFERRED_CONTACT_METHODS },
  { key: 'source', label: 'Source', type: 'single', headers: ['Source'], options: SOURCES },
  { key: 'alumniPrograms', label: 'Alumni', type: 'multi', headers: ['Ivey Alumni', 'Alumni', 'Alumni Programs'], options: ALUMNI_OPTIONS },
  { key: 'graduationYear', label: 'Graduation year', type: 'year', headers: ['Graduation Year'] },
  { key: 'notes', label: 'Relationship notes', type: 'longtext', headers: ['Notes / Relationship Context', 'Relationship Notes', 'Notes'] },
];

export function fieldsFor(kind: ImportKind): FieldDef[] {
  return kind === 'companies' ? COMPANY_FIELDS : CONTACT_FIELDS;
}

const normHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, ' ');

/** Default column → field mapping by header name. Unrecognised columns map to null ("Don't import"). */
export function autoMap(kind: ImportKind, headers: string[]): (string | null)[] {
  const used = new Set<string>();
  return headers.map((h) => {
    const n = normHeader(h);
    const field = fieldsFor(kind).find((f) => !used.has(f.key) && f.headers.some((alias) => normHeader(alias) === n));
    if (!field) return null;
    used.add(field.key);
    return field.key;
  });
}

/** Guesses which template a file uses from its headers. */
export function detectKind(headers: string[]): ImportKind | null {
  const set = new Set(headers.map(normHeader));
  if (set.has('first name') && set.has('last name')) return 'contacts';
  if (set.has('account name') || set.has('company name')) return 'companies';
  return null;
}

/** Reads a dotted path such as "address.city". */
export function getPath(record: object, key: string): unknown {
  return key.split('.').reduce<unknown>((obj, part) => (obj as Record<string, unknown> | undefined)?.[part], record);
}
