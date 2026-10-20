// Validates a JSON backup before it is allowed to replace the workspace.
import { ACTIVITY_TYPES, SCHEMA_VERSION, type Database } from '../types';
import { isV1Database, isV2Database, upgradeToCurrent } from './migrations';

export type BackupCheck =
  | { ok: true; db: Database; fromVersion: number; counts: Record<'companies' | 'contacts' | 'activities' | 'tasks' | 'applications' | 'briefs' | 'campaigns' | 'feedback', number> }
  | { ok: false; errors: string[] };

const isStr = (v: unknown) => typeof v === 'string';
const isStrOrNull = (v: unknown) => v === null || typeof v === 'string';
const isStrArray = (v: unknown) => Array.isArray(v) && v.every(isStr);
const isDate = (v: unknown) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v as string);
const isTimestamp = (v: unknown) => isStr(v) && !Number.isNaN(Date.parse(v as string));

type Rule = [field: string, test: (v: unknown) => boolean, expected: string];

const isParty = (v: unknown) => !!v && typeof v === 'object' && isStr((v as Record<string, unknown>).name) && isStr((v as Record<string, unknown>).email);
function isEmailDetails(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    (e.direction === 'received' || e.direction === 'sent') &&
    isParty(e.from) &&
    isStr(e.to) &&
    typeof e.forwarded === 'boolean' &&
    (e.originalSender === null || isParty(e.originalSender)) &&
    typeof e.dateKnown === 'boolean' &&
    isStr(e.originalText) &&
    isStr(e.fingerprint) &&
    (e.aiAssist === undefined ||
      (!!e.aiAssist && typeof e.aiAssist === 'object' && isStr((e.aiAssist as Record<string, unknown>).model) && Array.isArray((e.aiAssist as Record<string, unknown>).appliedFields)))
  );
}

const BASE: Rule[] = [
  ['id', (v) => isStr(v) && (v as string).length > 0, 'a non-empty id'],
  ['createdAt', isTimestamp, 'a timestamp'],
  ['updatedAt', isTimestamp, 'a timestamp'],
];
const COMPANY: Rule[] = [
  ...BASE,
  ['name', (v) => isStr(v) && (v as string).trim().length > 0, 'a name'],
  ...(['phone', 'website', 'industry', 'priority', 'description', 'notes'].map((f) => [f, isStr, 'text']) as Rule[]),
  ['lastProjectDate', (v) => v === '' || isDate(v), 'a YYYY-MM-DD date or empty'],
  ['statuses', isStrArray, 'a list'],
  ['projectParticipation', isStrArray, 'a list'],
  ['address', (v) => !!v && typeof v === 'object' && ['street', 'city', 'province', 'postalCode', 'country'].every((k) => isStr((v as Record<string, unknown>)[k])), 'an address'],
];
const CONTACT: Rule[] = [
  ...BASE,
  ['companyId', isStrOrNull, 'a company id or null'],
  ['firstName', isStr, 'text'],
  ['lastName', isStr, 'text'],
  ...(['jobTitle', 'email', 'workPhone', 'mobilePhone', 'linkedInUrl', 'priority', 'preferredContactMethod', 'source', 'notes'].map((f) => [f, isStr, 'text']) as Rule[]),
  ['lastProjectDate', (v) => v === '' || isDate(v), 'a YYYY-MM-DD date or empty'],
  ...(['statuses', 'roles', 'projectParticipation', 'alumniPrograms'].map((f) => [f, isStrArray, 'a list']) as Rule[]),
  ['graduationYear', (v) => v === null || (Number.isInteger(v) && (v as number) > 1800), 'a year or null'],
];
const ACTIVITY: Rule[] = [
  ...BASE,
  ['type', (v) => (ACTIVITY_TYPES as readonly unknown[]).includes(v), 'email, call, meeting or note'],
  ['subject', isStr, 'text'],
  ['details', isStr, 'text'],
  ['occurredAt', isTimestamp, 'a timestamp'],
  ['companyId', isStrOrNull, 'a company id or null'],
  ['contactId', isStrOrNull, 'a contact id or null'],
  ['applicationId', isStrOrNull, 'an application id or null'],
  ['email', (v) => v === undefined || isEmailDetails(v), 'email details (sender, recipients, original message)'],
  ['editHistory', (v) => v === undefined || (Array.isArray(v) && v.every((e) => e && isTimestamp(e.at) && Array.isArray(e.changes))), 'a list of edits'],
];
const TASK: Rule[] = [
  ...BASE,
  ['title', isStr, 'text'],
  ['dueDate', isDate, 'a YYYY-MM-DD date'],
  ['status', (v) => v === 'open' || v === 'done', 'open or done'],
  ['companyId', isStrOrNull, 'a company id or null'],
  ['contactId', isStrOrNull, 'a contact id or null'],
  ['notes', isStr, 'text'],
  ['completedAt', (v) => v === null || isTimestamp(v), 'a timestamp or null'],
  ['applicationId', isStrOrNull, 'an application id or null'],
];
const APPLICATION: Rule[] = [
  ...BASE,
  ['title', (v) => isStr(v) && (v as string).trim().length > 0, 'a title'],
  ['companyId', (v) => isStr(v) && (v as string).length > 0, 'a company id'],
  ['primaryContactId', isStrOrNull, 'a contact id or null'],
  ...(['projectType', 'program', 'termSeason', 'scope', 'stage', 'notes'].map((f) => [f, isStr, 'text']) as Rule[]),
  ['termYear', (v) => v === null || Number.isInteger(v), 'a year or null'],
  ['confirmationDeadline', (v) => v === '' || isDate(v), 'a YYYY-MM-DD date or empty'],
  ['stageHistory', (v) => Array.isArray(v) && v.every((h) => h && isStr(h.stage) && isTimestamp(h.changedAt)), 'a list of stage changes'],
];

// Briefs may refer to records deleted since (they're then shown as outdated), so their links aren't checked.
const BRIEF: Rule[] = [
  ...BASE,
  ['companyId', isStrOrNull, 'a company id or null'],
  ['contactId', isStrOrNull, 'a contact id or null'],
  ['applicationId', isStrOrNull, 'an application id or null'],
  ['sources', (v) => Array.isArray(v), 'a list of sources'],
  ['model', isStr, 'text'],
  ['generatedAt', isTimestamp, 'a timestamp'],
  ['content', (v) => !!v && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).summary), 'brief content'],
  ['edits', (v) => !!v && typeof v === 'object', 'edited drafts'],
  ['createdTaskIds', isStrArray, 'a list'],
];

const CAMPAIGN: Rule[] = [
  ...BASE,
  ['name', (v) => isStr(v) && (v as string).trim().length > 0, 'a name'],
  ...(['purpose', 'termSeason', 'description', 'state', 'templateSubject', 'templateBody'].map((f) => [f, isStr, 'text']) as Rule[]),
  ['projectTypes', isStrArray, 'a list'],
  ['termYear', (v) => v === null || Number.isInteger(v), 'a year or null'],
  ['participants', (v) => Array.isArray(v) && v.every((p) => p && isStr(p.id) && isStr(p.contactId) && isStr(p.status) && Array.isArray(p.statusHistory)), 'a list of participants'],
];
const FEEDBACK: Rule[] = [
  ...BASE,
  ['applicationId', isStrOrNull, 'an application id or null'],
  ['companyId', (v) => isStr(v) && (v as string).length > 0, 'a company id'],
  ...(['applicationLabel', 'source', 'givenBy', 'outcome', 'notes'].map((f) => [f, isStr, 'text']) as Rule[]),
  ['originalText', (v) => isStr(v) && (v as string).trim().length > 0, 'the original feedback text'],
  ['receivedOn', (v) => v === '' || isDate(v), 'a YYYY-MM-DD date or empty'],
  ['flags', (v) => Array.isArray(v) && v.every((f) => f && isStr(f.flag) && isTimestamp(f.flaggedAt)), 'a list of flags'],
];

const MAX_ERRORS = 15;

export function checkBackup(text: string): BackupCheck {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["This file isn't valid JSON. Choose a backup file downloaded from this workspace."] };
  }

  let fromVersion = SCHEMA_VERSION as number;
  if (isV1Database(parsed) || isV2Database(parsed)) {
    fromVersion = parsed.schemaVersion;
    parsed = upgradeToCurrent(parsed);
  }
  const db = parsed as Record<string, unknown>;
  // Backups made before these optional lists existed have none.
  if (db && typeof db === 'object') for (const k of ['briefs', 'campaigns', 'feedback']) if (db[k] === undefined) db[k] = [];
  if (!db || typeof db !== 'object' || db.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, errors: ["This doesn't look like a workspace backup (missing or unsupported schemaVersion)."] };
  }

  const errors: string[] = [];
  const add = (msg: string) => errors.length < MAX_ERRORS && errors.push(msg);
  const collections: [keyof Database & string, string, Rule[]][] = [
    ['companies', 'Company', COMPANY],
    ['contacts', 'Contact', CONTACT],
    ['activities', 'Activity', ACTIVITY],
    ['tasks', 'Follow-up', TASK],
    ['applications', 'Application', APPLICATION],
    ['briefs', 'Brief', BRIEF],
    ['campaigns', 'Campaign', CAMPAIGN],
    ['feedback', 'Feedback', FEEDBACK],
  ];
  const ids: Record<string, Set<string>> = {};

  for (const [key, noun, rules] of collections) {
    const list = db[key];
    if (!Array.isArray(list)) {
      add(`The backup has no ${key} list.`);
      continue;
    }
    ids[key] = new Set();
    list.forEach((rec, i) => {
      if (!rec || typeof rec !== 'object') return void add(`${noun} #${i + 1} is not a record.`);
      const r = rec as Record<string, unknown>;
      for (const [field, test, expected] of rules) {
        if (!test(r[field])) add(`${noun} #${i + 1}${isStr(r.id) ? ` (${r.id})` : ''}: “${field}” should be ${expected}.`);
      }
      if (isStr(r.id)) {
        if (ids[key].has(r.id as string)) add(`${noun} id ${r.id} appears more than once.`);
        ids[key].add(r.id as string);
      }
    });
  }

  // Links between records, checked even when other problems were found so all issues show at once.
  const records = (key: string) => (Array.isArray(db[key]) ? (db[key] as Record<string, unknown>[]).filter((r) => r && typeof r === 'object') : []);
  const link = (noun: string, rec: Record<string, unknown>, field: string, pool: Set<string> | undefined) => {
    const target = rec[`${field}Id`];
    if (pool && typeof target === 'string' && !pool.has(target)) add(`${noun} ${String(rec.id)} links to ${field} ${target}, which isn't in the backup.`);
  };
  records('contacts').forEach((c) => link('Contact', c, 'company', ids.companies));
  for (const [key, noun] of [['activities', 'Activity'], ['tasks', 'Follow-up']] as const) {
    records(key).forEach((r) => {
      link(noun, r, 'company', ids.companies);
      link(noun, r, 'contact', ids.contacts);
      link(noun, r, 'application', ids.applications);
    });
  }
  // Feedback must point at an existing company (flags are about the company); its application may have been deleted.
  records('feedback').forEach((f) => link('Feedback', f, 'company', ids.companies));
  records('applications').forEach((a) => {
    link('Application', a, 'company', ids.companies);
    link('Application', { ...a, contactId: a.primaryContactId }, 'contact', ids.contacts);
  });

  if (errors.length) {
    if (errors.length >= MAX_ERRORS) errors.push('…and possibly more. Nothing was restored.');
    return { ok: false, errors };
  }
  const d = db as unknown as Database;
  return {
    ok: true,
    db: d,
    fromVersion,
    counts: { companies: d.companies.length, contacts: d.contacts.length, activities: d.activities.length, tasks: d.tasks.length, applications: d.applications.length, briefs: d.briefs.length, campaigns: d.campaigns.length, feedback: d.feedback.length },
  };
}
