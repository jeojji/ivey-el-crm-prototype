// Domain models for the relationship workspace.
// Every record carries id/createdAt/updatedAt so it can move to a shared database later.

export type ID = string;

export const RELATIONSHIP_STATUSES = ['Active partner', 'Prospect', 'On hold', 'Past partner'] as const;
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];

export interface Company {
  id: ID;
  name: string;
  status: RelationshipStatus;
  industry: string;
  city: string;
  website: string;
  description: string;
  /** Pinned relationship notes shown on the company profile. */
  notes: string;
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
  phone: string;
  notes: string;
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

export interface Database {
  schemaVersion: 1;
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
