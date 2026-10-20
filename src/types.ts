import type { BriefContent, BriefSource } from './ai/brief';

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

export interface EmailParty {
  name: string;
  email: string;
}

/** Details kept for emails added through "Add email". Unknown values stay blank. */
export interface EmailDetails {
  /** Received from the partner, or sent by the EL office to the partner. */
  direction: 'received' | 'sent';
  from: EmailParty;
  /** Recipients exactly as entered. */
  to: string;
  forwarded: boolean;
  /** For forwarded emails: the person who originally wrote it, chosen explicitly. Null if unknown. */
  originalSender: EmailParty | null;
  /** False when the email's date wasn't known; occurredAt is then the time it was added. */
  dateKnown: boolean;
  /** The pasted message, exactly as pasted. Never edited; notes are kept separately in Activity.details. */
  originalText: string;
  /** Used to flag possible duplicates. */
  fingerprint: string;
  /** Present when local AI suggested some details, which Lauren then reviewed and confirmed. */
  aiAssist?: { model: string; extractedAt: string; appliedFields: string[] };
}

/** One saved edit: which fields changed, from what, to what. */
export interface ActivityEdit {
  at: string;
  changes: { field: string; from: string; to: string }[];
}

export interface Activity {
  id: ID;
  type: ActivityType;
  subject: string;
  details: string;
  /** ISO timestamp. A future timestamp on a meeting means it is scheduled. */
  occurredAt: string;
  companyId: ID | null;
  contactId: ID | null;
  /** Optional link to the application (engagement opportunity) this activity was about. */
  applicationId: ID | null;
  /** Where the record came from. */
  source: 'manual' | 'sample' | 'email-intake';
  /** Present on emails added through "Add email". */
  email?: EmailDetails;
  /** Set when the activity was recorded as outreach for a campaign. */
  campaignId?: ID | null;
  /** Basic edit history, oldest first (link corrections, subject/date/notes edits). */
  editHistory?: ActivityEdit[];
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
  applicationId: ID | null;
  notes: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * An engagement opportunity with a partner: Lauren's Salesforce "Opportunity", called an
 * application in the workflow documents. Not a job application.
 * Its stage is separate from company partner statuses and contact statuses.
 */
export interface Application {
  id: ID;
  title: string;
  companyId: ID;
  primaryContactId: ID | null;
  /** One of APPLICATION_PROJECT_TYPES, or '' */
  projectType: string;
  /** HBA | MBA | MSc | CEMS, or '' */
  program: string;
  /** Fall | Winter | Summer, or '' */
  termSeason: string;
  termYear: number | null;
  /** Scope / description */
  scope: string;
  /** "Close Date": the participation confirmation deadline. YYYY-MM-DD or '' */
  confirmationDeadline: string;
  /** One of APPLICATION_STAGES */
  stage: string;
  notes: string;
  /** Every stage change, oldest first. */
  stageHistory: { stage: string; changedAt: string }[];
  createdAt: string;
  updatedAt: string;
}

/** A saved relationship brief / conversation prep, generated by the local model from chosen records. */
export interface Brief {
  id: ID;
  companyId: ID | null;
  contactId: ID | null;
  applicationId: ID | null;
  /** The records used, with the version (updatedAt) each had when the brief was generated. */
  sources: Omit<BriefSource, 'text'>[];
  model: string;
  generatedAt: string;
  durationMs: number;
  content: BriefContent;
  /** Facts/suggestions the safety checks removed, explained. */
  warnings: string[];
  /** Source ids containing text that looks like instructions to an AI. */
  flaggedSources: string[];
  /** Lauren's edited versions of the drafts (start as the suggestions). */
  edits: { openingScript: string; talkingPoints: string; emailSubject: string; emailBody: string };
  /** Follow-ups Lauren created from suggested next steps. */
  createdTaskIds: ID[];
  createdAt: string;
  updatedAt: string;
}

/** One contact in a campaign. Their status is separate from company status and application stage. */
export interface CampaignParticipant {
  id: ID;
  contactId: ID;
  /** Company at the time they were added (for display if the contact later moves). */
  companyId: ID | null;
  /** One of APPLICATION_STAGES (Lauren: campaigns use the Opportunity statuses). */
  status: string;
  statusHistory: { status: string; changedAt: string }[];
  notes: string;
  addedAt: string;
}

/** An outreach campaign. Emails are never sent from the app; outreach is recorded by hand. */
export interface Campaign {
  id: ID;
  name: string;
  /** One of CAMPAIGN_PURPOSES */
  purpose: string;
  projectTypes: string[];
  termSeason: string;
  termYear: number | null;
  description: string;
  /** Planning | Active | Closed */
  state: string;
  templateSubject: string;
  templateBody: string;
  participants: CampaignParticipant[];
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackFlagEntry {
  flag: string;
  flaggedAt: string;
  note: string;
}

/** Feedback and outcome for a project (application) and its company. */
export interface Feedback {
  id: ID;
  applicationId: ID | null;
  /** Title and term at the time it was recorded, so flags still show their project if the application is deleted. */
  applicationLabel: string;
  companyId: ID;
  /** One of FEEDBACK_SOURCES */
  source: string;
  givenBy: string;
  /** YYYY-MM-DD, or '' if unknown */
  receivedOn: string;
  /** The feedback exactly as received. Never edited. */
  originalText: string;
  outcome: string;
  /** Lauren's own notes, editable. */
  notes: string;
  /** Manual flags only, each with when it was set. Never decides eligibility by itself. */
  flags: FeedbackFlagEntry[];
  editHistory: ActivityEdit[];
  createdAt: string;
  updatedAt: string;
}

export const SCHEMA_VERSION = 3;

export interface Database {
  schemaVersion: typeof SCHEMA_VERSION;
  companies: Company[];
  contacts: Contact[];
  activities: Activity[];
  tasks: Task[];
  applications: Application[];
  /** Added after schema 3 shipped; older saved data without it is read as an empty list. */
  briefs: Brief[];
  /** Same: optional lists added later; read as empty when absent. */
  campaigns: Campaign[];
  feedback: Feedback[];
}

export type EntityMap = {
  companies: Company;
  contacts: Contact;
  activities: Activity;
  tasks: Task;
  applications: Application;
  briefs: Brief;
  campaigns: Campaign;
  feedback: Feedback;
};
export type CollectionName = keyof EntityMap;
export type EntityInput<K extends CollectionName> = Omit<EntityMap[K], 'id' | 'createdAt' | 'updatedAt'>;

export type CompanyInput = EntityInput<'companies'>;
export type ContactInput = EntityInput<'contacts'>;
export type ActivityInput = EntityInput<'activities'>;
export type TaskInput = EntityInput<'tasks'>;
export type ApplicationInput = EntityInput<'applications'>;
