import { useState, type FormEvent } from 'react';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { isValidEmail, type FieldErrors } from '../lib/validation';
import { fullName } from '../lib/selectors';
import type { Contact } from '../types';
import { FormErrorSummary, SelectField, TextAreaField, TextField } from './ui';
import { ModalFooter } from './Modal';

type Field = 'firstName' | 'lastName' | 'email';

export function ContactForm({ contact, defaultCompanyId, onSaved, onCancel }: {
  contact?: Contact;
  defaultCompanyId?: string;
  onSaved: (contact: Contact) => void;
  onCancel: () => void;
}) {
  const { companies, contacts, createContact, updateContact } = useData();
  const { notify } = useToast();
  const [firstName, setFirstName] = useState(contact?.firstName ?? '');
  const [lastName, setLastName] = useState(contact?.lastName ?? '');
  const [companyId, setCompanyId] = useState(contact?.companyId ?? defaultCompanyId ?? '');
  const [jobTitle, setJobTitle] = useState(contact?.jobTitle ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [notes, setNotes] = useState(contact?.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

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
      phone: phone.trim(),
      notes: notes.trim(),
    };
    try {
      const saved = contact ? await updateContact(contact.id, input) : await createContact(input);
      notify(contact ? `Saved changes to ${fullName(saved)}.` : `${fullName(saved)} added.`);
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <TextField label="First name" value={firstName} onChange={setFirstName} required error={errors.firstName} autoFocus />
        <TextField label="Last name" value={lastName} onChange={setLastName} required error={errors.lastName} />
        <SelectField
          label="Company"
          value={companyId}
          onChange={setCompanyId}
          options={companyOptions}
          hint={contact && contact.companyId !== (companyId || null) ? "Their activities and follow-ups will move to the new company." : undefined}
        />
        <TextField label="Job title" value={jobTitle} onChange={setJobTitle} placeholder="e.g. Talent Manager" />
        <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="name@company.example" error={errors.email} />
        <TextField label="Phone" type="tel" value={phone} onChange={setPhone} placeholder="519-555-0100" />
        <TextAreaField className="col-span-2" label="Notes" value={notes} onChange={setNotes} rows={3} placeholder="Preferences, background, how you met" />
      </div>
      <ModalFooter onCancel={onCancel} submitLabel={contact ? 'Save changes' : 'Add contact'} saving={saving} />
    </form>
  );
}
