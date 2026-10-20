// CSV exports. Company and contact files use Lauren's template headers in template order, so
// they can be re-imported here (or used as a starting point for Salesforce's Data Import Wizard).
import { toCsv } from '../lib/csv';
import { ACTIVITY_LABELS, fullName, lastCommunicationAt } from '../lib/selectors';
import type { Company, Contact, Database } from '../types';
import { COMPANY_FIELDS, CONTACT_FIELDS, getPath, type FieldDef } from './fields';

function cell(field: FieldDef, record: Company | Contact, db: Database): string | number | null {
  if (field.type === 'company') {
    const id = (record as Contact).companyId;
    return id ? (db.companies.find((c) => c.id === id)?.name ?? '') : '';
  }
  const value = getPath(record, field.key);
  if (Array.isArray(value)) return value.join(';'); // template format: "HBA Ivey Field Project;Guest Speaker"
  return (value as string | number | null) ?? '';
}

const byKey = (fields: FieldDef[], key: string) => fields.find((f) => f.key === key)!;
const lastComm = (db: Database, pick: (a: Database['activities'][number]) => boolean) => {
  const at = lastCommunicationAt(db.activities.filter(pick));
  return at ? at.slice(0, 10) : '';
};

const COMPANY_COLUMNS = ['name', 'phone', 'website', 'industry', 'address.street', 'address.city', 'address.province', 'address.postalCode', 'address.country', 'priority', 'statuses', 'projectParticipation', 'lastProjectDate', 'notes', 'description', 'id'];
const CONTACT_COLUMNS = ['firstName', 'lastName', 'jobTitle', 'companyId', 'email', 'workPhone', 'mobilePhone', 'priority', 'roles', 'projectParticipation', 'lastProjectDate', 'linkedInUrl', 'preferredContactMethod', 'source', 'alumniPrograms', 'graduationYear', 'notes', 'statuses', 'id'];
export const LAST_COMMUNICATION_HEADER = 'Last Communication (read-only)';

export function companiesCsv(db: Database): string {
  const fields = COMPANY_COLUMNS.map((k) => byKey(COMPANY_FIELDS, k));
  const rows = [...db.companies]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => [...fields.map((f) => cell(f, c, db)), lastComm(db, (a) => a.companyId === c.id)]);
  return toCsv([...fields.map((f) => f.headers[0]), LAST_COMMUNICATION_HEADER], rows);
}

export function contactsCsv(db: Database): string {
  const fields = CONTACT_COLUMNS.map((k) => byKey(CONTACT_FIELDS, k));
  const rows = [...db.contacts]
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
    .map((c) => [...fields.map((f) => cell(f, c, db)), lastComm(db, (a) => a.contactId === c.id)]);
  return toCsv([...fields.map((f) => f.headers[0]), LAST_COMMUNICATION_HEADER], rows);
}

export function activitiesCsv(db: Database): string {
  const company = (id: string | null) => (id ? (db.companies.find((c) => c.id === id)?.name ?? '') : '');
  const contact = (id: string | null) => {
    const c = id ? db.contacts.find((x) => x.id === id) : undefined;
    return c ? fullName(c) : '';
  };
  const rows = [...db.activities]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((a) => [
      a.email && !a.email.dateKnown ? '' : a.occurredAt,
      ACTIVITY_LABELS[a.type],
      a.subject,
      a.details,
      company(a.companyId),
      contact(a.contactId),
      a.applicationId ? (db.applications.find((x) => x.id === a.applicationId)?.title ?? '') : '',
      a.source,
      a.email ? [a.email.from.name, a.email.from.email && `<${a.email.from.email}>`].filter(Boolean).join(' ') : '',
      a.email?.to ?? '',
      a.email?.originalSender ? [a.email.originalSender.name, a.email.originalSender.email && `<${a.email.originalSender.email}>`].filter(Boolean).join(' ') : '',
      a.email?.originalText ?? '',
      a.id,
    ]);
  return toCsv(['Date', 'Type', 'Subject', 'Notes', 'Company', 'Contact', 'Application', 'Source', 'From', 'To', 'Original Sender', 'Original Email', 'Workspace ID'], rows);
}

export function followUpsCsv(db: Database): string {
  const company = (id: string | null) => (id ? (db.companies.find((c) => c.id === id)?.name ?? '') : '');
  const contact = (id: string | null) => {
    const c = id ? db.contacts.find((x) => x.id === id) : undefined;
    return c ? fullName(c) : '';
  };
  const rows = [...db.tasks]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((t) => [t.title, t.dueDate, t.status === 'done' ? 'Completed' : 'Open', t.completedAt ?? '', company(t.companyId), contact(t.contactId), t.notes, t.id]);
  return toCsv(['Follow-up', 'Due Date', 'Status', 'Completed At', 'Company', 'Contact', 'Notes', 'Workspace ID'], rows);
}

export function applicationsCsv(db: Database): string {
  const company = (id: string) => db.companies.find((c) => c.id === id)?.name ?? '';
  const contact = (id: string | null) => {
    const c = id ? db.contacts.find((x) => x.id === id) : undefined;
    return c ? fullName(c) : '';
  };
  const rows = [...db.applications]
    .sort((a, b) => company(a.companyId).localeCompare(company(b.companyId)) || a.title.localeCompare(b.title))
    .map((a) => [a.title, company(a.companyId), contact(a.primaryContactId), a.projectType, a.program, a.termSeason, a.termYear ?? '', a.stage, a.confirmationDeadline, a.scope, a.notes, a.stageHistory.at(-1)?.changedAt.slice(0, 10) ?? '', a.id]);
  return toCsv(['Title', 'Company', 'Primary Contact', 'Project Type', 'Program', 'Term', 'Year', 'Stage', 'Participation Confirmation Deadline', 'Scope', 'Notes', 'Stage Changed On', 'Workspace ID'], rows);
}
