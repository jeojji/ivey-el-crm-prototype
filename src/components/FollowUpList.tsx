import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { formatDate, relativeDay, relativeFromIso } from '../lib/dates';
import { fullName, isOverdue } from '../lib/selectors';
import type { Task } from '../types';
import { Icon } from './Icon';
import { ConfirmDialog, Modal } from './Modal';
import { TaskForm } from './TaskForm';

/** Follow-ups in the order given, with complete / edit / delete on each row. */
export function FollowUpList({ tasks, showCompany = true, showContact = true }: {
  tasks: Task[];
  showCompany?: boolean;
  showContact?: boolean;
}) {
  return (
    <ul className="divide-y divide-neutral-100">
      {tasks.map((t) => (
        <FollowUpItem key={t.id} task={t} showCompany={showCompany} showContact={showContact} />
      ))}
    </ul>
  );
}

function FollowUpItem({ task, showCompany, showContact }: { task: Task; showCompany: boolean; showContact: boolean }) {
  const { companyById, contactById, setTaskDone, deleteTask } = useData();
  const { notify } = useToast();
  const [modal, setModal] = useState<'edit' | 'delete' | null>(null);
  const done = task.status === 'done';
  const overdue = isOverdue(task);
  const company = task.companyId ? companyById.get(task.companyId) : undefined;
  const contact = task.contactId ? contactById.get(task.contactId) : undefined;

  async function toggle() {
    try {
      await setTaskDone(task.id, !done);
      if (done) {
        notify('Follow-up reopened.');
      } else {
        notify('Follow-up completed.', 'success', {
          label: 'Undo',
          onClick: () => void setTaskDone(task.id, false),
        });
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update the follow-up.', 'error');
    }
  }

  async function handleDelete() {
    setModal(null);
    try {
      await deleteTask(task.id);
      notify('Follow-up deleted.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete the follow-up.', 'error');
    }
  }

  return (
    <li className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <input
        type="checkbox"
        checked={done}
        onChange={toggle}
        aria-label={done ? `Reopen "${task.title}"` : `Mark "${task.title}" as complete`}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-neutral-300 accent-ivey-700"
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setModal('edit')}
          className={`text-left text-sm font-medium hover:underline ${done ? 'text-neutral-500 line-through' : 'text-neutral-900'}`}
        >
          {task.title}
        </button>
        <p className="mt-0.5 text-xs text-neutral-600">
          {done ? (
            <span>Completed {task.completedAt ? relativeFromIso(task.completedAt).toLowerCase() : ''}</span>
          ) : (
            <span className={overdue ? 'font-semibold text-red-700' : ''}>
              {overdue && <Icon name="alert" className="mr-1 -mt-0.5 inline h-3.5 w-3.5" />}
              {overdue ? 'Overdue · ' : 'Due '}
              {relativeDay(task.dueDate).toLowerCase()} ({formatDate(task.dueDate)})
            </span>
          )}
          {showCompany && company && (
            <>
              {' · '}
              <Link to={`/companies/${company.id}`} className="font-medium text-ivey-700 hover:underline">{company.name}</Link>
            </>
          )}
          {showContact && contact && (
            <>
              {' · '}
              <Link to={`/contacts/${contact.id}`} className="font-medium text-ivey-700 hover:underline">{fullName(contact)}</Link>
            </>
          )}
        </p>
        {task.notes && <p className="mt-1 text-xs whitespace-pre-line text-neutral-600">{task.notes}</p>}
      </div>
      <div className="flex gap-1 opacity-70 group-hover:opacity-100 focus-within:opacity-100">
        <button type="button" onClick={() => setModal('edit')} className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" aria-label={`Edit "${task.title}"`}>
          <Icon name="pencil" className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setModal('delete')} className="rounded p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-700" aria-label={`Delete "${task.title}"`}>
          <Icon name="trash" className="h-4 w-4" />
        </button>
      </div>

      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Edit follow-up" size="lg">
        <TaskForm task={task} onSaved={() => setModal(null)} onCancel={() => setModal(null)} />
      </Modal>
      <ConfirmDialog
        open={modal === 'delete'}
        title="Delete this follow-up?"
        message={<>“{task.title}” will be permanently removed. To keep a record, mark it complete instead.</>}
        confirmLabel="Delete follow-up"
        onConfirm={handleDelete}
        onCancel={() => setModal(null)}
      />
    </li>
  );
}
