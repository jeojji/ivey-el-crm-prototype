import { useState, type FormEvent } from 'react';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { APPLICATION_PROJECT_TYPES, CAMPAIGN_PURPOSES, CAMPAIGN_PURPOSE_HINTS, CAMPAIGN_STATES, TERM_SEASONS } from '../lib/options';
import { termOptions } from '../lib/applications';
import { TEMPLATE_PLACEHOLDERS } from '../lib/campaigns';
import type { Campaign } from '../types';
import { Badge, CheckboxGroupField, FormErrorSummary, FormSection, SelectField, TextAreaField, TextField, inputClass } from './ui';
import { ModalFooter } from './Modal';

export function CampaignStateBadge({ state }: { state: string }) {
  const tone = state === 'Active' ? 'bg-ivey-50 text-ivey-800 ring-ivey-200' : state === 'Closed' ? 'bg-neutral-100 text-neutral-700 ring-neutral-200' : 'bg-sky-50 text-sky-800 ring-sky-200';
  return <Badge className={tone}>{state}</Badge>;
}

export function CampaignForm({ campaign, onSaved, onCancel }: { campaign?: Campaign; onSaved: (c: Campaign | null) => void; onCancel: () => void }) {
  const { createCampaign, updateCampaign } = useData();
  const { notify } = useToast();
  const [name, setName] = useState(campaign?.name ?? '');
  const [purpose, setPurpose] = useState(campaign?.purpose ?? 'Project invitation');
  const [projectTypes, setProjectTypes] = useState<string[]>(campaign?.projectTypes ?? []);
  const [termSeason, setTermSeason] = useState(campaign?.termSeason ?? '');
  const [termYear, setTermYear] = useState(campaign?.termYear ? String(campaign.termYear) : '');
  const [state, setState] = useState(campaign?.state ?? 'Planning');
  const [description, setDescription] = useState(campaign?.description ?? '');
  const [templateSubject, setTemplateSubject] = useState(campaign?.templateSubject ?? '');
  const [templateBody, setTemplateBody] = useState(campaign?.templateBody ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    if (!name.trim()) errs.push('Give the campaign a name.');
    if (Boolean(termSeason) !== Boolean(termYear)) errs.push('Choose both the term and the year, or neither.');
    setErrors(errs);
    if (errs.length) return;
    setSaving(true);
    const input = { name: name.trim(), purpose, projectTypes, termSeason, termYear: termYear ? Number(termYear) : null, state, description: description.trim(), templateSubject, templateBody };
    try {
      if (campaign) {
        await updateCampaign(campaign.id, input);
        notify('Campaign saved.');
        onSaved(null);
      } else {
        const created = await createCampaign(input);
        notify(`Campaign “${created.name}” created.`);
        onSaved(created);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save the campaign.', 'error');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <FormErrorSummary show={errors.length > 0} />
      {errors.map((m) => <p key={m} role="alert" className="-mt-3 mb-3 text-sm font-medium text-red-700">{m}</p>)}
      <div className="space-y-6">
        <FormSection title="Campaign">
          <TextField className="sm:col-span-2" label="Name" value={name} onChange={setName} required autoFocus placeholder="e.g. Winter 2027 field project invitations" />
          <SelectField label="Purpose" value={purpose} onChange={setPurpose} options={CAMPAIGN_PURPOSES.map((p) => ({ value: p, label: p }))} hint={CAMPAIGN_PURPOSE_HINTS[purpose as keyof typeof CAMPAIGN_PURPOSE_HINTS]} />
          <SelectField label="State" value={state} onChange={setState} options={CAMPAIGN_STATES.map((s) => ({ value: s, label: s }))} />
          <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-800" id="campaign-term">Academic term</p>
            <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="campaign-term">
              <select aria-label="Term" value={termSeason} onChange={(e) => setTermSeason(e.target.value)} className={inputClass}>
                <option value="">Term</option>
                {TERM_SEASONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select aria-label="Year" value={termYear} onChange={(e) => setTermYear(e.target.value)} className={inputClass}>
                <option value="">Year</option>
                {termOptions().map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <TextAreaField label="Description" value={description} onChange={setDescription} rows={2} />
          <CheckboxGroupField className="sm:col-span-2" label="Project types" options={APPLICATION_PROJECT_TYPES} value={projectTypes} onChange={setProjectTypes} columns={3} hint="Lauren's campaigns can cover any EL project type." />
        </FormSection>
        <FormSection title="Email template" description="For copying into your own email. The app never sends email or runs sequences.">
          <TextField className="sm:col-span-2" label="Subject" value={templateSubject} onChange={setTemplateSubject} />
          <TextAreaField className="sm:col-span-2" label="Message" value={templateBody} onChange={setTemplateBody} rows={7} hint={`Placeholders filled per person when you copy: ${TEMPLATE_PLACEHOLDERS.join(' ')}. Unknown values are left blank.`} />
        </FormSection>
      </div>
      <ModalFooter onCancel={onCancel} submitLabel={campaign ? 'Save campaign' : 'Create campaign'} saving={saving} />
    </form>
  );
}

