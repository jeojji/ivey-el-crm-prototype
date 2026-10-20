import { INDUSTRIES, PARTNER_STATUSES, isKnown, normalizeOption } from '../lib/options';
import { SCHEMA_VERSION, type Activity, type Company, type Contact, type Database, type Task } from '../types';

/** What an upgrade will do, shown to the user before they confirm it. */
export interface MigrationPreview {
  fromVersion: number;
  counts: { companies: number; contacts: number; activities: number; tasks: number };
  /** Old statuses with no match in Lauren's list. Kept as-is and flagged for review. */
  unmatchedStatuses: { company: string; status: string }[];
  /** Old free-text industries with no match in Lauren's list. Kept as-is and flagged for review. */
  unmatchedIndustries: string[];
}

type V1Company = {
  id: string;
  name: string;
  status?: string;
  industry?: string;
  city?: string;
  website?: string;
  description?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
type V1Contact = Omit<Contact, 'workPhone' | 'mobilePhone' | 'linkedInUrl' | 'statuses' | 'priority' | 'roles' | 'projectParticipation' | 'lastProjectDate' | 'preferredContactMethod' | 'source' | 'alumniPrograms' | 'graduationYear'> & { phone?: string };

export interface V1Database {
  schemaVersion: 1;
  companies: V1Company[];
  contacts: V1Contact[];
  activities: Activity[];
  tasks: Task[];
}

export function isV1Database(value: unknown): value is V1Database {
  if (!value || typeof value !== 'object') return false;
  const db = value as Record<string, unknown>;
  return db.schemaVersion === 1 && ['companies', 'contacts', 'activities', 'tasks'].every((k) => Array.isArray(db[k]));
}

/** Old single status → new multi-select statuses. "Active partner" matches "Active Partner"; "On hold" has no match. */
function migrateStatus(status: string | undefined): { statuses: string[]; known: boolean } {
  if (!status) return { statuses: [], known: true };
  const { value, known } = normalizeOption(PARTNER_STATUSES, status);
  return { statuses: [value], known };
}

export function previewV1Migration(v1: V1Database): MigrationPreview {
  return {
    fromVersion: 1,
    counts: {
      companies: v1.companies.length,
      contacts: v1.contacts.length,
      activities: v1.activities.length,
      tasks: v1.tasks.length,
    },
    unmatchedStatuses: v1.companies
      .filter((c) => !migrateStatus(c.status).known)
      .map((c) => ({ company: c.name, status: c.status ?? '' })),
    unmatchedIndustries: [...new Set(v1.companies.map((c) => c.industry ?? '').filter((i) => i && !isKnown(INDUSTRIES, i)))],
  };
}

/**
 * Schema 1 → 2. Every record is kept. New fields start empty (nothing is invented).
 * Replaced values are copied into `legacy` so the originals stay visible.
 * Activities and tasks are unchanged.
 */
export function migrateV1(v1: V1Database): Database {
  const companies: Company[] = v1.companies.map((old) => {
    const { status, city, ...rest } = old;
    const legacy: Record<string, string> = {};
    if (status) legacy.status = status;
    if (city) legacy.city = city;
    return {
      ...rest,
      name: old.name,
      phone: '',
      website: old.website ?? '',
      // The old free-text city (e.g. "Toronto, ON") goes into City unchanged rather than being guessed apart.
      address: { street: '', city: city ?? '', province: '', postalCode: '', country: '' },
      industry: old.industry ?? '',
      priority: '',
      statuses: migrateStatus(status).statuses,
      projectParticipation: [],
      lastProjectDate: '',
      description: old.description ?? '',
      notes: old.notes ?? '',
      legacy,
    };
  });

  const contacts: Contact[] = v1.contacts.map((old) => {
    const { phone, ...rest } = old;
    return {
      ...rest,
      // The old single "Phone" field becomes Work phone; mobile was never recorded.
      workPhone: phone ?? '',
      mobilePhone: '',
      linkedInUrl: '',
      statuses: [],
      priority: '',
      roles: [],
      projectParticipation: [],
      lastProjectDate: '',
      preferredContactMethod: '',
      source: '',
      alumniPrograms: [],
      graduationYear: null,
      notes: old.notes ?? '',
    };
  });

  return { schemaVersion: SCHEMA_VERSION, companies, contacts, activities: v1.activities, tasks: v1.tasks };
}
