// Builds the numbered source pack (S1, S2, …) for a relationship brief from Lauren's selection,
// and checks a saved brief against the current records to see if it may be outdated.
// Records are only read here; nothing is modified.
import type { Brief, Database } from '../types';
import { MAX_PACK_CHARS, MAX_SOURCE_CHARS, MAX_SOURCES, type BriefSource } from '../ai/brief';
import { ACTIVITY_LABELS, fullName } from './selectors';
import { formatDate } from './dates';
import { termLabel } from './applications';

export interface BriefSelection {
  companyId: string | null;
  contactId: string | null;
  applicationId: string | null;
  activityIds: string[];
}

const line = (label: string, value: string | number | null | undefined) => (value === '' || value == null ? null : `${label}: ${value}`);
const join = (...lines: (string | null)[]) => lines.filter(Boolean).join('\n');
const clip = (text: string) => (text.length > MAX_SOURCE_CHARS ? `${text.slice(0, MAX_SOURCE_CHARS)}\n[…truncated]` : text);

export function buildSources(db: Database, sel: BriefSelection): { sources: BriefSource[]; truncated: boolean } {
  const out: Omit<BriefSource, 'id'>[] = [];
  const company = sel.companyId ? db.companies.find((c) => c.id === sel.companyId) : undefined;
  const contact = sel.contactId ? db.contacts.find((c) => c.id === sel.contactId) : undefined;
  const app = sel.applicationId ? db.applications.find((a) => a.id === sel.applicationId) : undefined;
  const companyName = (id: string | null) => (id ? db.companies.find((c) => c.id === id)?.name ?? '' : '');
  const contactName = (id: string | null) => {
    const c = id ? db.contacts.find((x) => x.id === id) : undefined;
    return c ? fullName(c) : '';
  };

  if (company) {
    out.push({
      kind: 'company',
      recordId: company.id,
      label: `Company record · ${company.name}`,
      updatedAt: company.updatedAt,
      text: join(
        line('Company', company.name),
        line('Partner status', company.statuses.join('; ')),
        line('Partnership priority', company.priority),
        line('Industry', company.industry),
        line('Project participation (past)', company.projectParticipation.join('; ')),
        line('Last project participated', company.lastProjectDate),
        line('About', company.description),
        line('Relationship notes', company.notes),
      ),
    });
  }
  if (contact) {
    out.push({
      kind: 'contact',
      recordId: contact.id,
      label: `Contact record · ${fullName(contact)}`,
      updatedAt: contact.updatedAt,
      text: join(
        line('Contact', fullName(contact)),
        line('Job title', contact.jobTitle),
        line('Company', companyName(contact.companyId)),
        line('Contact priority', contact.priority),
        line('Contact status', contact.statuses.join('; ')),
        line('Roles', contact.roles.join('; ')),
        line('Preferred contact method', contact.preferredContactMethod),
        line('Alumni', contact.alumniPrograms.join('; ')),
        line('Relationship notes', contact.notes),
      ),
    });
  }
  if (app) {
    out.push({
      kind: 'application',
      recordId: app.id,
      label: `Application · ${app.title}`,
      updatedAt: app.updatedAt,
      text: join(
        line('Application', app.title),
        line('Stage', app.stage),
        line('Stage history', app.stageHistory.map((h) => `${h.stage} (${h.changedAt.slice(0, 10)})`).join(' → ')),
        line('Project type', app.projectType),
        line('Program', app.program),
        line('Academic term', termLabel(app)),
        line('Participation confirmation deadline', app.confirmationDeadline),
        line('Primary contact', contactName(app.primaryContactId)),
        line('Scope', app.scope),
        line('Notes', app.notes),
      ),
    });
  }

  const chosen = db.activities.filter((a) => sel.activityIds.includes(a.id)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  for (const a of chosen) {
    const when = a.email && !a.email.dateKnown ? 'date unknown' : a.occurredAt.slice(0, 10);
    const who = contactName(a.contactId);
    out.push({
      kind: 'activity',
      recordId: a.id,
      label: `${ACTIVITY_LABELS[a.type]} · ${a.email && !a.email.dateKnown ? 'date unknown' : formatDate(a.occurredAt)}${a.subject ? ` · ${a.subject}` : ''}`,
      updatedAt: a.updatedAt,
      text: clip(
        join(
          `${ACTIVITY_LABELS[a.type]} on ${when}${who ? ` with ${who}` : ''}${a.companyId ? ` (${companyName(a.companyId)})` : ''}`,
          new Date(a.occurredAt).getTime() > Date.now() ? 'Status: scheduled (in the future)' : null,
          line('Subject', a.subject),
          a.email ? line('From', [a.email.from.name, a.email.from.email].filter(Boolean).join(' ')) : null,
          a.email?.originalSender ? line('Original sender', [a.email.originalSender.name, a.email.originalSender.email].filter(Boolean).join(' ')) : null,
          line('Lauren’s notes', a.details),
          a.email ? `Original email text:\n${a.email.originalText}` : null,
        ),
      ),
    });
  }

  // Open follow-ups Lauren has recorded for this company / contact / application.
  const tasks = db.tasks
    .filter((t) => t.status === 'open' && ((sel.applicationId && t.applicationId === sel.applicationId) || (sel.contactId && t.contactId === sel.contactId) || (sel.companyId && t.companyId === sel.companyId)))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);
  for (const t of tasks) {
    out.push({
      kind: 'task',
      recordId: t.id,
      label: `Open follow-up · due ${formatDate(t.dueDate)}`,
      updatedAt: t.updatedAt,
      text: join(`Open follow-up recorded by Lauren, due ${t.dueDate}: ${t.title}`, line('Notes', t.notes)),
    });
  }

  // Keep within the model's reading budget: records first, then the newest communications.
  let truncated = false;
  let list = out.slice(0, MAX_SOURCES);
  if (out.length > MAX_SOURCES) truncated = true;
  while (list.reduce((n, s) => n + s.text.length, 0) > MAX_PACK_CHARS && list.length > 1) {
    const idx = list.findIndex((s) => s.kind === 'activity');
    list = list.filter((_, i) => i !== (idx === -1 ? list.length - 1 : idx));
    truncated = true;
  }
  return { sources: list.map((s, i) => ({ ...s, id: `S${i + 1}` })), truncated };
}

export interface BriefFreshness {
  outdated: boolean;
  changed: { label: string; why: 'edited' | 'deleted' }[];
  /** Communications for the same company/contact/application added since, that weren't used. */
  newer: number;
}

export function briefFreshness(brief: Brief, db: Database): BriefFreshness {
  const lookup = {
    company: db.companies,
    contact: db.contacts,
    application: db.applications,
    activity: db.activities,
    task: db.tasks,
  } as const;
  const changed: BriefFreshness['changed'] = [];
  for (const s of brief.sources) {
    const current = (lookup[s.kind] as { id: string; updatedAt: string }[]).find((r) => r.id === s.recordId);
    if (!current) changed.push({ label: s.label, why: 'deleted' });
    else if (current.updatedAt !== s.updatedAt) changed.push({ label: s.label, why: 'edited' });
  }
  const used = new Set(brief.sources.map((s) => s.recordId));
  const newer = db.activities.filter(
    (a) =>
      !used.has(a.id) &&
      a.createdAt > brief.generatedAt &&
      ((brief.applicationId && a.applicationId === brief.applicationId) || (brief.contactId && a.contactId === brief.contactId) || (brief.companyId && a.companyId === brief.companyId)),
  ).length;
  return { outdated: changed.length > 0, changed, newer };
}
