import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { formatDate } from '../lib/dates';
import { byDueAsc, fullName } from '../lib/selectors';
import { Avatar, Button, Card, EmptyState, PageHeader } from '../components/ui';
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
              {name}
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
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Contact details">
            <dl className="-my-2.5 divide-y divide-neutral-100">
              <DetailRow icon="mail" label="Email">{contact.email || <span className="text-neutral-500">Not recorded</span>}</DetailRow>
              <DetailRow icon="phone" label="Phone">{contact.phone || <span className="text-neutral-500">Not recorded</span>}</DetailRow>
              <DetailRow icon="building" label="Company">
                {company ? <Link to={`/companies/${company.id}`} className="text-ivey-700 hover:underline">{company.name}</Link> : <span className="text-neutral-500">No company</span>}
              </DetailRow>
            </dl>
          </Card>

          <Card title={`Open follow-ups (${openTasks.length})`} action={<Button size="sm" variant="secondary" icon="plus" onClick={() => setModal('task')}>Add follow-up</Button>}>
            {openTasks.length === 0 ? <p className="text-sm text-neutral-600">No open follow-ups with {contact.firstName}.</p> : <FollowUpList tasks={openTasks} showCompany={false} showContact={false} />}
          </Card>

          <Card title="Notes" action={<Button size="sm" variant="ghost" icon="pencil" onClick={() => setModal('edit')}>Edit</Button>}>
            {contact.notes ? (
              <p className="text-sm whitespace-pre-line text-neutral-700">{contact.notes}</p>
            ) : (
              <p className="text-sm text-neutral-600">No notes yet.</p>
            )}
          </Card>

          <p className="px-1 text-xs text-neutral-500">Added {formatDate(contact.createdAt)} · Last updated {formatDate(contact.updatedAt)}</p>
        </div>
      </div>

      <Modal open={modal === 'edit'} onClose={close} title={`Edit ${name}`} size="lg">
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
