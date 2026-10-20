// Picklist options from Lauren Starr's "Salesforce CRM Setup Request" (May 2026).
// The Word document is the primary source. CSV template spellings are accepted as aliases.
// See REQUIREMENTS.md for where each list came from and how the sources differ.

export const PRIORITIES = ['High', 'Medium', 'Low'] as const;

/** Account "Parnter Status" (sic) and Contact "Contact Status": same four values in both. */
export const PARTNER_STATUSES = ['Prospect', 'Outreach in Progress', 'Active Partner', 'Past Partner'] as const;

/** The document's Account list (17 values). Its Contact list is a shorter variant; see aliases. */
export const PROJECT_TYPES = [
  'MBA Ivey Field Project',
  'HBA Ivey Field Project',
  'IDIS Sprint',
  'Other Consulting Project',
  'Research Project',
  'CEMS Seminar',
  'CEMS Site Visit',
  'Guest Speaker',
  'CEMS Business Project',
  'New Venture Project',
  'Action Learning Project',
  'Advanced Learning Project',
  'MSc Hackathon',
  'Study Trip',
  'Ivey Global Lab',
  'MMA Field Project',
  'Other',
] as const;

export const INDUSTRIES = [
  'Accounting/Audit/Tax',
  'Advertising (Marketing Services, Ad Agencies, Communications, Public Relations, Market Research)',
  'Aerospace (Space Exploration, Drones, Aviation)',
  'Agriculture/Agribusiness',
  'Architecture & Planning',
  'Automotive',
  'Charities/Non-Profit',
  'Chemicals/Plastics',
  'Construction',
  'Consulting',
  'Consumer Products',
  'Consumer Services',
  'Economic Development',
  'Education',
  'Energy/Resources',
  'Engineering',
  'Entertainment',
  'Facilities Services',
  'Financial Services',
  'Food Service/Restaurant',
  'Government',
  'Healthcare',
  'Holding Company',
  'Law and Legal Services',
  'Manufacturing',
  'Other',
  'Packaging and Containers',
  'Political Organization',
  'Public Administration/Regulatory Groups',
  'Real Estate',
  'Recruitment Services/Executive Search',
  'Religious Institutions',
  'Retail',
  'Security and Investigations',
  'Technology',
  'Think Tanks/Policy Institute/Research Institute',
  'Transportation/Distribution/Logistics/Wholesale Trade',
  'Veterinary/Animal Health',
] as const;

export const CONTACT_PRIORITIES = ['High', 'Medium', 'Low', 'Do Not Contact'] as const;
export const DO_NOT_CONTACT = 'Do Not Contact';

export const CONTACT_ROLES = [
  'Primary Contact',
  'Secondary Contact',
  'Entrepreneur in Residence',
  'Executive in Residence',
  'Judge/Evaluator',
  'Guest Speaker',
  'HR Lead',
  'Other',
] as const;

export const PREFERRED_CONTACT_METHODS = ['Email', 'Phone', 'LinkedIn', 'In-Person'] as const;

export const SOURCES = [
  'Incoming interest',
  'Referral (from Corporate partners, Alumni or Faculty)',
  'Student Sourced',
  'CEMS Global Office',
  'Business Development',
] as const;

/** Document list. "Not an Ivey Alumnus" comes from the CSV template only; kept so that answer isn't lost. */
export const NOT_ALUMNUS = 'Not an Ivey Alumnus';
export const ALUMNI_OPTIONS = [
  'HBA',
  'MBA',
  'MSc Business Analytics',
  'MSc Digital Management',
  'MSc International Business',
  'CEMS',
  'EMBA',
  'AMBA',
  'MMA',
  'Western',
  'Other',
  NOT_ALUMNUS,
] as const;

/**
 * Spellings that mean exactly the same option. Keys are lower-case.
 * Values with a different meaning (e.g. the CSV's "Referral (Alumni/Faculty/Student)") are
 * deliberately NOT aliased: they're kept as-is and flagged for review.
 */
export const ALIASES = {
  industry: {
    energy: 'Energy/Resources',
    'non-profit': 'Charities/Non-Profit',
    transportation: 'Transportation/Distribution/Logistics/Wholesale Trade',
  },
  projectType: {
    'mba field project': 'MBA Ivey Field Project',
    'hba field project': 'HBA Ivey Field Project',
  },
} satisfies Record<string, Record<string, string>>;

/**
 * Matches a raw value to its official option (ignoring case, then via aliases).
 * Unknown values are returned unchanged with known=false, never dropped.
 */
export function normalizeOption(
  options: readonly string[],
  raw: string,
  aliases: Record<string, string> = {},
): { value: string; known: boolean } {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === lower);
  if (exact) return { value: exact, known: true };
  const alias = aliases[lower];
  if (alias) return { value: alias, known: true };
  return { value: trimmed, known: false };
}

export function isKnown(options: readonly string[], value: string): boolean {
  return !value || options.includes(value);
}

/** Short label for long picklist values (e.g. the Advertising industry) in tight spaces. */
export function shortLabel(value: string): string {
  return value.replace(/\s*\(.*\)$/, '');
}

// ---------------------------------------------------------------------------
// Applications (Lauren's "Opportunities"): engagement opportunities with a partner, not job applications.

/** Exact stage names and meanings from Lauren's request, in pipeline order. */
export const APPLICATION_STAGES = [
  'Identifying',
  'Outreach Sent',
  'Application submitted',
  'Meeting completed',
  'Project Approved',
  'Team Confirmed',
  'Active',
  'Completed',
  'Declined',
  'Deferred',
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const STAGE_MEANINGS: Record<ApplicationStage, string> = {
  Identifying: 'Corporate partner identified as a candidate',
  'Outreach Sent': 'Initial contact made',
  'Application submitted': 'Project scope/details shared',
  'Meeting completed': 'Meeting between EL office and corporate partner',
  'Project Approved': 'Project is approved by EL office',
  'Team Confirmed': 'Team assigned, corporate partner fully committed',
  Active: 'Project underway',
  Completed: 'Project delivered',
  Declined: 'Corporate partner no longer interested',
  Deferred: 'Corporate partner interested for future',
};

/** Shared with the partner but not yet approved by the EL office: shown as "awaiting review". */
export const AWAITING_REVIEW_STAGES: readonly ApplicationStage[] = ['Application submitted', 'Meeting completed'];
/** Participation isn't confirmed yet, so the confirmation deadline still matters. */
export const UNCONFIRMED_STAGES: readonly ApplicationStage[] = ['Identifying', 'Outreach Sent', 'Application submitted', 'Meeting completed', 'Project Approved'];
/** No further pipeline movement expected. */
export const CLOSED_STAGES: readonly ApplicationStage[] = ['Completed', 'Declined', 'Deferred'];

/**
 * Lauren's Opportunity "Project Type" list (15 values). Her document spells two of them
 * "MBA Field Project" / "HBA Field Project"; the app's shared spelling is used here so
 * applications, companies and contacts can be filtered together (see REQUIREMENTS.md).
 */
export const APPLICATION_PROJECT_TYPES = PROJECT_TYPES.filter((t) => t !== 'Guest Speaker' && t !== 'Other');

export const PROGRAMS = ['HBA', 'MBA', 'MSc', 'CEMS'] as const;

// ---------------------------------------------------------------------------
// Campaigns: Lauren's three purposes. Participant statuses reuse the Opportunity stages, as her
// request says ("The statuses above in Opportunities would be used for campaigns as well").
export const CAMPAIGN_PURPOSES = ['Project invitation', 'Partner renewal', 'Survey'] as const;
export const CAMPAIGN_PURPOSE_HINTS: Record<(typeof CAMPAIGN_PURPOSES)[number], string> = {
  'Project invitation': 'Inviting new corporate partners to participate in a project, event etc.',
  'Partner renewal': 'Renewing past corporate partners',
  Survey: 'Surveying after projects (both corporate partners and EIRs get surveys)',
};
/** Prototype field (not in Lauren's list): whether the campaign is still being worked. */
export const CAMPAIGN_STATES = ['Planning', 'Active', 'Closed'] as const;

// Project feedback
export const FEEDBACK_SOURCES = ['Corporate partner', 'Student team', 'EIR', 'EL office', 'Other'] as const;
export const FEEDBACK_FLAGS = ['Positive feedback', 'Needs review before future collaboration', 'Do not reuse'] as const;
export type FeedbackFlag = (typeof FEEDBACK_FLAGS)[number];
export const TERM_SEASONS = ['Fall', 'Winter', 'Summer'] as const;
