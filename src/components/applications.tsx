// Shared pieces for applications (Lauren's engagement opportunities).
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { formatDate, relativeDay } from '../lib/dates';
import { deadlineState, termLabel, termOptions } from '../lib/applications';
import { APPLICATION_PROJECT_TYPES, APPLICATION_STAGES, DO_NOT_CONTACT, PROGRAMS, STAGE_MEANINGS, TERM_SEASONS, type ApplicationStage } from '../lib/options';
import { fullName } from '../lib/selectors';
import { isValidIsoDate, type FieldErrors } from '../lib/validation';
import type { Application } from '../types';
import { Badge, FormErrorSummary, FormSection, SelectField, TextAreaField, TextField, inputClass, picklist } from './ui';
import { Icon } from './Icon';
import { ModalFooter } from './Modal';
import { CompanyFlags } from './feedback';

const STAGE_TONE: Record<ApplicationStage, string> = {
  Identifying: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  'Outreach Sent': 'bg-sky-50 text-sky-800 ring-sky-200',
  'Application submitted': 'bg-violet-50 text-violet-800 ring-violet-200',
  'Meeting completed': 'bg-violet-50 text-violet-800 ring-violet-200',
  'Project Approved': 'bg-ivey-50 text-ivey-800 ring-ivey-200',
  'Team Confirmed': 'bg-ivey-100 text-ivey-900 ring-ivey-300',
  Active: 'bg-ivey-700 text-white ring-ivey-700',
  Completed: 'bg-neutral-800 text-white ring-neutral-800',
  Declined: 'bg-red-50 text-red-800 ring-red-200',
  Deferred: 'bg-amber-50 text-amber-900 ring-amber-300',
};

export function StageBadge({ stage }: { stage: string }) {
  const tone = STAGE_TONE[stage as ApplicationStage] ?? 'bg-amber-50 text-amber-900 ring-amber-300';
  return (
    <span title={STAGE_MEANINGS[stage as ApplicationStage] ?? 'Not one of the pipeline stages'}>
      <Badge className={tone}>{stage}</Badge>
    </span>
  );
}

/** Deadline text with urgency colour. Only highlighted while participation is unconfirmed. */
export function DeadlineText({ application, short = false }: { application: Application; short?: boolean }) {
  const state = deadlineState(application);
  if (state === 'none') return <span className="text-neutral-500">{short ? '—' : 'No deadline set'}</span>;
  const date = formatDate(application.confirmationDeadline);
  const rel = relativeDay(application.confirmationDeadline).toLowerCase();
  if (state === 'passed') return <span className="font-semibold text-red-700"><Icon name="alert" className="mr-1 -mt-0.5 inline h-3.5 w-3.5" />{short ? date : `Passed ${rel} (${date})`}</span>;
  if (state === 'soon') return <span className="font-semibold text-amber-800">{short ? date : `${rel[0].toUpperCase()}${rel.slice(1)} (${date})`}</span>;
  if (state === 'confirmed') return <span className="text-neutral-600" title="Participation already confirmed">{date}</span>;
  return <span className="text-neutral-700">{date}</span>;
}

/** Working stage-change control: a labelled select that saves immediately and is recorded in the stage history. */
export function StageSelect({ application, compact = false }: { application: Application; compact?: boolean }) {
  const { updateApplication } = useData();
  const { notify } = useToast();
  async function change(stage: string) {
    const previous = application.stage;
    try {
      await updateApplication(application.id, { stage });
      notify(`“${application.title}” moved to ${stage}.`, 'success', {
        label: 'Undo',
        onClick: () => void updateApplication(application.id, { stage: previous }),
      });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not change the stage.', 'error');
    }
  }
  return (
    <select
      aria-label={`Stage for ${application.title}`}
      value={application.stage}
      onChange={(e) => change(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={`${inputClass} ${compact ? 'py-1 text-xs' : ''}`}
    >
      {!(APPLICATION_STAGES as readonly string[]).includes(application.stage) && <option value={application.stage}>{application.stage}</option>}
      {APPLICATION_STAGES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

/** Compact list for company and contact profiles. */
export function ApplicationMiniList({ applications, showCompany = false }: { applications: Application[]; showCompany?: boolean }) {
  const { companyById } = useData();
  return (
    <ul className="-my-1 divide-y divide-neutral-100">
      {applications.map((a) => (
        <li key={a.id} className="py-2.5">
          <div className="flex items-start justify-between gap-2">
            <Link to={`/applications/${a.id}`} className="text-sm font-medium text-neutral-900 hover:text-ivey-700 hover:underline">{a.title}</Link>
            <StageBadge stage={a.stage} />
          </div>
          <p className="mt-0.5 text-xs text-neutral-600">
            {[showCompany ? companyById.get(a.companyId)?.name : null, a.projectType, termLabel(a)].filter(Boolean).join(' · ') || 'No details yet'}
          </p>
          {a.confirmationDeadline && (
            <p className="mt-0.5 text-xs text-neutral-600">Confirmation deadline: <DeadlineText application={a} /></p>
          )}
        </li>
      ))}
    </ul>
  );
}

type Field = 'title' | 'companyId' | 'term' | 'confirmationDeadline';

export function ApplicationForm({ application, defaultCompanyId, defaultContactId, onSaved, onCancel }: {
  application?: Application;
  defaultCompanyId?: string;
  defaultContactId?: string;
  onSaved: (a: Application) => void;
  onCancel: () => void;
}) {
  const { companies, contacts, contactById, companyById, createApplication, updateApplication } = useData();
  const { notify } = useToast();
  const startCompany = application?.companyId ?? defaultCompanyId ?? (defaultContactId ? contactById.get(defaultContactId)?.companyId : '') ?? '';
  const [title, setTitle] = useState(application?.title ?? '');
  const [companyId, setCompanyId] = useState(startCompany);
  const [primaryContactId, setPrimaryContactId] = useState(application?.primaryContactId ?? defaultContactId ?? '');
  const [projectType, setProjectType] = useState(application?.projectType ?? '');
  const [program, setProgram] = useState(application?.program ?? '');
  const [termSeason, setTermSeason] = useState(application?.termSeason ?? '');
  const [termYear, setTermYear] = useState(application?.termYear ? String(application.termYear) : '');
  const [confirmationDeadline, setConfirmationDeadline] = useState(application?.confirmationDeadline ?? '');
  const [stage, setStage] = useState(application?.stage ?? 'Identifying');
  const [scope, setScope] = useState(application?.scope ?? '');
  const [notes, setNotes] = useState(application?.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  function changeCompany(id: string) {
    setCompanyId(id);
    const person = contactById.get(primaryContactId);
    if (person && person.companyId !== id && primaryContactId !== application?.primaryContactId) setPrimaryContactId('');
  }

  function validate(): FieldErrors<Field> {
    const next: FieldErrors<Field> = {};
    if (!title.trim()) next.title = 'Give the application a short title, e.g. "Customer churn prediction".';
    if (!companyId) next.companyId = 'Choose the company this opportunity is with.';
    if (Boolean(termSeason) !== Boolean(termYear)) next.term = 'Choose both the term and the year, or neither.';
    if (!isValidIsoDate(confirmationDeadline)) next.confirmationDeadline = 'Choose a valid date.';
    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    const input = {
      title: title.trim(),
      companyId,
      primaryContactId: primaryContactId || null,
      projectType,
      program,
      termSeason,
      termYear: termYear ? Number(termYear) : null,
      confirmationDeadline,
      stage,
      scope: scope.trim(),
      notes: notes.trim(),
    };
    try {
      const saved = application ? await updateApplication(application.id, input) : await createApplication(input);
      notify(application ? `Saved changes to “${saved.title}”.` : `Application “${saved.title}” added.`);
      onSaved(saved);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save the application.', 'error');
      setSaving(false);
    }
  }

  // Contacts at the chosen company, plus the current primary contact even if they've moved.
  const contactChoices = contacts
    .filter((c) => c.companyId === companyId || c.id === primaryContactId)
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const chosen = contactById.get(primaryContactId);
  const years = termOptions();
  if (termYear && !years.includes(Number(termYear))) years.push(Number(termYear));

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormErrorSummary show={attempted && Object.keys(errors).length > 0} />
      <div className="space-y-6">
        <FormSection title="Basics">
          <TextField className="sm:col-span-2" label="Title" value={title} onChange={setTitle} required error={errors.title} autoFocus placeholder="e.g. Customer churn prediction" />
          <SelectField
            label="Company"
            value={companyId}
            onChange={changeCompany}
            required
            error={errors.companyId}
            options={[{ value: '', label: 'Choose a company' }, ...[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name }))]}
          />
          <SelectField
            label="Primary contact"
            value={primaryContactId}
            onChange={setPrimaryContactId}
            options={[
              { value: '', label: companyId ? (contactChoices.length ? 'Not set' : 'No contacts at this company') : 'Choose a company first' },
              ...contactChoices.map((c) => ({
                value: c.id,
                label: `${fullName(c)}${c.companyId !== companyId ? ` (now at ${c.companyId ? companyById.get(c.companyId)?.name : 'no company'})` : ''}`,
              })),
            ]}
            hint={chosen?.priority === DO_NOT_CONTACT ? `${fullName(chosen)} is marked Do Not Contact.` : 'Who you are negotiating with.'}
          />
          {!application && companyId && (
            <div className="sm:col-span-2">
              <CompanyFlags companyId={companyId} context="new-application" />
            </div>
          )}
          <SelectField label="Project type" value={projectType} onChange={setProjectType} options={picklist(APPLICATION_PROJECT_TYPES)} />
          <SelectField label="Program" value={program} onChange={setProgram} options={picklist(PROGRAMS)} />
        </FormSection>

        <FormSection title="Timing and stage">
          <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-800" id="term-label">Academic term</p>
            <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="term-label">
              <select aria-label="Term" value={termSeason} onChange={(e) => setTermSeason(e.target.value)} aria-invalid={errors.term ? true : undefined} className={inputClass}>
                <option value="">Term</option>
                {TERM_SEASONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select aria-label="Year" value={termYear} onChange={(e) => setTermYear(e.target.value)} aria-invalid={errors.term ? true : undefined} className={inputClass}>
                <option value="">Year</option>
                {years.sort().map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {errors.term && <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-700"><Icon name="alert" className="h-3.5 w-3.5" />{errors.term}</p>}
          </div>
          <TextField
            label="Participation confirmation deadline"
            type="date"
            value={confirmationDeadline}
            onChange={setConfirmationDeadline}
            error={errors.confirmationDeadline}
            hint="The date the partner must confirm participation by (Salesforce “Close Date”)."
          />
          <SelectField
            className="sm:col-span-2"
            label="Stage"
            value={stage}
            onChange={setStage}
            options={APPLICATION_STAGES.map((s) => ({ value: s, label: `${s}: ${STAGE_MEANINGS[s]}` }))}
            hint="Separate from the company's partner status and the contact's status."
          />
        </FormSection>

        <FormSection title="Scope and notes">
          <TextAreaField className="sm:col-span-2" label="Scope / description" value={scope} onChange={setScope} rows={4} placeholder="What the partner wants the students to work on" />
          <TextAreaField className="sm:col-span-2" label="Notes" value={notes} onChange={setNotes} rows={3} placeholder="Anything else to remember about this opportunity" />
        </FormSection>
      </div>
      <ModalFooter onCancel={onCancel} submitLabel={application ? 'Save changes' : 'Add application'} saving={saving} />
    </form>
  );
}
