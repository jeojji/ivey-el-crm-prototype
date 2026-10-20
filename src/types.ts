// Domain models for the relationship workspace.
// Every record carries id/createdAt/updatedAt so it can move to a shared database later.

export type ID = string;

export interface Address {
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

// Picklist fields are typed as plain strings on purpose: a value that isn't one of Lauren's
// options (e.g. an old "On hold" status) is kept as-is and flagged for review, never dropped.
// Official options live in lib/options.ts. Empty string / empty array = not recorded.

export interface Company {
  id: ID;
  name: string;
  phone: string;
  website: string;
  address: Address;
  /** One of INDUSTRIES. */
  industry: string;
  /** High | Medium | Low */
  priority: string;
  /** Any of PARTNER_STATUSES (multi-select). */
  statuses: string[];
  /** Any of PROJECT_TYPES (multi-select). */
  projectParticipation: string[];
  /** YYYY-MM-DD, or '' */
  lastProjectDate: string;
  /** Short "what they do" summary. Prototype field, not in Lauren's list. */
  description: string;
  /** "Notes / Relationship Context" */
  notes: string;
  /** Original values replaced during a schema upgrade, kept for reference. */
  legacy?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: ID;
  companyId: ID | null;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  workPhone: string;
  mobilePhone: string;
  linkedInUrl: string;
  /** Any of PARTNER_STATUSES (multi-select). */
  statuses: string[];
  /** High | Medium | Low | Do Not Contact */
  priority: string;
  /** Any of CONTACT_ROLES (multi-select). */
  roles: string[];
  /** Any of PROJECT_TYPES (multi-select). */
  projectParticipation: string[];
  lastProjectDate: string;
  /** Email | Phone | LinkedIn | In-Person */
  preferredContactMethod: string;
  /** One of SOURCES. */
  source: string;
  /** Any of ALUMNI_OPTIONS (multi-select). */
  alumniPrograms: string[];
  graduationYear: number | null;
  /** "Notes / Relationship Context" */
  notes: string;
  legacy?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export const ACTIVITY_TYPES = ['email', 'call', 'meeting', 'note'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Activity {
  id: ID;
  type: ActivityType;
  subject: string;
  details: string;
  /** ISO timestamp. A future timestamp on a meeting means it is scheduled. */
  occurredAt: string;
  companyId: ID | null;
  contactId: ID | null;
  /** Where the record came from. Only 'manual' exists today; imports/syncs come later. */
  source: 'manual' | 'sample';
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'open' | 'done';

export interface Task {
  id: ID;
  title: string;
  /** Local calendar date, YYYY-MM-DD. */
  dueDate: string;
  status: TaskStatus;
  companyId: ID | null;
  contactId: ID | null;
  notes: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const SCHEMA_VERSION = 2;

export interface Database {
  schemaVersion: typeof SCHEMA_VERSION;
  companies: Company[];
  contacts: Contact[];
  activities: Activity[];
  tasks: Task[];
}

export type EntityMap = {
  companies: Company;
  contacts: Contact;
  activities: Activity;
  tasks: Task;
};
export type CollectionName = keyof EntityMap;
export type EntityInput<K extends CollectionName> = Omit<EntityMap[K], 'id' | 'createdAt' | 'updatedAt'>;

export type CompanyInput = EntityInput<'companies'>;
export type ContactInput = EntityInput<'contacts'>;
export type ActivityInput = EntityInput<'activities'>;
export type TaskInput = EntityInput<'tasks'>;
