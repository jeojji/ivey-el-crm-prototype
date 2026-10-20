import { useState, type FormEvent } from 'react';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { addDays, fromDateTimeLocalValue, toDateString, toDateTimeLocalValue } from '../lib/dates';
import { ACTIVITY_LABELS } from '../lib/selectors';
import type { FieldErrors } from '../lib/validation';
import { ACTIVITY_TYPES, type Activity, type ActivityType } from '../types';
import { FormErrorSummary, TextAreaField, TextField } from './ui';
import { ActivityTypeIcon } from './ActivityTimeline';
import { LinkFields, useInitialLink } from './LinkFields';
import { DuePresets, dueDateHint, isValidDateString } from './TaskForm';
import { ModalFooter } from './Modal';

type Field = 'subject' | 'occurredAt' | 'link' | 'followUpTitle' | 'followUpDue';

export function ActivityForm({ activity, defaultCompanyId, defaultContactId, onSaved, onCancel }: {
  activity?: Activity;
  defaultCompanyId?: string;
  defaultContactId?: string;
  onSaved: (activity: Activity) => void;
  onCancel: () => void;
}) {
  const { createActivity, updateActivity, createTask } = useData();
  const { notify } = useToast();
  const initialLink = useInitialLink(activity ? activity.companyId : defaultCompanyId, activity ? activity.contactId : defaultContactId);

  const [type, setType] = useState<ActivityType>(activity?.type ?? 'meeting');
  const [subject, setSubject] = useState(activity?.subject ?? '');
  const [occurredAt, setOccurredAt] = useState(toDateTimeLocalValue(activity?.occurredAt ?? new Date().toISOString()));
  const [link, setLink] = useState(initialLink);
  const [details, setDetails] = useState(activity?.details ?? '');
  const [addFollowUp, setAddFollowUp] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDue, setFollowUpDue] = useState(toDateString(addDays(new Date(), 7)));
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  function validate(): FieldErrors<Field> {
    const next: FieldErrors<Field> = {};
    if (!subject.trim()) next.subject = 'Add a short subject, e.g. "Intro call with Tamsin".';
    if (!occurredAt || !fromDateTimeLocalValue(occurredAt)) next.occurredAt = 'Choose a date and time.';
    if (!link.companyId && !link.contactId) next.link = 'Link this activity to a company, a contact, or both.';
    if (addFollowUp) {
      if (!followUpTitle.trim()) next.followUpTitle = 'Describe the follow-up, or untick "Also create a follow-up".';
      if (!isValidDateString(followUpDue)) next.followUpDue = 'Choose a due date.';
    }
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
      type,
      subject: subject.trim(),
      details: details.trim(),
      occurredAt: fromDateTimeLocalValue(occurredAt)!,
      companyId: link.companyId || null,
      contactId: link.contactId || null,
    };
    try {
      const saved = activity ? await updateActivity(activity.id, input) : await createActivity({ ...input, source: 'manual' });
      if (addFollowUp) {
        await createTask({
          title: followUpTitle.trim(),
          dueDate: followUpDue,
          companyId: input.companyId,
          contactId: input.contactId,
          notes: `From ${ACTIVITY_LABELS[type].toLowerCase()}: ${input.subject}`,
          status: 'open',
          completedAt: null,
        });
      }
      const what = activity ? 'Activity updated' : `${ACTIVITY_LABELS[saved.type]} logged`;
      notify(addFollowUp ? `${what} and follow-up created.` : `${what}.`);
      onSaved(saved);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save the activity.', 'error');
      setSaving(false);
    }
  }

  const isFutureDate = (() => {
    const iso = fromDateTimeLocalValue(occurredAt);
    return iso ? new Date(iso).getTime() > Date.now() : false;
  })();

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormErrorSummary show={attempted && Object.keys(errors).length > 0} />

      <fieldset className="mb-5">
        <legend className="mb-1.5 text-sm font-medium text-neutral-800">Type</legend>
        <div className="grid grid-cols-4 gap-2">
          {ACTIVITY_TYPES.map((t) => (
            <label
              key={t}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ivey-600 ${
                type === t ? 'border-ivey-700 bg-ivey-50 text-ivey-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <input type="radio" name="activity-type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
              <ActivityTypeIcon type={t} bare />
              {ACTIVITY_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <TextField className="col-span-2" label="Subject" value={subject} onChange={setSubject} required error={errors.subject} autoFocus />
        <TextField
          className="col-span-2"
          label="Date and time"
          type="datetime-local"
          value={occurredAt}
          onChange={setOccurredAt}
          required
          error={errors.occurredAt}
          hint={
            isFutureDate
              ? type === 'meeting'
                ? 'This is in the future, so it will show as an upcoming meeting.'
                : 'This date is in the future.'
              : undefined
          }
        />
        <LinkFields value={link} onChange={setLink} error={errors.link} />
        <TextAreaField className="col-span-2" label="Details" value={details} onChange={setDetails} rows={5} placeholder="What was discussed, decisions, next steps" />
      </div>

      {!activity && (
        <div className={`mt-5 rounded-lg border p-4 ${addFollowUp ? 'border-ivey-200 bg-ivey-50/50' : 'border-neutral-200'}`}>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-neutral-900">
            <input
              type="checkbox"
              checked={addFollowUp}
              onChange={(e) => setAddFollowUp(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 accent-ivey-700"
            />
            Also create a follow-up
          </label>
          {addFollowUp && (
            <div className="mt-4 space-y-4">
              <TextField label="Follow-up" value={followUpTitle} onChange={setFollowUpTitle} required error={errors.followUpTitle} placeholder="e.g. Send revised proposal" />
              <div>
                <TextField label="Due date" type="date" value={followUpDue} onChange={setFollowUpDue} required error={errors.followUpDue} hint={dueDateHint(followUpDue)} />
                <DuePresets onPick={setFollowUpDue} />
              </div>
              <p className="text-xs text-neutral-600">Linked to the same company and contact as this activity.</p>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-neutral-500">
        Entered by hand. This prototype does not read your email or calendar.
      </p>
      <ModalFooter onCancel={onCancel} submitLabel={activity ? 'Save changes' : `Log ${ACTIVITY_LABELS[type].toLowerCase()}`} saving={saving} />
    </form>
  );
}
