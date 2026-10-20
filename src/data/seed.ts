import { addDays, toDateString } from '../lib/dates';
import { NOT_ALUMNUS } from '../lib/options';
import { SCHEMA_VERSION, type Activity, type ActivityType, type Company, type Contact, type Database, type Task } from '../types';

// ALL DATA BELOW IS FICTIONAL. Organizations, people, emails (.example domains) and
// phone numbers (555-01xx), addresses and linkedin.example profiles are invented for
// prototype demonstration only. Nothing here comes from the reference files.
// Dates are generated relative to today so the dashboard always has realistic content.

export function createSampleDatabase(now = new Date()): Database {
  const created = addDays(now, -120).toISOString();

  const at = (dayOffset: number, hour: number, minute = 0): string => {
    const d = addDays(now, dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const day = (dayOffset: number): string => toDateString(addDays(now, dayOffset));

  type CompanySeed = Omit<Company, 'createdAt' | 'updatedAt' | 'notes' | 'address' | 'phone' | 'website'> & {
    notes?: string;
    street: string;
    city: string;
    province: string;
    postalCode: string;
    domain: string;
    phoneSuffix: string;
  };
  const company = ({ street, city, province, postalCode, domain, phoneSuffix, notes = '', ...rest }: CompanySeed): Company => ({
    ...rest,
    phone: `+1-519-555-01${phoneSuffix}`,
    website: domain,
    address: { street, city, province, postalCode, country: 'Canada' },
    notes,
    createdAt: created,
    updatedAt: created,
  });

  const companies: Company[] = [
    company({
      id: 'co-tallgrass',
      name: 'Tallgrass Analytics',
      industry: 'Technology',
      priority: 'High',
      statuses: ['Active Partner'],
      projectParticipation: ['MBA Ivey Field Project', 'MSc Hackathon'],
      lastProjectDate: day(-60),
      street: '120 Prairie Lane, Suite 400',
      city: 'Toronto',
      province: 'Ontario',
      postalCode: 'M5V 0A1',
      domain: 'tallgrass.example',
      phoneSuffix: '10',
      description: 'Mid-sized analytics consultancy. Has hosted two MSc field project teams.',
      notes: 'Prefers projects scoped around customer-retention modelling. Tamsin is the decision-maker; Marcus supervises the student team day to day.',
    }),
    company({
      id: 'co-harbourlight',
      name: 'Harbourlight Foods',
      industry: 'Consumer Products',
      priority: 'High',
      statuses: ['Active Partner', 'Outreach in Progress'],
      projectParticipation: ['HBA Ivey Field Project'],
      lastProjectDate: day(-200),
      street: '45 Mill Road',
      city: 'London',
      province: 'Ontario',
      postalCode: 'N6A 0A2',
      domain: 'harbourlight.example',
      phoneSuffix: '11',
      description: 'Regional food manufacturer exploring a national brand refresh.',
      notes: 'Budget approvals happen in their Q1 planning cycle. Raise winter-term projects by early November.',
    }),
    company({
      id: 'co-juniper',
      name: 'Juniper Health Collective',
      industry: 'Healthcare',
      priority: 'Medium',
      statuses: ['Outreach in Progress'],
      projectParticipation: [],
      lastProjectDate: '',
      street: '8 Orchard Crescent',
      city: 'Hamilton',
      province: 'Ontario',
      postalCode: 'L8P 0A3',
      domain: 'juniperhealth.example',
      phoneSuffix: '12',
      description: 'Network of community clinics interested in an operations-improvement project.',
    }),
    company({
      id: 'co-copperfield',
      name: 'Copperfield Renewables',
      industry: 'Energy/Resources',
      priority: 'Medium',
      statuses: ['Active Partner'],
      projectParticipation: ['Research Project', 'CEMS Business Project'],
      lastProjectDate: day(-30),
      street: '900 Sunrise Way',
      city: 'Calgary',
      province: 'Alberta',
      postalCode: 'T2P 0A4',
      domain: 'copperfield.example',
      phoneSuffix: '13',
      description: 'Solar and storage developer. Interested in market-entry research for Ontario.',
      notes: 'Remote-friendly. Happy to host virtual check-ins with the student team.',
    }),
    company({
      id: 'co-fernhill',
      name: 'Fernhill Credit Union',
      industry: 'Financial Services',
      priority: 'Low',
      statuses: ['Past Partner'],
      projectParticipation: ['IDIS Sprint'],
      lastProjectDate: day(-500),
      street: '3 Fernhill Plaza',
      city: 'Kitchener',
      province: 'Ontario',
      postalCode: 'N2G 0A5',
      domain: 'fernhill.example',
      phoneSuffix: '14',
      description: 'Member-owned credit union. Paused new partnerships during a leadership transition.',
      notes: 'Check back after their new CEO starts.',
    }),
    company({
      id: 'co-bluewater',
      name: 'Bluewater Freight Partners',
      industry: 'Transportation/Distribution/Logistics/Wholesale Trade',
      priority: 'Medium',
      statuses: ['Prospect'],
      projectParticipation: [],
      lastProjectDate: '',
      street: '77 Harbour Street',
      city: 'Windsor',
      province: 'Ontario',
      postalCode: 'N9A 0A6',
      domain: 'bluewaterfreight.example',
      phoneSuffix: '15',
      description: 'Cross-border freight operator. Met at a fictional alumni networking evening.',
    }),
    company({
      id: 'co-lanternworks',
      name: 'Lanternworks Studio',
      industry: 'Advertising (Marketing Services, Ad Agencies, Communications, Public Relations, Market Research)',
      priority: 'Low',
      statuses: ['Past Partner'],
      projectParticipation: ['New Venture Project'],
      lastProjectDate: day(-700),
      street: '210 Rue Lumière',
      city: 'Montréal',
      province: 'Quebec',
      postalCode: 'H2X 0A7',
      domain: 'lanternworks.example',
      phoneSuffix: '16',
      description: 'Creative agency that hosted a project two years ago.',
    }),
    company({
      id: 'co-granite',
      name: 'Granite Peak Advisory',
      industry: 'Consulting',
      priority: 'High',
      statuses: ['Active Partner'],
      projectParticipation: ['Guest Speaker', 'Action Learning Project', 'MBA Ivey Field Project'],
      lastProjectDate: day(-12),
      street: '1500 Summit Avenue',
      city: 'Vancouver',
      province: 'British Columbia',
      postalCode: 'V6C 0A8',
      domain: 'granitepeak.example',
      phoneSuffix: '17',
      description: 'Boutique strategy firm. Frequent guest speakers for experiential learning sessions.',
    }),
  ];

  type ContactSeed = Partial<Omit<Contact, 'id' | 'companyId' | 'firstName' | 'lastName' | 'jobTitle'>> & {
    id: string;
    companyId: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    domain: string;
    phoneSuffix: string;
    withMobile?: boolean;
  };
  const contact = ({ domain, phoneSuffix, withMobile, ...c }: ContactSeed): Contact => ({
    email: `${c.firstName}.${c.lastName}@${domain}`.toLowerCase(),
    workPhone: `+1-519-555-01${phoneSuffix}`,
    mobilePhone: withMobile ? `+1-226-555-01${phoneSuffix}` : '',
    linkedInUrl: `https://linkedin.example/in/${c.firstName}-${c.lastName}`.toLowerCase(),
    statuses: [],
    priority: '',
    roles: [],
    projectParticipation: [],
    lastProjectDate: '',
    preferredContactMethod: '',
    source: '',
    alumniPrograms: [],
    graduationYear: null,
    notes: '',
    ...c,
    createdAt: created,
    updatedAt: created,
  });

  const contacts: Contact[] = [
    contact({ id: 'ct-tamsin', companyId: 'co-tallgrass', firstName: 'Tamsin', lastName: 'Ruddock', jobTitle: 'Director of Partnerships', domain: 'tallgrass.example', phoneSuffix: '42', withMobile: true,
      statuses: ['Active Partner'], priority: 'High', roles: ['Primary Contact'], projectParticipation: ['MBA Ivey Field Project'], lastProjectDate: day(-60),
      preferredContactMethod: 'Email', source: 'Referral (from Corporate partners, Alumni or Faculty)', alumniPrograms: ['MBA'], graduationYear: 2011, notes: 'Prefers email over calls.' }),
    contact({ id: 'ct-marcus', companyId: 'co-tallgrass', firstName: 'Marcus', lastName: 'Bell', jobTitle: 'Analytics Lead', domain: 'tallgrass.example', phoneSuffix: '43',
      statuses: ['Active Partner'], priority: 'Medium', roles: ['Secondary Contact', 'Judge/Evaluator'], projectParticipation: ['MSc Hackathon'], lastProjectDate: day(-60),
      preferredContactMethod: 'LinkedIn', source: 'Business Development', alumniPrograms: ['MSc Business Analytics'], graduationYear: 2019 }),
    contact({ id: 'ct-ines', companyId: 'co-harbourlight', firstName: 'Ines', lastName: 'Valcourt', jobTitle: 'VP, People & Culture', domain: 'harbourlight.example', phoneSuffix: '17', withMobile: true,
      statuses: ['Active Partner'], priority: 'High', roles: ['Primary Contact', 'HR Lead'], projectParticipation: ['HBA Ivey Field Project'], lastProjectDate: day(-200),
      preferredContactMethod: 'Phone', source: 'Incoming interest', alumniPrograms: [NOT_ALUMNUS] }),
    contact({ id: 'ct-samuel', companyId: 'co-harbourlight', firstName: 'Samuel', lastName: 'Osei', jobTitle: 'Brand Manager', domain: 'harbourlight.example', phoneSuffix: '18',
      statuses: ['Outreach in Progress'], priority: 'Medium', roles: ['Secondary Contact'], preferredContactMethod: 'Email', source: 'Student Sourced', alumniPrograms: ['HBA'], graduationYear: 2016 }),
    contact({ id: 'ct-hana', companyId: 'co-juniper', firstName: 'Hana', lastName: 'Kobayashi', jobTitle: 'Chief Operating Officer', domain: 'juniperhealth.example', phoneSuffix: '61',
      statuses: ['Prospect', 'Outreach in Progress'], priority: 'High', roles: ['Primary Contact'], preferredContactMethod: 'In-Person', source: 'Business Development' }),
    contact({ id: 'ct-diego', companyId: 'co-copperfield', firstName: 'Diego', lastName: 'Alvarez', jobTitle: 'Head of Strategy', domain: 'copperfield.example', phoneSuffix: '24', withMobile: true,
      statuses: ['Active Partner'], priority: 'High', roles: ['Primary Contact', 'Guest Speaker'], projectParticipation: ['Research Project', 'CEMS Business Project'], lastProjectDate: day(-30),
      preferredContactMethod: 'Email', source: 'CEMS Global Office', alumniPrograms: ['CEMS'], graduationYear: 2014 }),
    contact({ id: 'ct-ruth', companyId: 'co-copperfield', firstName: 'Ruth', lastName: 'Campbell', jobTitle: 'Talent Acquisition Manager', domain: 'copperfield.example', phoneSuffix: '25',
      statuses: ['Active Partner'], priority: 'Low', roles: ['HR Lead'], preferredContactMethod: 'Email', source: 'Incoming interest' }),
    contact({ id: 'ct-omar', companyId: 'co-fernhill', firstName: 'Omar', lastName: 'Haddad', jobTitle: 'Director, Member Experience', domain: 'fernhill.example', phoneSuffix: '88',
      statuses: ['Past Partner'], priority: 'Low', roles: ['Primary Contact'], projectParticipation: ['IDIS Sprint'], lastProjectDate: day(-500),
      preferredContactMethod: 'Email', source: 'Business Development', alumniPrograms: ['Western'], graduationYear: 2005 }),
    contact({ id: 'ct-claire', companyId: 'co-bluewater', firstName: 'Claire', lastName: 'Lindqvist', jobTitle: 'Operations Manager', domain: 'bluewaterfreight.example', phoneSuffix: '36',
      statuses: ['Prospect'], priority: 'Medium', roles: ['Primary Contact'], preferredContactMethod: 'Phone', source: 'Referral (from Corporate partners, Alumni or Faculty)' }),
    contact({ id: 'ct-jonah', companyId: 'co-lanternworks', firstName: 'Jonah', lastName: 'Fields', jobTitle: 'Creative Director', domain: 'lanternworks.example', phoneSuffix: '70',
      statuses: ['Past Partner'], priority: 'Do Not Contact', roles: ['Other'], projectParticipation: ['New Venture Project'], lastProjectDate: day(-700),
      preferredContactMethod: 'Email', source: 'Student Sourced', notes: 'Asked not to be contacted about new projects until further notice.' }),
    contact({ id: 'ct-amira', companyId: 'co-granite', firstName: 'Amira', lastName: 'Nasser', jobTitle: 'Partner', domain: 'granitepeak.example', phoneSuffix: '53', withMobile: true,
      statuses: ['Active Partner'], priority: 'High', roles: ['Primary Contact', 'Guest Speaker', 'Executive in Residence'], projectParticipation: ['Guest Speaker', 'Action Learning Project'], lastProjectDate: day(-12),
      preferredContactMethod: 'LinkedIn', source: 'Referral (from Corporate partners, Alumni or Faculty)', alumniPrograms: ['HBA', 'MBA'], graduationYear: 2008, notes: 'Alumna. Enjoys mentoring student teams.' }),
    contact({ id: 'ct-ben', companyId: 'co-granite', firstName: 'Ben', lastName: 'Ashgrove', jobTitle: 'Senior Consultant', domain: 'granitepeak.example', phoneSuffix: '54',
      statuses: ['Active Partner'], priority: 'Medium', roles: ['Secondary Contact', 'Judge/Evaluator'], projectParticipation: ['MBA Ivey Field Project'], lastProjectDate: day(-90),
      preferredContactMethod: 'Email', source: 'Business Development', alumniPrograms: ['MSc International Business'], graduationYear: 2020 }),
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
    activity('ac-01', 'meeting', at(-2, 10), 'co-tallgrass', 'ct-tamsin', 'Winter project scoping meeting', 'Agreed on a churn-prediction project for the winter term. Tamsin will share an anonymized sample dataset.'),
    activity('ac-02', 'email', at(-1, 14, 30), 'co-harbourlight', 'ct-ines', 'Sent project proposal draft', 'Shared a two-page proposal outline for the brand refresh research project.'),
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
    activity('ac-13', 'meeting', at(5, 13), 'co-harbourlight', 'ct-ines', 'Proposal review with Harbourlight', 'Review proposal feedback and confirm winter-term timing.'),
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
    task('tk-02', 'Confirm NDA template with Tallgrass legal', -2, 'co-tallgrass', 'ct-tamsin'),
    task('tk-03', 'Follow up on proposal feedback', 3, 'co-harbourlight', 'ct-ines'),
    task('tk-04', 'Share student bios ahead of mentor matching', 7, 'co-granite', 'ct-ben'),
    task('tk-05', 'Book room for Copperfield final presentation', 12, 'co-copperfield', 'ct-diego'),
    task('tk-06', 'Reconnect after new CEO starts', 30, 'co-fernhill', 'ct-omar'),
    task('tk-07', 'Send thank-you note after scoping meeting', -1, 'co-tallgrass', 'ct-tamsin', 'done'),
    task('tk-08', 'Reply to Ruth about internship pipeline', -30, 'co-copperfield', 'ct-ruth', 'done'),
  ];

  return { schemaVersion: SCHEMA_VERSION, companies, contacts, activities, tasks };
}
