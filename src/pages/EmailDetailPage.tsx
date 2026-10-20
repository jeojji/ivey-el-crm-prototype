import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TRACKED_ACTIVITY_FIELDS, useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { formatDateTime, fromDateTimeLocalValue, toDateTimeLocalValue } from '../lib/dates';
import { fullName } from '../lib/selectors';
import { findDuplicateEmails, firstAddress } from '../lib/email';
import { Badge, Button, Card, EmptyState, PageHeader, TextField, inputClass } from '../components/ui';
import { Icon } from '../components/Icon';
import { ConfirmDialog, Modal, ModalFooter } from '../components/Modal';
import { LinkFields, type Link as Links } from '../components/LinkFields';
import type { Activity, ActivityEdit } from '../types';
import { MoreActions } from '../components/Menu';

const FIELD_LABEL: Record<(typeof TRACKED_ACTIVITY_FIELDS)[number], string> = {
  subject: 'Subject',
  type: 'Type',
  occurredAt: 'Date',
  companyId: 'Company',
  contactId: 'Contact',
  applicationId: 'Application',
  details: 'Notes',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-neutral-900">{children}</dd>
    </div>
  );
}
const party = (p: { name: string; email: string } | null | undefined) =>
  p && (p.name || p.email) ? [p.name, p.email && `<${p.email}>`].filter(Boolean).join(' ') : <em className="text-neutral-500">not recorded</em>;

/** Edits subject, date and links. Every change is recorded in the edit history. */
function EditEmailForm({ activity, onDone }: { activity: Activity; onDone: () => void }) {
  const { updateActivity } = useData();
  const { notify } = useToast();
  const [subject, setSubject] = useState(activity.subject);
  const dateKnown = activity.email?.dateKnown ?? true;
  const [date, setDate] = useState(dateKnown ? toDateTimeLocalValue(activity.occurredAt) : '');
  const [links, setLinks] = useState<Links>({ companyId: activity.companyId ?? '', contactId: activity.contactId ?? '', applicationId: activity.applicationId ?? '' });
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const iso = date ? fromDateTimeLocalValue(date) : null;
    if (date && !iso) return setError('The date isn’t valid. Clear it if the date is unknown.');
    try {
      await updateActivity(activity.id, {
        subject: subject.trim(),
        occurredAt: iso ?? activity.occurredAt,
        companyId: links.companyId || null,
        contactId: links.contactId || null,
        applicationId: links.applicationId || null,
        ...(activity.email ? { email: { ...activity.email, dateKnown: iso ? true : activity.email.dateKnown && !!date } } : {}),
      });
      notify('Email updated. The change is recorded in its edit history.');
      onDone();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save.', 'error');
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && <p role="alert" className="mb-4 text-sm font-medium text-red-700">{error}</p>}
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        <TextField className="sm:col-span-2" label="Subject" value={subject} onChange={setSubject} />
        <TextField className="sm:col-span-2" label="Date and time sent" type="datetime-local" value={date} onChange={setDate} hint={dateKnown ? undefined : 'Currently unknown. Enter it if you find out.'} />
        <LinkFields value={links} onChange={setLinks} withApplication />
      </div>
      <p className="mt-4 text-xs text-neutral-500">The original message can't be edited. Correcting a link doesn't change the contact or company records themselves.</p>
      <ModalFooter onCancel={onDone} submitLabel="Save changes" />
    </form>
  );
}

export function EmailDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { activities, companyById, contactById, applicationById, database, updateActivity, deleteActivity } = useData();
  const { notify } = useToast();
  const [modal, setModal] = useState<'edit' | 'delete' | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  const activity = activities.find((a) => a.id === id);
  if (!activity || activity.type !== 'email') {
    return (
      <Card>
        <EmptyState icon="mail" title="Email not found" message="It may have been deleted." action={<Link to="/activity" className="text-sm font-medium text-ivey-700 hover:underline">Activity history</Link>} />
      </Card>
    );
  }

  const email = activity.email;
  const company = activity.companyId ? companyById.get(activity.companyId) : undefined;
  const contact = activity.contactId ? contactById.get(activity.contactId) : undefined;
  const application = activity.applicationId ? applicationById.get(activity.applicationId) : undefined;
  const others = { ...database, activities: database.activities.filter((a) => a.id !== id) };
  const duplicates = email
    ? findDuplicateEmails(others, {
        originalText: email.originalText,
        subject: activity.subject,
        occurredAt: activity.occurredAt,
        dateKnown: email.dateKnown,
        partnerEmail: email.originalSender?.email || (email.direction === 'received' ? email.from.email : firstAddress(email.to)),
        contactId: activity.contactId,
      })
    : [];

  const describe = (field: string, value: string) => {
    if (!value) return '(none)';
    if (field === 'companyId') return companyById.get(value)?.name ?? '(deleted company)';
    if (field === 'contactId') {
      const c = contactById.get(value);
      return c ? fullName(c) : '(deleted contact)';
    }
    if (field === 'applicationId') return applicationById.get(value)?.title ?? '(deleted application)';
    if (field === 'occurredAt') return formatDateTime(value);
    if (field === 'details') return value.length > 60 ? `${value.slice(0, 60)}…` : value;
    return value;
  };

  async function saveNotes() {
    try {
      await updateActivity(id, { details: notesDraft.trim() });
      setEditingNotes(false);
      notify('Notes saved.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save notes.', 'error');
    }
  }

  async function handleDelete() {
    setModal(null);
    await deleteActivity(id);
    notify('Email deleted.');
    navigate(company ? `/companies/${company.id}` : '/activity');
  }

  const history: ActivityEdit[] = [...(activity.editHistory ?? [])].reverse();

  return (
    <>
      <PageHeader
        back={{ to: '/activity', label: 'Activity history' }}
        title={<span className="flex flex-wrap items-center gap-3"><Icon name="mail" className="h-6 w-6 text-sky-700" />{activity.subject || <em className="font-normal text-neutral-500">(no subject)</em>}</span>}
        description={
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span>{email && !email.dateKnown ? `Date unknown (added ${formatDateTime(activity.createdAt)})` : formatDateTime(activity.occurredAt)}</span>
            {email && <Badge>{email.direction === 'received' ? 'Received' : 'Sent'}{email.forwarded ? ' · forwarded' : ''}</Badge>}
            {activity.source === 'email-intake' && <Badge className="bg-sky-50 text-sky-800 ring-sky-200">Added with “Add email”</Badge>}
          </span>
        }
        actions={
          <>
            <Button variant="secondary" icon="pencil" onClick={() => setModal('edit')}>Correct links or details</Button>
            <MoreActions items={[{ label: 'Delete email…', icon: 'trash', danger: true, onSelect: () => setModal('delete') }]} />
          </>
        }
      />

      {duplicates.length > 0 && (
        <div role="note" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Possible duplicate{duplicates.length === 1 ? '' : 's'}</p>
          <ul className="mt-1 list-disc pl-5">
            {duplicates.map((d) => (
              <li key={d.activity.id}>
                <Link to={d.activity.email ? `/emails/${d.activity.id}` : '/activity'} className="underline">{d.activity.subject || '(no subject)'}</Link> · {formatDateTime(d.activity.occurredAt)} · {d.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Original message">
            {email ? (
              <>
                <pre className="max-h-[32rem] overflow-auto rounded-md bg-neutral-50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-neutral-800">{email.originalText}</pre>
                <p className="mt-2 text-xs text-neutral-500">Preserved exactly as pasted. It can't be edited.</p>
              </>
            ) : (
              <p className="text-sm text-neutral-600">This email was logged manually, so there's no pasted original.</p>
            )}
          </Card>

          <Card
            title="Notes"
            action={!editingNotes && <Button size="sm" variant="ghost" icon="pencil" onClick={() => { setNotesDraft(activity.details); setEditingNotes(true); }}>Edit</Button>}
          >
            {editingNotes ? (
              <div>
                <label htmlFor="email-notes" className="sr-only">Notes</label>
                <textarea id="email-notes" rows={5} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} className={inputClass} autoFocus />
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditingNotes(false)}>Cancel</Button>
                  <Button size="sm" onClick={saveNotes}>Save notes</Button>
                </div>
              </div>
            ) : activity.details ? (
              <p className="text-sm whitespace-pre-line text-neutral-700">{activity.details}</p>
            ) : (
              <p className="text-sm text-neutral-600">No notes yet. Your notes are kept separate from the original message.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Linked to" action={<Button size="sm" variant="ghost" icon="pencil" onClick={() => setModal('edit')}>Correct</Button>}>
            <dl className="divide-y divide-neutral-100 text-sm">
              <Row label="Company">{company ? <Link to={`/companies/${company.id}`} className="text-ivey-700 hover:underline">{company.name}</Link> : <em className="text-neutral-500">none</em>}</Row>
              <Row label="Contact">{contact ? <Link to={`/contacts/${contact.id}`} className="text-ivey-700 hover:underline">{fullName(contact)}</Link> : <em className="text-neutral-500">none</em>}</Row>
              <Row label="Application">{application ? <Link to={`/applications/${application.id}`} className="text-ivey-700 hover:underline">{application.title}</Link> : <em className="text-neutral-500">none</em>}</Row>
            </dl>
          </Card>

          {email && (
            <Card title="Email details">
              <dl className="divide-y divide-neutral-100 text-sm">
                <Row label="From">{party(email.from)}</Row>
                <Row label="To">{email.to || <em className="text-neutral-500">not recorded</em>}</Row>
                {email.forwarded && <Row label="Original sender">{email.originalSender ? party(email.originalSender) : <em className="text-neutral-500">unknown</em>}</Row>}
                <Row label="Date">{email.dateKnown ? formatDateTime(activity.occurredAt) : <em className="text-neutral-500">unknown</em>}</Row>
                {email.aiAssist && (
                  <Row label="Local AI">Suggested {email.aiAssist.appliedFields.length} detail{email.aiAssist.appliedFields.length === 1 ? '' : 's'} with {email.aiAssist.model}, reviewed and confirmed before saving.</Row>
                )}
              </dl>
            </Card>
          )}

          <Card title="Edit history">
            {history.length === 0 ? (
              <p className="text-sm text-neutral-600">No edits since it was saved on {formatDateTime(activity.createdAt)}.</p>
            ) : (
              <ol className="space-y-3 text-sm">
                {history.map((h) => (
                  <li key={h.at}>
                    <p className="text-xs font-medium text-neutral-500">{formatDateTime(h.at)}</p>
                    <ul className="mt-0.5 space-y-0.5 text-neutral-800">
                      {h.changes.map((c) => (
                        <li key={c.field}>
                          {FIELD_LABEL[c.field as keyof typeof FIELD_LABEL] ?? c.field}: <span className="text-neutral-500 line-through">{describe(c.field, c.from)}</span> → {describe(c.field, c.to)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
                <li className="text-xs text-neutral-500">Saved {formatDateTime(activity.createdAt)}</li>
              </ol>
            )}
          </Card>
        </div>
      </div>

      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Correct links or details" size="lg">
        <EditEmailForm activity={activity} onDone={() => setModal(null)} />
      </Modal>
      <ConfirmDialog
        open={modal === 'delete'}
        title="Delete this email?"
        message="The email, its original message, notes and edit history are removed from every history. Linked companies, contacts and applications aren't affected. Any relationship brief that used it will show as possibly outdated."
        confirmLabel="Delete email"
        onConfirm={handleDelete}
        onCancel={() => setModal(null)}
      />
    </>
  );
}
