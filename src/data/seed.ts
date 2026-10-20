import { addDays, toDateString } from '../lib/dates';
import type { Activity, ActivityType, Company, Contact, Database, RelationshipStatus, Task } from '../types';

// ALL DATA BELOW IS FICTIONAL. Organizations, people, emails (.example domains) and
// phone numbers (555-01xx) are invented for prototype demonstration only.
// Dates are generated relative to today so the dashboard always has realistic content.

export function createSampleDatabase(now = new Date()): Database {
  const created = addDays(now, -120).toISOString();

  const at = (dayOffset: number, hour: number, minute = 0): string => {
    const d = addDays(now, dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const day = (dayOffset: number): string => toDateString(addDays(now, dayOffset));

  const company = (
    id: string,
    name: string,
    status: RelationshipStatus,
    industry: string,
    city: string,
    website: string,
    description: string,
    notes = '',
  ): Company => ({ id, name, status, industry, city, website, description, notes, createdAt: created, updatedAt: created });

  const companies: Company[] = [
    company(
      'co-tallgrass',
      'Tallgrass Analytics',
      'Active partner',
      'Data & analytics',
      'Toronto, ON',
      'tallgrass.example',
      'Mid-sized analytics consultancy. Has hosted two MSc field project teams.',
      'Prefers projects scoped around customer-retention modelling. Priya is the decision-maker; Marcus supervises the student team day to day.',
    ),
    company(
      'co-harbourlight',
      'Harbourlight Foods',
      'Active partner',
      'Consumer packaged goods',
      'London, ON',
      'harbourlight.example',
      'Regional food manufacturer exploring a national brand refresh.',
      'Budget approvals happen in their Q1 planning cycle. Raise winter-term projects by early November.',
    ),
    company(
      'co-juniper',
      'Juniper Health Collective',
      'Prospect',
      'Healthcare',
      'Hamilton, ON',
      'juniperhealth.example',
      'Network of community clinics interested in an operations-improvement project.',
    ),
    company(
      'co-copperfield',
      'Copperfield Renewables',
      'Active partner',
      'Energy',
      'Calgary, AB',
      'copperfield.example',
      'Solar and storage developer. Interested in market-entry research for Ontario.',
      'Remote-friendly. Happy to host virtual check-ins with the student team.',
    ),
    company(
      'co-fernhill',
      'Fernhill Credit Union',
      'On hold',
      'Financial services',
      'Kitchener, ON',
      'fernhill.example',
      'Member-owned credit union. Paused new partnerships during a leadership transition.',
      'Check back after their new CEO starts.',
    ),
    company(
      'co-bluewater',
      'Bluewater Freight Partners',
      'Prospect',
      'Logistics',
      'Windsor, ON',
      'bluewaterfreight.example',
      'Cross-border freight operator. Met at a fictional alumni networking evening.',
    ),
    company(
      'co-lanternworks',
      'Lanternworks Studio',
      'Past partner',
      'Media & design',
      'Montréal, QC',
      'lanternworks.example',
      'Creative agency that hosted a project two years ago.',
    ),
    company(
      'co-granite',
      'Granite Peak Advisory',
      'Active partner',
      'Management consulting',
      'Vancouver, BC',
      'granitepeak.example',
      'Boutique strategy firm. Frequent guest speakers for experiential learning sessions.',
    ),
  ];

  const contact = (
    id: string,
    companyId: string,
    firstName: string,
    lastName: string,
    jobTitle: string,
    phoneSuffix: string,
    domain: string,
    notes = '',
  ): Contact => ({
    id,
    companyId,
    firstName,
    lastName,
    jobTitle,
    email: `${firstName}.${lastName}@${domain}`.toLowerCase(),
    phone: `519-555-01${phoneSuffix}`,
    notes,
    createdAt: created,
    updatedAt: created,
  });

  const contacts: Contact[] = [
    contact('ct-priya', 'co-tallgrass', 'Priya', 'Raman', 'Director of Partnerships', '42', 'tallgrass.example', 'Prefers email over calls.'),
    contact('ct-marcus', 'co-tallgrass', 'Marcus', 'Bell', 'Analytics Lead', '43', 'tallgrass.example'),
    contact('ct-elena', 'co-harbourlight', 'Elena', 'Moreau', 'VP, People & Culture', '17', 'harbourlight.example'),
    contact('ct-samuel', 'co-harbourlight', 'Samuel', 'Osei', 'Brand Manager', '18', 'harbourlight.example'),
    contact('ct-hana', 'co-juniper', 'Hana', 'Kobayashi', 'Chief Operating Officer', '61', 'juniperhealth.example'),
    contact('ct-diego', 'co-copperfield', 'Diego', 'Alvarez', 'Head of Strategy', '24', 'copperfield.example'),
    contact('ct-ruth', 'co-copperfield', 'Ruth', 'Campbell', 'Talent Acquisition Manager', '25', 'copperfield.example'),
    contact('ct-omar', 'co-fernhill', 'Omar', 'Haddad', 'Director, Member Experience', '88', 'fernhill.example'),
    contact('ct-claire', 'co-bluewater', 'Claire', 'Dubois', 'Operations Manager', '36', 'bluewaterfreight.example'),
    contact('ct-jonah', 'co-lanternworks', 'Jonah', 'Fields', 'Creative Director', '70', 'lanternworks.example'),
    contact('ct-amira', 'co-granite', 'Amira', 'Nasser', 'Partner', '53', 'granitepeak.example', 'Alumna. Enjoys mentoring student teams.'),
    contact('ct-ben', 'co-granite', 'Ben', 'Tremblay', 'Senior Consultant', '54', 'granitepeak.example'),
  ];

  const activity = (
    id: string,
    type: ActivityType,
    occurredAt: string,
    companyId: string,
    contactId: string | null,
    subject: string,
    details: string,
  ): Activity => ({
    id,
    type,
    occurredAt,
    companyId,
    contactId,
    subject,
    details,
    source: 'sample',
    createdAt: created,
    updatedAt: created,
  });

  const activities: Activity[] = [
    activity('ac-01', 'meeting', at(-2, 10), 'co-tallgrass', 'ct-priya', 'Winter project scoping meeting', 'Agreed on a churn-prediction project for the winter term. Priya will share an anonymized sample dataset.'),
    activity('ac-02', 'email', at(-1, 14, 30), 'co-harbourlight', 'ct-elena', 'Sent project proposal draft', 'Shared a two-page proposal outline for the brand refresh research project.'),
    activity('ac-03', 'call', at(-4, 11), 'co-copperfield', 'ct-diego', 'Check-in on Ontario market research', 'Diego is happy with the mid-term findings. Wants a final presentation in person if possible.'),
    activity('ac-04', 'note', at(-6, 16), 'co-fernhill', null, 'Leadership transition update', 'Heard the new CEO starts next month. Hold off on outreach until then.'),
    activity('ac-05', 'email', at(-8, 9, 15), 'co-juniper', 'ct-hana', 'Introductory email', 'Introduced the experiential learning program and shared past project examples.'),
    activity('ac-06', 'meeting', at(-12, 13), 'co-granite', 'ct-amira', 'Guest speaker planning', 'Amira confirmed she will speak at the November session on client management.'),
    activity('ac-07', 'call', at(-15, 15), 'co-bluewater', 'ct-claire', 'Discovery call', 'Claire is interested but needs sign-off from their VP. Suggested a short one-pager.'),
    activity('ac-08', 'email', at(-20, 10), 'co-tallgrass', 'ct-marcus', 'Student team feedback', 'Marcus sent positive feedback on the fall team. Wants to host again.'),
    activity('ac-09', 'note', at(-25, 12), 'co-lanternworks', 'ct-jonah', 'Relationship status', 'Jonah moved into a new role. Studio may revisit partnership next year.'),
    activity('ac-10', 'meeting', at(-30, 14), 'co-harbourlight', 'ct-samuel', 'Brand team introduction', 'Met the brand team. Samuel would be the day-to-day project sponsor.'),
    activity('ac-11', 'email', at(-35, 9), 'co-copperfield', 'ct-ruth', 'Intern pipeline question', 'Ruth asked whether project students could be considered for summer internships.'),
    // Scheduled (future) meetings
    activity('ac-12', 'meeting', at(2, 10, 30), 'co-juniper', 'ct-hana', 'Exploratory meeting with Juniper', 'Walk through program timeline, student team size and confidentiality expectations.'),
    activity('ac-13', 'meeting', at(5, 13), 'co-harbourlight', 'ct-elena', 'Proposal review with Harbourlight', 'Review proposal feedback and confirm winter-term timing.'),
    activity('ac-14', 'meeting', at(9, 11), 'co-granite', 'ct-ben', 'Mentor matching session', 'Match Granite Peak mentors with the incoming cohort.'),
  ];

  const task = (
    id: string,
    title: string,
    dueOffset: number,
    companyId: string,
    contactId: string | null,
    status: 'open' | 'done' = 'open',
    notes = '',
  ): Task => ({
    id,
    title,
    dueDate: day(dueOffset),
    status,
    companyId,
    contactId,
    notes,
    completedAt: status === 'done' ? addDays(now, dueOffset).toISOString() : null,
    createdAt: created,
    updatedAt: created,
  });

  const tasks: Task[] = [
    task('tk-01', 'Send Bluewater a one-page program overview', -5, 'co-bluewater', 'ct-claire'),
    task('tk-02', 'Confirm NDA template with Tallgrass legal', -2, 'co-tallgrass', 'ct-priya'),
    task('tk-03', 'Follow up on proposal feedback', 3, 'co-harbourlight', 'ct-elena'),
    task('tk-04', 'Share student bios ahead of mentor matching', 7, 'co-granite', 'ct-ben'),
    task('tk-05', 'Book room for Copperfield final presentation', 12, 'co-copperfield', 'ct-diego'),
    task('tk-06', 'Reconnect after new CEO starts', 30, 'co-fernhill', 'ct-omar'),
    task('tk-07', 'Send thank-you note after scoping meeting', -1, 'co-tallgrass', 'ct-priya', 'done'),
    task('tk-08', 'Reply to Ruth about internship pipeline', -30, 'co-copperfield', 'ct-ruth', 'done'),
  ];

  return { schemaVersion: 1, companies, contacts, activities, tasks };
}
