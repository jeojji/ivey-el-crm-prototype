// Project feedback and manual flags. Flags are notes for Lauren: they never decide by themselves
// whether a company can take part again.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { formatDate, formatDateTime } from '../lib/dates';
import { FEEDBACK_FLAGS, FEEDBACK_SOURCES, type FeedbackFlag } from '../lib/options';
import { isValidIsoDate } from '../lib/validation';
import type { Feedback, FeedbackFlagEntry } from '../types';
import { Badge, SelectField, TextAreaField, TextField, inputClass } from './ui';
import { Icon } from './Icon';
import { ConfirmDialog, Modal, ModalFooter } from './Modal';

const FLAG_TONE: Record<FeedbackFlag, string> = {
  'Positive feedback': 'bg-ivey-50 text-ivey-800 ring-ivey-200',
  'Needs review before future collaboration': 'bg-amber-50 text-amber-900 ring-amber-300',
  'Do not reuse': 'bg-red-50 text-red-800 ring-red-300',
};

export function FlagBadge({ flag }: { flag: string }) {
  return (
    <Badge className={FLAG_TONE[flag as FeedbackFlag] ?? 'bg-neutral-100 text-neutral-700 ring-neutral-200'}>
      {flag !== 'Positive feedback' && <Icon name="alert" className="h-3 w-3" />}
      {flag}
    </Badge>
  );
}

export function FeedbackForm({ feedback, applicationId, companyId, applicationLabel, onDone }: {
  feedback?: Feedback;
  applicationId: string | null;
  companyId: string;
  applicationLabel: string;
  onDone: () => void;
}) {
  const data = useData();
  const { notify } = useToast();
  const [source, setSource] = useState(feedback?.source ?? 'Corporate partner');
  const [givenBy, setGivenBy] = useState(feedback?.givenBy ?? '');
  const [receivedOn, setReceivedOn] = useState(feedback?.receivedOn ?? '');
  const [originalText, setOriginalText] = useState(feedback?.originalText ?? '');
  const [outcome, setOutcome] = useState(feedback?.outcome ?? '');
  const [notes, setNotes] = useState(feedback?.notes ?? '');
  const [flags, setFlags] = useState<Record<string, { on: boolean; note: string; flaggedAt?: string }>>(() =>
    Object.fromEntries(FEEDBACK_FLAGS.map((f) => {
      const existing = feedback?.flags.find((x) => x.flag === f);
      return [f, { on: !!existing, note: existing?.note ?? '', flaggedAt: existing?.flaggedAt }];
    })),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!feedback && !originalText.trim()) return setError('Paste or type the feedback exactly as it was given.');
    if (!isValidIsoDate(receivedOn)) return setError('The date isn’t valid. Leave it blank if unknown.');
    if (receivedOn && receivedOn > new Date().toISOString().slice(0, 10)) return setError('The feedback date can’t be in the future.');
    setSaving(true);
    const now = new Date().toISOString();
    const flagList: FeedbackFlagEntry[] = FEEDBACK_FLAGS.filter((f) => flags[f].on).map((f) => ({ flag: f, note: flags[f].note.trim(), flaggedAt: flags[f].flaggedAt ?? now }));
    try {
      if (feedback) {
        await data.updateFeedback(feedback.id, { source, givenBy: givenBy.trim(), receivedOn, outcome: outcome.trim(), notes: notes.trim(), flags: flagList });
        notify('Feedback updated. The original text is unchanged.');
      } else {
        await data.createFeedback({ applicationId, applicationLabel, companyId, source, givenBy: givenBy.trim(), receivedOn, originalText, outcome: outcome.trim(), notes: notes.trim(), flags: flagList });
        notify('Feedback recorded.');
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the feedback.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && <p role="alert" className="mb-4 text-sm font-medium text-red-700">{error}</p>}
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-3">
        <SelectField label="From" value={source} onChange={setSource} options={FEEDBACK_SOURCES.map((s) => ({ value: s, label: s }))} />
        <TextField label="Given by (optional)" value={givenBy} onChange={setGivenBy} placeholder="Name, if known" />
        <TextField label="Received on" type="date" value={receivedOn} onChange={setReceivedOn} hint="Leave blank if unknown." />
        {feedback ? (
          <div className="sm:col-span-3">
            <p className="mb-1.5 text-sm font-medium text-neutral-800">Original feedback</p>
            <blockquote className="rounded-md bg-neutral-50 px-3 py-2 text-sm whitespace-pre-line text-neutral-800 ring-1 ring-neutral-200">{feedback.originalText}</blockquote>
            <p className="mt-1 text-xs text-neutral-500">Kept exactly as received. It can't be edited.</p>
          </div>
        ) : (
          <TextAreaField className="sm:col-span-3" label="Original feedback" value={originalText} onChange={setOriginalText} rows={5} required hint="Paste or type it exactly as given. It can't be edited later." />
        )}
        <TextField className="sm:col-span-3" label="Project outcome" value={outcome} onChange={setOutcome} placeholder="e.g. Delivered as planned, delivered with scope changes, not completed" />
        <TextAreaField className="sm:col-span-3" label="Your notes" value={notes} onChange={setNotes} rows={2} />
      </div>
      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-neutral-950">Flags (optional, set by you)</legend>
        <p className="mt-0.5 text-xs text-neutral-500">Flags show up when someone creates another application for this company. They're information only: the decision is always yours.</p>
        <div className="mt-3 space-y-2">
          {FEEDBACK_FLAGS.map((f) => (
            <div key={f} className="rounded-md border border-neutral-200 px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={flags[f].on} onChange={(e) => setFlags((x) => ({ ...x, [f]: { ...x[f], on: e.target.checked } }))} className="h-4 w-4 accent-ivey-700" />
                <FlagBadge flag={f} />
                {flags[f].flaggedAt && flags[f].on && <span className="text-xs text-neutral-500">set {formatDate(flags[f].flaggedAt!)}</span>}
              </label>
              {flags[f].on && (
                <input aria-label={`Reason for ${f}`} value={flags[f].note} onChange={(e) => setFlags((x) => ({ ...x, [f]: { ...x[f], note: e.target.value } }))} placeholder="Reason (optional)" className={`${inputClass} mt-2 py-1.5 text-xs`} />
              )}
            </div>
          ))}
        </div>
      </fieldset>
      <ModalFooter onCancel={onDone} submitLabel={feedback ? 'Save changes' : 'Record feedback'} saving={saving} />
    </form>
  );
}

const FIELD_NAMES: Record<string, string> = { source: 'From', givenBy: 'Given by', receivedOn: 'Received on', outcome: 'Outcome', notes: 'Notes', flags: 'Flags', applicationId: 'Application' };

export function FeedbackList({ items }: { items: Feedback[] }) {
  const data = useData();
  const { notify } = useToast();
  const [editing, setEditing] = useState<Feedback | null>(null);
  const [deleting, setDeleting] = useState<Feedback | null>(null);
  if (!items.length) return <p className="text-sm text-neutral-600">No feedback recorded yet.</p>;
  return (
    <>
      <ul className="space-y-4">
        {[...items].sort((a, b) => (b.receivedOn || b.createdAt).localeCompare(a.receivedOn || a.createdAt)).map((f) => (
          <li key={f.id} className="rounded-lg border border-neutral-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-medium text-neutral-900">
                {f.source}{f.givenBy ? ` · ${f.givenBy}` : ''} <span className="font-normal text-neutral-600">· {f.receivedOn ? formatDate(f.receivedOn) : 'date unknown'}</span>
              </p>
              <span className="flex gap-1">
                <button type="button" onClick={() => setEditing(f)} className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Edit feedback"><Icon name="pencil" className="h-4 w-4" /></button>
                <button type="button" onClick={() => setDeleting(f)} className="rounded p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-700" aria-label="Delete feedback"><Icon name="trash" className="h-4 w-4" /></button>
              </span>
            </div>
            {f.flags.length > 0 && (
              <ul className="mt-2 space-y-1">
                {f.flags.map((fl) => (
                  <li key={fl.flag} className="flex flex-wrap items-center gap-2 text-xs text-neutral-600"><FlagBadge flag={fl.flag} /> set {formatDate(fl.flaggedAt)}{fl.note && ` · ${fl.note}`}</li>
                ))}
              </ul>
            )}
            <blockquote className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm whitespace-pre-line text-neutral-800 ring-1 ring-neutral-200">{f.originalText}</blockquote>
            <p className="mt-1 text-xs text-neutral-500">Original feedback, as received</p>
            {f.outcome && <p className="mt-2 text-sm text-neutral-800"><span className="font-medium">Outcome:</span> {f.outcome}</p>}
            {f.notes && <p className="mt-1 text-sm text-neutral-700"><span className="font-medium">Notes:</span> {f.notes}</p>}
            {f.editHistory.length > 0 && (
              <details className="mt-2 text-xs text-neutral-600">
                <summary className="cursor-pointer">Edit history ({f.editHistory.length})</summary>
                <ul className="mt-1 space-y-0.5 pl-4">
                  {f.editHistory.map((h) => h.changes.map((c) => <li key={h.at + c.field}>{formatDateTime(h.at)}: {FIELD_NAMES[c.field] ?? c.field} “{c.from || '—'}” → “{c.to || '—'}”</li>))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit feedback" size="lg">
        {editing && <FeedbackForm feedback={editing} applicationId={editing.applicationId} companyId={editing.companyId} applicationLabel={editing.applicationLabel} onDone={() => setEditing(null)} />}
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        title="Delete this feedback?"
        message="The feedback, its original text and its flags are removed permanently. To change or clear a flag only, edit the feedback instead."
        confirmLabel="Delete feedback"
        onConfirm={async () => { const f = deleting!; setDeleting(null); await data.deleteFeedback(f.id); notify('Feedback deleted.'); }}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

/** Every flag recorded for a company, with the project and date behind it. */
export function CompanyFlags({ companyId, context }: { companyId: string; context: 'profile' | 'new-application' }) {
  const data = useData();
  const entries = data.feedback
    .filter((f) => f.companyId === companyId)
    .flatMap((f) => f.flags.map((fl) => ({ fl, f })))
    .sort((a, b) => b.fl.flaggedAt.localeCompare(a.fl.flaggedAt));
  if (!entries.length) return context === 'profile' ? <p className="text-sm text-neutral-600">No flags from project feedback.</p> : null;
  const serious = entries.some((e) => e.fl.flag !== 'Positive feedback');
  return (
    <div role={context === 'new-application' ? 'note' : undefined} className={context === 'new-application' ? `rounded-md border px-3 py-2.5 text-sm ${serious ? 'border-amber-300 bg-amber-50' : 'border-ivey-200 bg-ivey-50/60'}` : ''}>
      {context === 'new-application' && <p className="mb-1.5 font-semibold text-neutral-950">Feedback flags for this company</p>}
      <ul className="space-y-2">
        {entries.map(({ fl, f }) => {
          const app = f.applicationId ? data.applicationById.get(f.applicationId) : undefined;
          return (
            <li key={f.id + fl.flag} className="text-xs text-neutral-700">
              <span className="flex flex-wrap items-center gap-2">
                <FlagBadge flag={fl.flag} />
                {app ? <Link to={`/applications/${app.id}`} className="font-medium text-ivey-700 hover:underline">{f.applicationLabel || app.title}</Link> : <span className="font-medium">{f.applicationLabel || 'Project'}</span>}
                <span>· flagged {formatDate(fl.flaggedAt)}</span>
              </span>
              {fl.note && <span className="mt-0.5 block text-neutral-600">{fl.note}</span>}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-neutral-500">Flags are information from past projects. They don't decide whether the company can take part again. That decision is yours.</p>
    </div>
  );
}
