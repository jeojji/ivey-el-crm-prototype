import { useState, type FormEvent } from 'react';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import {
  ALUMNI_OPTIONS,
  CONTACT_PRIORITIES,
  CONTACT_ROLES,
  DO_NOT_CONTACT,
  NOT_ALUMNUS,
  PARTNER_STATUSES,
  PREFERRED_CONTACT_METHODS,
  PROJECT_TYPES,
  SOURCES,
} from '../lib/options';
import { isValidEmail, isValidIsoDate, isValidPhone, isValidUrl, type FieldErrors } from '../lib/validation';
import { fullName } from '../lib/selectors';
import type { Contact } from '../types';
import { CheckboxGroupField, FormErrorSummary, FormSection, SelectField, TextAreaField, TextField, picklist } from './ui';
import { Icon } from './Icon';
import { ModalFooter } from './Modal';

type Field = 'firstName' | 'lastName' | 'email' | 'workPhone' | 'mobilePhone' | 'linkedInUrl' | 'lastProjectDate' | 'graduationYear';

export function ContactForm({ contact, defaultCompanyId, onSaved, onCancel }: {
  contact?: Contact;
  defaultCompanyId?: string;
  onSaved: (contact: Contact) => void;
  onCancel: () => void;
}) {
  const { companies, contacts, tasks, activities, companyById, createContact, updateContact } = useData();
  const { notify } = useToast();
  const [firstName, setFirstName] = useState(contact?.firstName ?? '');
  const [lastName, setLastName] = useState(contact?.lastName ?? '');
  const [companyId, setCompanyId] = useState(contact?.companyId ?? defaultCompanyId ?? '');
  const [jobTitle, setJobTitle] = useState(contact?.jobTitle ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [workPhone, setWorkPhone] = useState(contact?.workPhone ?? '');
  const [mobilePhone, setMobilePhone] = useState(contact?.mobilePhone ?? '');
  const [linkedInUrl, setLinkedInUrl] = useState(contact?.linkedInUrl ?? '');
  const [preferredContactMethod, setPreferredContactMethod] = useState(contact?.preferredContactMethod ?? '');
  const [statuses, setStatuses] = useState<string[]>(contact?.statuses ?? []);
  const [priority, setPriority] = useState(contact?.priority ?? '');
  const [roles, setRoles] = useState<string[]>(contact?.roles ?? []);
  const [source, setSource] = useState(contact?.source ?? '');
  const [projects, setProjects] = useState<string[]>(contact?.projectParticipation ?? []);
  const [lastProjectDate, setLastProjectDate] = useState(contact?.lastProjectDate ?? '');
  const [alumniPrograms, setAlumniPrograms] = useState<string[]>(contact?.alumniPrograms ?? []);
  const [graduationYear, setGraduationYear] = useState(contact?.graduationYear ? String(contact.graduationYear) : '');
  const [notes, setNotes] = useState(contact?.notes ?? '');
  const [moveOpenTasks, setMoveOpenTasks] = useState(true);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const oldCompanyId = contact?.companyId ?? null;
  const companyChanged = !!contact && (companyId || null) !== oldCompanyId;
  const oldCompany = oldCompanyId ? companyById.get(oldCompanyId) : undefined;
  const newCompany = companyId ? companyById.get(companyId) : undefined;
  const movableTasks = contact ? tasks.filter((t) => t.contactId === contact.id && t.status === 'open' && t.companyId === oldCompanyId) : [];
  const pastActivityCount = contact ? activities.filter((a) => a.contactId === contact.id).length : 0;

  function validate(): FieldErrors<Field> {
    const next: FieldErrors<Field> = {};
    if (!firstName.trim()) next.firstName = 'First name is required.';
    if (!lastName.trim()) next.lastName = 'Last name is required.';
    const e = email.trim().toLowerCase();
    if (e && !isValidEmail(e)) next.email = 'Enter a valid email address, like name@example.com.';
    else if (e) {
      const dup = contacts.find((c) => c.id !== contact?.id && c.email.toLowerCase() === e);
      if (dup) next.email = `${fullName(dup)} already uses this email address.`;
    }
    if (!isValidPhone(workPhone)) next.workPhone = 'Enter a phone number, e.g. +1-519-555-0100.';
    if (!isValidPhone(mobilePhone)) next.mobilePhone = 'Enter a phone number, e.g. +1-519-555-0100.';
    if (!isValidUrl(linkedInUrl)) next.linkedInUrl = 'Enter the full address, starting with https://';
    if (!isValidIsoDate(lastProjectDate)) next.lastProjectDate = 'Choose a valid date.';
    const year = graduationYear.trim();
    if (year) {
      const n = Number(year);
      const maxYear = new Date().getFullYear() + 6;
      if (!/^\d{4}$/.test(year) || n < 1920 || n > maxYear) next.graduationYear = `Enter a 4-digit year between 1920 and ${maxYear}.`;
      else if (!alumniPrograms.some((p) => p !== NOT_ALUMNUS)) next.graduationYear = 'Graduation year is for alumni. Select an alumni program, or clear the year.';
    }
    return next;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setAttempted(true);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    const input = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      companyId: companyId || null,
      jobTitle: jobTitle.trim(),
      email: email.trim().toLowerCase(),
      workPhone: workPhone.trim(),
      mobilePhone: mobilePhone.trim(),
      linkedInUrl: linkedInUrl.trim(),
      preferredContactMethod,
      statuses,
      priority,
      roles,
      source,
      projectParticipation: projects,
      lastProjectDate,
      alumniPrograms,
      graduationYear: graduationYear.trim() ? Number(graduationYear) : null,
      notes: notes.trim(),
    };
    try {
      const saved = contact ? await updateContact(contact.id, input, { moveOpenTasks }) : await createContact(input);
      let message = contact ? `Saved changes to ${fullName(saved)}.` : `${fullName(saved)} added.`;
      if (companyChanged && movableTasks.length) {
        message += moveOpenTasks
          ? ` ${movableTasks.length} open follow-up${movableTasks.length === 1 ? '' : 's'} moved to ${newCompany?.name ?? 'no company'}.`
          : ` Open follow-ups stayed with ${oldCompany?.name ?? 'no company'}.`;
      }
      notify(message);
      onSaved(saved);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save the contact.', 'error');
      setSaving(false);
    }
  }

  const companyOptions = [
    { value: '', label: 'No company' },
    ...[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormErrorSummary show={attempted && Object.keys(errors).length > 0} />
      <div className="space-y-6">
        <FormSection title="Basics">
          <TextField label="First name" value={firstName} onChange={setFirstName} required error={errors.firstName} autoFocus />
          <TextField label="Last name" value={lastName} onChange={setLastName} required error={errors.lastName} />
          <SelectField label="Company" value={companyId} onChange={setCompanyId} options={companyOptions} />
          <TextField label="Job title" value={jobTitle} onChange={setJobTitle} placeholder="e.g. Director" />
          {companyChanged && (
            <div className="rounded-lg border border-ivey-200 bg-ivey-50/60 p-4 text-sm text-neutral-800 sm:col-span-2" role="group" aria-label="Moving to a new company">
              <p className="flex items-center gap-2 font-semibold text-neutral-950">
                <Icon name="building" className="h-4 w-4 text-ivey-700" />
                Moving from {oldCompany?.name ?? 'no company'} to {newCompany?.name ?? 'no company'}
              </p>
              <p className="mt-1.5 text-neutral-700">
                {pastActivityCount > 0
                  ? pastActivityCount === 1
                    ? "Their 1 logged activity stays with the company it happened with, and still shows on this contact's profile. "
                    : `Their ${pastActivityCount} logged activities stay with the companies they happened with, and still show on this contact's profile. `
                  : ''}
                Completed follow-ups stay too. New activities will default to {newCompany?.name ?? 'no company'}.
              </p>
              {movableTasks.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="font-medium text-neutral-900">
                    What should happen to their {movableTasks.length} open follow-up{movableTasks.length === 1 ? '' : 's'}?
                  </p>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="move-tasks" checked={moveOpenTasks} onChange={() => setMoveOpenTasks(true)} className="accent-ivey-700" />
                    Move {movableTasks.length === 1 ? 'it' : 'them'} to {newCompany?.name ?? 'no company'}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="move-tasks" checked={!moveOpenTasks} onChange={() => setMoveOpenTasks(false)} className="accent-ivey-700" />
                    Keep {movableTasks.length === 1 ? 'it' : 'them'} with {oldCompany?.name ?? 'no company'}
                  </label>
                </div>
              )}
            </div>
          )}
        </FormSection>

        <FormSection title="Contact details">
          <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="name@company.example" error={errors.email} />
          <SelectField label="Preferred contact method" value={preferredContactMethod} onChange={setPreferredContactMethod} options={picklist(PREFERRED_CONTACT_METHODS)} />
          <TextField label="Work phone" type="tel" value={workPhone} onChange={setWorkPhone} placeholder="+1-519-555-0100" error={errors.workPhone} />
          <TextField label="Mobile" type="tel" value={mobilePhone} onChange={setMobilePhone} placeholder="+1-519-555-0100" error={errors.mobilePhone} />
          <TextField className="sm:col-span-2" label="LinkedIn URL" type="url" value={linkedInUrl} onChange={setLinkedInUrl} placeholder="https://www.linkedin.com/in/username" error={errors.linkedInUrl} />
        </FormSection>

        <FormSection title="Relationship">
          <SelectField
            label="Contact priority"
            value={priority}
            onChange={setPriority}
            options={picklist(CONTACT_PRIORITIES)}
            hint={priority === DO_NOT_CONTACT ? 'This person will be flagged as Do Not Contact across the workspace.' : undefined}
          />
          <SelectField label="Source" value={source} onChange={setSource} options={picklist(SOURCES)} />
          <CheckboxGroupField className="sm:col-span-2" label="Contact status" options={PARTNER_STATUSES} value={statuses} onChange={setStatuses} hint="Select all that apply." />
          <CheckboxGroupField className="sm:col-span-2" label="Contact role" options={CONTACT_ROLES} value={roles} onChange={setRoles} />
        </FormSection>

        <FormSection title="EL project participation">
          <CheckboxGroupField className="sm:col-span-2" label="Projects" options={PROJECT_TYPES} value={projects} onChange={setProjects} columns={3} />
          <TextField label="Last project participated" type="date" value={lastProjectDate} onChange={setLastProjectDate} error={errors.lastProjectDate} />
        </FormSection>

        <FormSection title="Alumni">
          <CheckboxGroupField
            className="sm:col-span-2"
            label="Alumni programs"
            options={ALUMNI_OPTIONS}
            value={alumniPrograms}
            onChange={setAlumniPrograms}
            columns={3}
            exclusive={NOT_ALUMNUS}
            hint={`"${NOT_ALUMNUS}" clears the other choices.`}
          />
          <TextField label="Graduation year" value={graduationYear} onChange={setGraduationYear} placeholder="e.g. 2015" error={errors.graduationYear} hint="If alumni." />
        </FormSection>

        <FormSection title="Notes">
          <TextAreaField className="sm:col-span-2" label="Relationship notes" value={notes} onChange={setNotes} rows={4} placeholder="Relationship context: preferences, background, how you met" />
        </FormSection>
      </div>
      <ModalFooter onCancel={onCancel} submitLabel={contact ? 'Save changes' : 'Add contact'} saving={saving} />
    </form>
  );
}
