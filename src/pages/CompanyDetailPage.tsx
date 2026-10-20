import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { formatDate } from '../lib/dates';
import { byDueAsc, fullName } from '../lib/selectors';
import { Avatar, Button, Card, EmptyState, PageHeader, StatusBadge, inputClass } from '../components/ui';
import { Icon } from '../components/Icon';
import { ConfirmDialog, Modal } from '../components/Modal';
import { CompanyForm } from '../components/CompanyForm';
import { ContactForm } from '../components/ContactForm';
import { ActivityForm } from '../components/ActivityForm';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { FollowUpList } from '../components/FollowUpList';
import { TaskForm } from '../components/TaskForm';

export function CompanyDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { companyById, contacts, activities, tasks, updateCompany, deleteCompany } = useData();
  const { notify } = useToast();
  const [modal, setModal] = useState<'edit' | 'contact' | 'activity' | 'task' | 'delete' | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  const company = companyById.get(id);
  if (!company) {
    return (
      <Card>
        <EmptyState icon="building" title="Company not found" message="It may have been deleted." action={<Link to="/companies" className="text-sm font-medium text-ivey-700 hover:underline">Back to companies</Link>} />
      </Card>
    );
  }

  const people = contacts.filter((c) => c.companyId === id).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const history = activities.filter((a) => a.companyId === id);
  const openTasks = tasks.filter((t) => t.companyId === id && t.status === 'open').sort(byDueAsc);
  const doneCount = tasks.filter((t) => t.companyId === id && t.status === 'done').length;
  const close = () => setModal(null);

  async function saveNotes() {
    try {
      await updateCompany(id, { notes: notesDraft.trim() });
      setEditingNotes(false);
      notify('Relationship notes saved.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save notes.', 'error');
    }
  }

  async function handleDelete() {
    close();
    try {
      await deleteCompany(id);
      notify(`${company!.name} deleted.`);
      navigate('/companies');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete the company.', 'error');
    }
  }

  const hasLinks = people.length > 0 || history.length > 0 || tasks.some((t) => t.companyId === id);

  return (
    <>
      <PageHeader
        back={{ to: '/companies', label: 'Companies' }}
        title={<span className="flex flex-wrap items-center gap-3">{company.name}<StatusBadge status={company.status} /></span>}
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {company.industry && <span>{company.industry}</span>}
            {company.city && <span className="inline-flex items-center gap-1"><Icon name="mapPin" className="h-3.5 w-3.5" />{company.city}</span>}
            {company.website && <span className="inline-flex items-center gap-1"><Icon name="globe" className="h-3.5 w-3.5" />{company.website}</span>}
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
        <div className="space-y-6 xl:col-span-2">
          {company.description && (
            <Card title="About">
              <p className="text-sm text-neutral-700">{company.description}</p>
            </Card>
          )}

          <Card title={`Activity history (${history.length})`} action={<Button size="sm" variant="secondary" icon="plus" onClick={() => setModal('activity')}>Log activity</Button>}>
            <ActivityTimeline
              activities={history}
              hideCompany
              emptyState={
                <EmptyState compact icon="activity" title="No activity logged yet" message="Log an email, call, meeting or note to start this company's history."
                  action={<Button size="sm" icon="plus" onClick={() => setModal('activity')}>Log activity</Button>} />
              }
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={`Contacts (${people.length})`} action={<Button size="sm" variant="secondary" icon="plus" onClick={() => setModal('contact')}>Add contact</Button>}>
            {people.length === 0 ? (
              <EmptyState compact icon="users" title="No contacts yet" message="Add the people you work with at this organization." />
            ) : (
              <ul className="-my-1 divide-y divide-neutral-100">
                {people.map((p) => (
                  <li key={p.id}>
                    <Link to={`/contacts/${p.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-neutral-50">
                      <Avatar name={fullName(p)} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-neutral-900">{fullName(p)}</span>
                        <span className="block truncate text-xs text-neutral-600">{p.jobTitle || p.email || 'No title'}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Open follow-ups (${openTasks.length})`} action={<Button size="sm" variant="secondary" icon="plus" onClick={() => setModal('task')}>Add follow-up</Button>}>
            {openTasks.length === 0 ? (
              <p className="text-sm text-neutral-600">No open follow-ups for this company.</p>
            ) : (
              <FollowUpList tasks={openTasks} showCompany={false} />
            )}
            {doneCount > 0 && <p className="mt-4 text-xs text-neutral-500">{doneCount} completed follow-up{doneCount === 1 ? '' : 's'} not shown.</p>}
          </Card>

          <Card
            title="Relationship notes"
            action={!editingNotes && (
              <Button size="sm" variant="ghost" icon="pencil" onClick={() => { setNotesDraft(company.notes); setEditingNotes(true); }}>Edit</Button>
            )}
          >
            {editingNotes ? (
              <div>
                <label htmlFor="company-notes" className="sr-only">Relationship notes</label>
                <textarea id="company-notes" rows={6} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} className={inputClass} autoFocus />
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditingNotes(false)}>Cancel</Button>
                  <Button size="sm" onClick={saveNotes}>Save notes</Button>
                </div>
              </div>
            ) : company.notes ? (
              <p className="text-sm whitespace-pre-line text-neutral-700">{company.notes}</p>
            ) : (
              <p className="text-sm text-neutral-600">No notes yet. Use notes for lasting context such as preferences, timing and who decides.</p>
            )}
          </Card>

          <p className="px-1 text-xs text-neutral-500">Added {formatDate(company.createdAt)} · Last updated {formatDate(company.updatedAt)}</p>
        </div>
      </div>

      <Modal open={modal === 'edit'} onClose={close} title={`Edit ${company.name}`} size="lg">
        <CompanyForm company={company} onSaved={close} onCancel={close} />
      </Modal>
      <Modal open={modal === 'contact'} onClose={close} title="Add contact" description={`Linked to ${company.name}`} size="lg">
        <ContactForm defaultCompanyId={id} onSaved={close} onCancel={close} />
      </Modal>
      <Modal open={modal === 'activity'} onClose={close} title="Log activity" description={company.name} size="lg">
        <ActivityForm defaultCompanyId={id} onSaved={close} onCancel={close} />
      </Modal>
      <Modal open={modal === 'task'} onClose={close} title="Add follow-up" description={company.name} size="lg">
        <TaskForm defaultCompanyId={id} onSaved={close} onCancel={close} />
      </Modal>
      {hasLinks ? (
        <Modal open={modal === 'delete'} onClose={close} title="This company can't be deleted yet">
          <p className="text-sm text-neutral-700">
            {company.name} still has linked contacts, activities or follow-ups. Delete or move those first, so no relationship history is lost by accident.
          </p>
          <div className="-mx-6 mt-6 -mb-5 flex justify-end border-t border-neutral-100 bg-neutral-50 px-6 py-4">
            <Button variant="secondary" onClick={close}>OK</Button>
          </div>
        </Modal>
      ) : (
        <ConfirmDialog open={modal === 'delete'} title={`Delete ${company.name}?`} message="This permanently removes the company and its notes." confirmLabel="Delete company" onConfirm={handleDelete} onCancel={close} />
      )}
    </>
  );
}
