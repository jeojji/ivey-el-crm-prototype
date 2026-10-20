import { useState, type FormEvent } from 'react';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { addDays, daysFromToday, toDateString } from '../lib/dates';
import type { FieldErrors } from '../lib/validation';
import type { Task } from '../types';
import { FormErrorSummary, TextAreaField, TextField } from './ui';
import { LinkFields, useInitialLink } from './LinkFields';
import { ModalFooter } from './Modal';

type Field = 'title' | 'dueDate';

export const DUE_PRESETS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In 1 week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
];

export function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

export function dueDateHint(value: string): string | undefined {
  if (!isValidDateString(value)) return undefined;
  const diff = daysFromToday(value);
  if (diff < 0) return 'This date has passed, so the follow-up will show as overdue.';
  if (diff === 0) return 'Due today.';
  return undefined;
}

/** Quick due-date buttons shown under a date field. */
export function DuePresets({ onPick }: { onPick: (date: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {DUE_PRESETS.map((p) => (
        <button
          key={p.days}
          type="button"
          onClick={() => onPick(toDateString(addDays(new Date(), p.days)))}
          className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:border-ivey-600 hover:text-ivey-700"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function TaskForm({ task, defaultCompanyId, defaultContactId, defaultApplicationId, onSaved, onCancel }: {
  task?: Task;
  defaultCompanyId?: string;
  defaultContactId?: string;
  defaultApplicationId?: string;
  onSaved: (task: Task) => void;
  onCancel: () => void;
}) {
  const { createTask, updateTask } = useData();
  const { notify } = useToast();
  const initialLink = useInitialLink(
    task ? task.companyId : defaultCompanyId,
    task ? task.contactId : defaultContactId,
    task ? task.applicationId : defaultApplicationId,
  );

  const [title, setTitle] = useState(task?.title ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? toDateString(addDays(new Date(), 7)));
  const [link, setLink] = useState(initialLink);
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  function validate(): FieldErrors<Field> {
    const next: FieldErrors<Field> = {};
    if (!title.trim()) next.title = 'Describe what needs to happen, e.g. "Send proposal to Tamsin".';
    if (!isValidDateString(dueDate)) next.dueDate = 'Choose a due date.';
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
      dueDate,
      companyId: link.companyId || null,
      contactId: link.contactId || null,
      applicationId: link.applicationId || null,
      notes: notes.trim(),
    };
    try {
      const saved = task
        ? await updateTask(task.id, input)
        : await createTask({ ...input, status: 'open', completedAt: null });
      notify(task ? 'Follow-up updated.' : 'Follow-up created.');
      onSaved(saved);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save the follow-up.', 'error');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormErrorSummary show={attempted && Object.keys(errors).length > 0} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <TextField className="col-span-2" label="What needs to happen?" value={title} onChange={setTitle} required error={errors.title} autoFocus />
        <div className="col-span-2">
          <TextField label="Due date" type="date" value={dueDate} onChange={setDueDate} required error={errors.dueDate} hint={dueDateHint(dueDate)} />
          <DuePresets onPick={setDueDate} />
        </div>
        <LinkFields value={link} onChange={setLink} withApplication />
        <TextAreaField className="col-span-2" label="Notes" value={notes} onChange={setNotes} rows={3} placeholder="Context or details to remember" />
      </div>
      <ModalFooter onCancel={onCancel} submitLabel={task ? 'Save changes' : 'Create follow-up'} saving={saving} />
    </form>
  );
}
