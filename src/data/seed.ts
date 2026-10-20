import { addDays, toDateString } from '../lib/dates';
import { NOT_ALUMNUS } from '../lib/options';
import { emailFingerprint } from '../lib/email';
import { SCHEMA_VERSION, type Activity, type ActivityType, type Application, type Campaign, type Company, type Contact, type Database, type Feedback, type Task } from '../types';

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

  // Which sample activities and follow-ups belong to which sample application.
  const applicationFor: Record<string, string> = {
    'ac-01': 'ap-tallgrass-churn', 'tk-02': 'ap-tallgrass-churn', 'tk-07': 'ap-tallgrass-churn',
    'ac-02': 'ap-harbourlight-brand', 'ac-13': 'ap-harbourlight-brand', 'tk-03': 'ap-harbourlight-brand',
    'ac-05': 'ap-juniper-ops', 'ac-12': 'ap-juniper-ops', 'ac-15': 'ap-juniper-ops',
    'ac-03': 'ap-copperfield-market', 'tk-05': 'ap-copperfield-market',
    'ac-07': 'ap-bluewater-logistics', 'tk-01': 'ap-bluewater-logistics',
    'ac-14': 'ap-granite-sprint', 'tk-04': 'ap-granite-sprint',
    'ac-04': 'ap-fernhill-member', 'tk-06': 'ap-fernhill-member',
  };

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
    applicationId: applicationFor[id] ?? null,
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
    // An email added through "Add email" (fictional): original text kept separately from notes.
    {
      ...activity('ac-15', 'email', at(-7, 16, 40), 'co-juniper', 'ct-hana', 'Re: Experiential learning projects', 'Hana is keen; wants to confirm team size before the exploratory meeting.'),
      source: 'email-intake',
      email: {
        direction: 'received',
        from: { name: 'Hana Kobayashi', email: 'hana.kobayashi@juniperhealth.example' },
        to: 'EL Office <el-office@business-school.example>',
        forwarded: false,
        originalSender: null,
        dateKnown: true,
        originalText: [
          'Hi,',
          '',
          'Thanks for the overview of the experiential learning program. We would like to explore a project on',
          'patient intake across our three clinics next summer.',
          '',
          'Could you let me know the usual student team size before we meet?',
          '',
          'Best,',
          'Hana Kobayashi',
          'Chief Operating Officer, Juniper Health Collective (fictional)',
        ].join('\n'),
        fingerprint: '',
      },
      editHistory: [],
    },
  ];
  // Fingerprints are computed, not hand-written.
  for (const a of activities) if (a.email) a.email.fingerprint = emailFingerprint(a.email.originalText);

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
    applicationId: applicationFor[id] ?? null,
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

  // Fictional sample applications (engagement opportunities). Stage history runs oldest → current.
  type AppSeed = Omit<Application, 'createdAt' | 'updatedAt' | 'stageHistory' | 'stage' | 'confirmationDeadline'> & {
    stages: [string, number][]; // [stage, day offset]
    deadline: number | null;
  };
  const application = ({ stages, deadline, ...a }: AppSeed): Application => ({
    ...a,
    stage: stages[stages.length - 1][0],
    confirmationDeadline: deadline === null ? '' : day(deadline),
    stageHistory: stages.map(([stage, offset]) => ({ stage, changedAt: at(offset, 9) })),
    createdAt: at(stages[0][1], 9),
    updatedAt: at(stages[stages.length - 1][1], 9),
  });

  const applications: Application[] = [
    application({
      id: 'ap-tallgrass-churn', title: 'Customer churn prediction', companyId: 'co-tallgrass', primaryContactId: 'ct-tamsin',
      projectType: 'MBA Ivey Field Project', program: 'MBA', termSeason: 'Winter', termYear: now.getFullYear() + 1,
      scope: 'Build a model that flags subscription customers likely to cancel, and recommend retention offers. Tallgrass will share an anonymized sample dataset.',
      notes: 'NDA template still to be confirmed with their legal team.',
      stages: [['Identifying', -45], ['Outreach Sent', -38], ['Application submitted', -20], ['Meeting completed', -2], ['Project Approved', -1]],
      deadline: 10,
    }),
    application({
      id: 'ap-tallgrass-pricing', title: 'Retail pricing hackathon challenge', companyId: 'co-tallgrass', primaryContactId: 'ct-marcus',
      projectType: 'MSc Hackathon', program: 'MSc', termSeason: 'Fall', termYear: now.getFullYear(),
      scope: 'One-weekend challenge on dynamic pricing for a fictional retailer.',
      notes: 'Team was fully booked for the fall. Marcus suggested trying again next year.',
      stages: [['Identifying', -90], ['Outreach Sent', -80], ['Declined', -60]],
      deadline: -65,
    }),
    application({
      id: 'ap-harbourlight-brand', title: 'National brand refresh research', companyId: 'co-harbourlight', primaryContactId: 'ct-ines',
      projectType: 'HBA Ivey Field Project', program: 'HBA', termSeason: 'Winter', termYear: now.getFullYear() + 1,
      scope: 'Consumer research and positioning options for taking a regional food brand national.',
      notes: 'Budget approval happens in their Q1 planning cycle.',
      stages: [['Identifying', -35], ['Outreach Sent', -30], ['Application submitted', -1]],
      deadline: 21,
    }),
    application({
      id: 'ap-juniper-ops', title: 'Clinic operations improvement', companyId: 'co-juniper', primaryContactId: 'ct-hana',
      projectType: 'Action Learning Project', program: 'MSc', termSeason: 'Summer', termYear: now.getFullYear() + 1,
      scope: 'Map patient intake across three clinics and identify bottlenecks.',
      notes: '',
      stages: [['Identifying', -12], ['Outreach Sent', -8]],
      deadline: 45,
    }),
    application({
      id: 'ap-copperfield-market', title: 'Ontario market-entry research', companyId: 'co-copperfield', primaryContactId: 'ct-diego',
      projectType: 'Research Project', program: 'CEMS', termSeason: 'Fall', termYear: now.getFullYear(),
      scope: 'Assess demand, regulation and partners for entering the Ontario solar and storage market.',
      notes: 'Diego would like the final presentation in person.',
      stages: [['Identifying', -150], ['Outreach Sent', -140], ['Application submitted', -120], ['Meeting completed', -110], ['Project Approved', -100], ['Team Confirmed', -70], ['Active', -45]],
      deadline: -75,
    }),
    application({
      id: 'ap-bluewater-logistics', title: 'Cross-border logistics analytics', companyId: 'co-bluewater', primaryContactId: 'ct-claire',
      projectType: 'Other Consulting Project', program: 'MSc', termSeason: 'Winter', termYear: now.getFullYear() + 1,
      scope: '',
      notes: 'Needs sign-off from their VP before we can share a scope.',
      stages: [['Identifying', -16]],
      deadline: 12,
    }),
    application({
      id: 'ap-granite-sprint', title: 'Strategy sprint with mentor matching', companyId: 'co-granite', primaryContactId: 'ct-ben',
      projectType: 'IDIS Sprint', program: 'MBA', termSeason: 'Winter', termYear: now.getFullYear() + 1,
      scope: 'Two-week strategy sprint for an incoming cohort, with Granite Peak consultants as mentors.',
      notes: '',
      stages: [['Identifying', -25], ['Outreach Sent', -22], ['Application submitted', -14], ['Meeting completed', -3]],
      deadline: 6,
    }),
    application({
      id: 'ap-fernhill-member', title: 'Member experience study', companyId: 'co-fernhill', primaryContactId: 'ct-omar',
      projectType: 'New Venture Project', program: 'HBA', termSeason: 'Fall', termYear: now.getFullYear() + 1,
      scope: 'Interview members about digital banking needs.',
      notes: 'Interested, but waiting for the new CEO to start.',
      stages: [['Identifying', -60], ['Outreach Sent', -50], ['Deferred', -6]],
      deadline: null,
    }),
    application({
      id: 'ap-lanternworks-brand', title: 'Brand storytelling venture', companyId: 'co-lanternworks', primaryContactId: 'ct-jonah',
      projectType: 'New Venture Project', program: 'HBA', termSeason: 'Winter', termYear: now.getFullYear() - 1,
      scope: 'Develop a launch story for a new studio service line.',
      notes: '',
      stages: [['Identifying', -720], ['Outreach Sent', -710], ['Application submitted', -690], ['Project Approved', -670], ['Team Confirmed', -650], ['Active', -620], ['Completed', -560]],
      deadline: -660,
    }),
  ];

  // Fictional campaigns. Participant statuses use the Opportunity stages, as Lauren asked.
  // Do Not Contact people (Jonah Fields) are never added.
  const participant = (id: string, contactId: string, companyId: string, history: [string, number][], notes = '') => ({
    id,
    contactId,
    companyId,
    status: history[history.length - 1][0],
    statusHistory: history.map(([status, d]) => ({ status, changedAt: at(d, 10) })),
    notes,
    addedAt: at(history[0][1], 10),
  });
  const term = now.getFullYear() + 1;
  const campaigns: Campaign[] = [
    {
      id: 'cp-winter-invite', name: `Winter ${term} field project invitations`, purpose: 'Project invitation',
      projectTypes: ['MBA Ivey Field Project', 'HBA Ivey Field Project'], termSeason: 'Winter', termYear: term,
      description: 'Invite prospective and active partners to host a winter field project team.', state: 'Active',
      templateSubject: 'Host a student team this {{term}}?',
      templateBody: 'Hi {{firstName}},\n\nWe are looking for partners to host {{projectTypes}} teams in {{term}}. Would {{companyName}} be interested in a short call to explore a project?\n\nBest regards,\nLauren\nExperiential Learning office',
      participants: [
        participant('pa-01', 'ct-hana', 'co-juniper', [['Identifying', -14], ['Outreach Sent', -8]]),
        participant('pa-02', 'ct-claire', 'co-bluewater', [['Identifying', -14]]),
        participant('pa-03', 'ct-ines', 'co-harbourlight', [['Identifying', -14], ['Outreach Sent', -10], ['Meeting completed', -3]], 'Interested; waiting on Q1 budget.'),
      ],
      createdAt: at(-15, 9), updatedAt: at(-3, 10),
    },
    {
      id: 'cp-renewal', name: 'Past partner renewal outreach', purpose: 'Partner renewal',
      projectTypes: [], termSeason: 'Fall', termYear: term, description: 'Reconnect with partners who have hosted projects before.', state: 'Planning',
      templateSubject: 'Working together again in {{term}}',
      templateBody: 'Hi {{firstName}},\n\nThank you again for partnering with us in the past. We would love to explore another project with {{companyName}} in {{term}}. Is there a good time to talk?\n\nBest regards,\nLauren',
      participants: [participant('pa-04', 'ct-omar', 'co-fernhill', [['Identifying', -6], ['Deferred', -6]], 'Waiting for their new CEO.')],
      createdAt: at(-6, 9), updatedAt: at(-6, 10),
    },
    {
      id: 'cp-survey', name: `Fall ${now.getFullYear()} project feedback survey`, purpose: 'Survey',
      projectTypes: ['Research Project', 'Action Learning Project'], termSeason: 'Fall', termYear: now.getFullYear(),
      description: 'Ask partners and EIRs for feedback after their projects.', state: 'Active',
      templateSubject: 'Two minutes of feedback on your {{term}} project?',
      templateBody: 'Hi {{firstName}},\n\nThank you for working with our students. Could you share a few thoughts on how the project went for {{companyName}}? Your feedback helps us improve future projects.\n\nThanks,\nLauren',
      participants: [
        participant('pa-05', 'ct-diego', 'co-copperfield', [['Identifying', -5], ['Outreach Sent', -4]]),
        participant('pa-06', 'ct-amira', 'co-granite', [['Identifying', -5], ['Outreach Sent', -4], ['Completed', -1]], 'EIR. Survey returned.'),
      ],
      createdAt: at(-5, 9), updatedAt: at(-1, 10),
    },
  ];

  // Fictional project feedback. Flags are set by hand and never decide eligibility on their own.
  const feedback: Feedback[] = [
    {
      id: 'fb-01', applicationId: 'ap-copperfield-market', applicationLabel: `Ontario market-entry research (Fall ${now.getFullYear()})`, companyId: 'co-copperfield',
      source: 'Corporate partner', givenBy: 'Diego Alvarez', receivedOn: day(-4),
      originalText: 'The student team’s mid-term presentation was clear and well researched. We would happily host another team next year.',
      outcome: 'In progress. Mid-term milestone met.', notes: '',
      flags: [{ flag: 'Positive feedback', flaggedAt: at(-4, 15), note: 'Mid-term presentation praised.' }],
      editHistory: [], createdAt: at(-4, 15), updatedAt: at(-4, 15),
    },
    {
      id: 'fb-02', applicationId: 'ap-lanternworks-brand', applicationLabel: `Brand storytelling venture (Winter ${now.getFullYear() - 1})`, companyId: 'co-lanternworks',
      source: 'Student team', givenBy: '', receivedOn: day(-555),
      originalText: 'The partner changed the brief twice and was hard to reach for several weeks. The final presentation went ahead but felt rushed.',
      outcome: 'Delivered, with scope changes mid-project.', notes: 'Discuss expectations up front if they apply again.',
      flags: [{ flag: 'Needs review before future collaboration', flaggedAt: at(-550, 11), note: 'Scope changed twice; slow responses.' }],
      editHistory: [], createdAt: at(-555, 11), updatedAt: at(-550, 11),
    },
  ];

  return { schemaVersion: SCHEMA_VERSION, companies, contacts, activities, tasks, applications, briefs: [], campaigns, feedback };
}
