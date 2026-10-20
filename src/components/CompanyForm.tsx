import { useState, type FormEvent } from 'react';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { isValidWebsite, normalizeWebsite, type FieldErrors } from '../lib/validation';
import { RELATIONSHIP_STATUSES, type Company, type RelationshipStatus } from '../types';
import { FormErrorSummary, SelectField, TextAreaField, TextField } from './ui';
import { ModalFooter } from './Modal';

type Field = 'name' | 'website';

export function CompanyForm({ company, onSaved, onCancel }: {
  company?: Company;
  onSaved: (company: Company) => void;
  onCancel: () => void;
}) {
  const { companies, createCompany, updateCompany } = useData();
  const { notify } = useToast();
  const [name, setName] = useState(company?.name ?? '');
  const [status, setStatus] = useState<RelationshipStatus>(company?.status ?? 'Prospect');
  const [industry, setIndustry] = useState(company?.industry ?? '');
  const [city, setCity] = useState(company?.city ?? '');
  const [website, setWebsite] = useState(company?.website ?? '');
  const [description, setDescription] = useState(company?.description ?? '');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  function validate(): FieldErrors<Field> {
    const next: FieldErrors<Field> = {};
    const trimmed = name.trim();
    if (!trimmed) next.name = 'Company name is required.';
    else if (companies.some((c) => c.id !== company?.id && c.name.trim().toLowerCase() === trimmed.toLowerCase()))
      next.name = 'A company with this name already exists.';
    if (!isValidWebsite(website)) next.website = 'Enter a web address like example.com.';
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
      status,
      industry: industry.trim(),
      city: city.trim(),
      website: normalizeWebsite(website),
      description: description.trim(),
    };
    try {
      const saved = company ? await updateCompany(company.id, input) : await createCompany({ ...input, notes: '' });
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <TextField className="col-span-2" label="Company name" value={name} onChange={setName} required error={errors.name} autoFocus />
        <SelectField
          label="Relationship status"
          value={status}
          onChange={(v) => setStatus(v as RelationshipStatus)}
          options={RELATIONSHIP_STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <TextField label="Industry" value={industry} onChange={setIndustry} placeholder="e.g. Financial services" />
        <TextField label="City" value={city} onChange={setCity} placeholder="e.g. London, ON" />
        <TextField label="Website" value={website} onChange={setWebsite} placeholder="example.com" error={errors.website} />
        <TextAreaField className="col-span-2" label="Description" value={description} onChange={setDescription} rows={3} placeholder="What the organization does and why it matters to the program" />
      </div>
      <ModalFooter onCancel={onCancel} submitLabel={company ? 'Save changes' : 'Add company'} saving={saving} />
    </form>
  );
}
