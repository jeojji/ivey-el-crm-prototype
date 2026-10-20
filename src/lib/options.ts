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
