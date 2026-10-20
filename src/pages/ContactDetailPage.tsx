import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { formatDate } from '../lib/dates';
import { byDueAsc, fullName } from '../lib/selectors';
import { Avatar, Button, Card, Chips, EmptyState, PageHeader, PriorityBadge, ReviewNotice, StatusBadges } from '../components/ui';
import { CONTACT_ROLES, DO_NOT_CONTACT, PROJECT_TYPES, ALUMNI_OPTIONS, SOURCES, isKnown } from '../lib/options';
import { contactReviewIssues } from '../lib/review';
import { Icon, type IconName } from '../components/Icon';
import { ConfirmDialog, Modal } from '../components/Modal';
import { ContactForm } from '../components/ContactForm';
import { ActivityForm } from '../components/ActivityForm';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { FollowUpList } from '../components/FollowUpList';
import { TaskForm } from '../components/TaskForm';

function DetailRow({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
      <div className="min-w-0">
        <dt className="text-xs text-neutral-500">{label}</dt>
        <dd className="text-sm break-words text-neutral-900">{children}</dd>
      </div>
    </div>
  );
}

export function ContactDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { contactById, companyById, activities, tasks, deleteContact } = useData();
  const { notify } = useToast();
  const [modal, setModal] = useState<'edit' | 'activity' | 'task' | 'delete' | null>(null);
  const close = () => setModal(null);

  const contact = contactById.get(id);
  if (!contact) {
    return (
      <Card>
        <EmptyState icon="users" title="Contact not found" message="They may have been deleted." action={<Link to="/contacts" className="text-sm font-medium text-ivey-700 hover:underline">Back to contacts</Link>} />
      </Card>
    );
  }

  const name = fullName(contact);
  const company = contact.companyId ? companyById.get(contact.companyId) : undefined;
  const history = activities.filter((a) => a.contactId === id);
  const openTasks = tasks.filter((t) => t.contactId === id && t.status === 'open').sort(byDueAsc);
  const elsewhere = history.filter((a) => a.companyId !== contact.companyId).length;
  const notRecorded = <span className="text-neutral-500">Not recorded</span>;

  async function handleDelete() {
    close();
    try {
      await deleteContact(id);
      notify(`${name} deleted.`);
      navigate(company ? `/companies/${company.id}` : '/contacts');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete the contact.', 'error');
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/contacts', label: 'Contacts' }}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={name} size="lg" />
            <span>
              <span className="flex flex-wrap items-center gap-2.5">
                {name}
                {contact.priority && <PriorityBadge priority={contact.priority} />}
              </span>
              <span className="mt-0.5 block text-sm font-normal text-neutral-600">
                {contact.jobTitle || 'No title'}
                {company && (
                  <>
                    {' at '}
                    <Link to={`/companies/${company.id}`} className="font-medium text-ivey-700 hover:underline">{company.name}</Link>
                  </>
                )}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" icon="pencil" onClick={() => setModal('edit')}>Edit</Button>
            <Button variant="secondary" icon="trash" onClick={() => setModal('delete')}>Delete</Button>
            <Button icon="plus" onClick={() => setModal('activity')}>Log activity</Button>
          </>
        }
      />

      {contact.priority === DO_NOT_CONTACT && (
        <div role="note" className="mb-6 flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          <Icon name="alert" className="h-4 w-4 shrink-0 text-red-700" />
          {contact.firstName} is marked Do Not Contact. Check the relationship notes before any outreach.
        </div>
      )}
      <ReviewNotice issues={contactReviewIssues(contact)} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title={`Activity history (${history.length})`} action={<Button size="sm" variant="secondary" icon="plus" onClick={() => setModal('activity')}>Log activity</Button>}>
            <ActivityTimeline
              activities={history}
              hideContact
              emptyState={
                <EmptyState compact icon="activity" title={`No activity with ${contact.firstName} yet`} message="Log an email, call, meeting or note to start their history."
                  action={<Button size="sm" icon="plus" onClick={() => setModal('activity')}>Log activity</Button>} />
              }
            />
            {elsewhere > 0 && (
              <p className="mt-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                {elsewhere} of these {elsewhere === 1 ? 'was' : 'were'} logged with a different company than {contact.firstName}'s current one. Each activity keeps the company it happened with.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Contact details">
            <dl className="-my-2.5 divide-y divide-neutral-100">
              <DetailRow icon="mail" label="Email">{contact.email || notRecorded}</DetailRow>
              <DetailRow icon="phone" label="Work phone">{contact.workPhone || notRecorded}</DetailRow>
              <DetailRow icon="phone" label="Mobile">{contact.mobilePhone || notRecorded}</DetailRow>
              <DetailRow icon="globe" label="LinkedIn">
                {contact.linkedInUrl ? (
                  <a href={contact.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-ivey-700 hover:underline">{contact.linkedInUrl.replace(/^https?:\/\/(www\.)?/, '')}</a>
                ) : notRecorded}
              </DetailRow>
              <DetailRow icon="info" label="Preferred contact method">{contact.preferredContactMethod || notRecorded}</DetailRow>
              <DetailRow icon="building" label="Company">
                {company ? <Link to={`/companies/${company.id}`} className="text-ivey-700 hover:underline">{company.name}</Link> : <span className="text-neutral-500">No company</span>}
              </DetailRow>
            </dl>
          </Card>

          <Card title="Relationship" action={<Button size="sm" variant="ghost" icon="pencil" onClick={() => setModal('edit')}>Edit</Button>}>
            <dl className="-my-2.5 divide-y divide-neutral-100">
              <DetailRow icon="alert" label="Contact priority">{contact.priority ? <PriorityBadge priority={contact.priority} /> : notRecorded}</DetailRow>
              <DetailRow icon="check" label="Contact status">{contact.statuses.length ? <StatusBadges statuses={contact.statuses} /> : notRecorded}</DetailRow>
              <DetailRow icon="users" label="Contact role"><Chips values={contact.roles} known={CONTACT_ROLES} /></DetailRow>
              <DetailRow icon="activity" label="Source">
                {contact.source ? (
                  <span className={isKnown(SOURCES, contact.source) ? '' : 'text-amber-900'}>{contact.source}</span>
                ) : notRecorded}
              </DetailRow>
            </dl>
          </Card>

          <Card title="EL projects & alumni">
            <dl className="-my-2.5 divide-y divide-neutral-100">
              <DetailRow icon="task" label="EL project participation"><Chips values={contact.projectParticipation} known={PROJECT_TYPES} /></DetailRow>
              <DetailRow icon="calendar" label="Last project participated">{contact.lastProjectDate ? formatDate(contact.lastProjectDate) : notRecorded}</DetailRow>
              <DetailRow icon="note" label="Alumni"><Chips values={contact.alumniPrograms} known={ALUMNI_OPTIONS} /></DetailRow>
              <DetailRow icon="calendar" label="Graduation year">{contact.graduationYear ?? notRecorded}</DetailRow>
            </dl>
          </Card>

          <Card title={`Open follow-ups (${openTasks.length})`} action={<Button size="sm" variant="secondary" icon="plus" onClick={() => setModal('task')}>Add follow-up</Button>}>
            {openTasks.length === 0 ? <p className="text-sm text-neutral-600">No open follow-ups with {contact.firstName}.</p> : <FollowUpList tasks={openTasks} showContact={false} />}
          </Card>

          <Card title="Relationship notes" action={<Button size="sm" variant="ghost" icon="pencil" onClick={() => setModal('edit')}>Edit</Button>}>
            {contact.notes ? (
              <p className="text-sm whitespace-pre-line text-neutral-700">{contact.notes}</p>
            ) : (
              <p className="text-sm text-neutral-600">No notes yet.</p>
            )}
          </Card>

          <p className="px-1 text-xs text-neutral-500">Added {formatDate(contact.createdAt)} · Last updated {formatDate(contact.updatedAt)}</p>
        </div>
      </div>

      <Modal open={modal === 'edit'} onClose={close} title={`Edit ${name}`} size="xl">
        <ContactForm contact={contact} onSaved={close} onCancel={close} />
      </Modal>
      <Modal open={modal === 'activity'} onClose={close} title="Log activity" description={company ? `${name} · ${company.name}` : name} size="lg">
        <ActivityForm defaultContactId={id} onSaved={close} onCancel={close} />
      </Modal>
      <Modal open={modal === 'task'} onClose={close} title="Add follow-up" description={company ? `${name} · ${company.name}` : name} size="lg">
        <TaskForm defaultContactId={id} onSaved={close} onCancel={close} />
      </Modal>
      <ConfirmDialog
        open={modal === 'delete'}
        title={`Delete ${name}?`}
        message={
          history.length > 0
            ? `Their ${history.length} logged activit${history.length === 1 ? 'y stays' : 'ies stay'} on the company record, without a person attached.`
            : 'This permanently removes the contact.'
        }
        confirmLabel="Delete contact"
        onConfirm={handleDelete}
        onCancel={close}
      />
    </>
  );
}
