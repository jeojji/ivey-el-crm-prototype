import { useState, type FormEvent } from 'react';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { INDUSTRIES, PARTNER_STATUSES, PRIORITIES, PROJECT_TYPES } from '../lib/options';
import { isValidIsoDate, isValidPhone, isValidWebsite, normalizeWebsite, type FieldErrors } from '../lib/validation';
import type { Address, Company } from '../types';
import { CheckboxGroupField, FormErrorSummary, FormSection, SelectField, TextAreaField, TextField, picklist } from './ui';
import { ModalFooter } from './Modal';

type Field = 'name' | 'website' | 'phone' | 'lastProjectDate';
const emptyAddress: Address = { street: '', city: '', province: '', postalCode: '', country: '' };

export function CompanyForm({ company, onSaved, onCancel }: {
  company?: Company;
  onSaved: (company: Company) => void;
  onCancel: () => void;
}) {
  const { companies, createCompany, updateCompany } = useData();
  const { notify } = useToast();
  const [name, setName] = useState(company?.name ?? '');
  const [industry, setIndustry] = useState(company?.industry ?? '');
  const [website, setWebsite] = useState(company?.website ?? '');
  const [phone, setPhone] = useState(company?.phone ?? '');
  const [address, setAddress] = useState<Address>(company?.address ?? emptyAddress);
  const [priority, setPriority] = useState(company?.priority ?? '');
  const [statuses, setStatuses] = useState<string[]>(company?.statuses ?? []);
  const [projects, setProjects] = useState<string[]>(company?.projectParticipation ?? []);
  const [lastProjectDate, setLastProjectDate] = useState(company?.lastProjectDate ?? '');
  const [description, setDescription] = useState(company?.description ?? '');
  const [notes, setNotes] = useState(company?.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const setAddr = (key: keyof Address) => (v: string) => setAddress((a) => ({ ...a, [key]: v }));

  function validate(): FieldErrors<Field> {
    const next: FieldErrors<Field> = {};
    const trimmed = name.trim();
    if (!trimmed) next.name = 'Company name is required.';
    else if (companies.some((c) => c.id !== company?.id && c.name.trim().toLowerCase() === trimmed.toLowerCase()))
      next.name = 'A company with this name already exists.';
    if (!isValidWebsite(website)) next.website = 'Enter a web address like example.com.';
    if (!isValidPhone(phone)) next.phone = 'Enter a phone number, e.g. +1-519-555-0100.';
    if (!isValidIsoDate(lastProjectDate)) next.lastProjectDate = 'Choose a valid date.';
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
      name: name.trim(),
      industry,
      website: normalizeWebsite(website),
      phone: phone.trim(),
      address: {
        street: address.street.trim(),
        city: address.city.trim(),
        province: address.province.trim(),
        postalCode: address.postalCode.trim(),
        country: address.country.trim(),
      },
      priority,
      statuses,
      projectParticipation: projects,
      lastProjectDate,
      description: description.trim(),
      notes: notes.trim(),
    };
    try {
      const saved = company ? await updateCompany(company.id, input) : await createCompany(input);
      notify(company ? `Saved changes to ${saved.name}.` : `${saved.name} added.`);
      onSaved(saved);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save the company.', 'error');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormErrorSummary show={attempted && Object.keys(errors).length > 0} />
      <div className="space-y-6">
        <FormSection title="Basics">
          <TextField className="sm:col-span-2" label="Company name" value={name} onChange={setName} required error={errors.name} autoFocus />
          <SelectField className="sm:col-span-2" label="Industry" value={industry} onChange={setIndustry} options={picklist(INDUSTRIES)} />
          <TextField label="Website" value={website} onChange={setWebsite} placeholder="example.com" error={errors.website} />
          <TextField label="Company phone" type="tel" value={phone} onChange={setPhone} placeholder="+1-519-555-0100" error={errors.phone} />
        </FormSection>

        <FormSection title="Address">
          <TextField className="sm:col-span-2" label="Street" value={address.street} onChange={setAddr('street')} />
          <TextField label="City" value={address.city} onChange={setAddr('city')} />
          <TextField label="Province / state" value={address.province} onChange={setAddr('province')} placeholder="e.g. Ontario" />
          <TextField label="Postal / ZIP code" value={address.postalCode} onChange={setAddr('postalCode')} />
          <TextField label="Country" value={address.country} onChange={setAddr('country')} placeholder="e.g. Canada" />
        </FormSection>

        <FormSection title="Partnership">
          <SelectField label="Partnership priority" value={priority} onChange={setPriority} options={picklist(PRIORITIES)} />
          <TextField label="Last project participated" type="date" value={lastProjectDate} onChange={setLastProjectDate} error={errors.lastProjectDate} hint="When did this company last engage?" />
          <CheckboxGroupField className="sm:col-span-2" label="Partner status" options={PARTNER_STATUSES} value={statuses} onChange={setStatuses} hint="Select all that apply." />
          <CheckboxGroupField className="sm:col-span-2" label="Project participation" options={PROJECT_TYPES} value={projects} onChange={setProjects} columns={3} hint="Every EL project type this company has ever taken part in." />
        </FormSection>

        <FormSection title="Notes">
          <TextAreaField className="sm:col-span-2" label="About the company" value={description} onChange={setDescription} rows={2} placeholder="What the organization does" />
          <TextAreaField className="sm:col-span-2" label="Relationship notes" value={notes} onChange={setNotes} rows={4} placeholder="Relationship context: preferences, timing, who decides" />
        </FormSection>
      </div>
      <ModalFooter onCancel={onCancel} submitLabel={company ? 'Save changes' : 'Add company'} saving={saving} />
    </form>
  );
}
