import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { campaignTerm, fillTemplate, participantsCsv, templateValues } from '../lib/campaigns';
import { downloadTextFile, timestampForFilename } from '../lib/download';
import { formatDate, fromDateTimeLocalValue, toDateTimeLocalValue } from '../lib/dates';
import { ACTIVITY_LABELS, fullName, matchesQuery } from '../lib/selectors';
import { APPLICATION_STAGES, CAMPAIGN_PURPOSE_HINTS, DO_NOT_CONTACT, STAGE_MEANINGS } from '../lib/options';
import { ACTIVITY_TYPES, type ActivityType } from '../types';
import { Badge, Button, Card, EmptyState, PageHeader, PriorityBadge, SearchInput, TextAreaField, TextField, inputClass } from '../components/ui';
import { Icon } from '../components/Icon';
import { ConfirmDialog, Modal } from '../components/Modal';
import { CampaignForm, CampaignStateBadge } from '../components/campaigns';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { MoreActions } from '../components/Menu';

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CampaignDetailPage() {
  const { id = '' } = useParams();
  const data = useData();
  const { notify } = useToast();
  const navigate = useNavigate();
  const campaign = data.campaigns.find((c) => c.id === id);
  const [modal, setModal] = useState<'edit' | 'add' | 'outreach' | 'delete' | null>(null);
  const [previewFor, setPreviewFor] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const close = () => setModal(null);

  const outreach = useMemo(() => data.activities.filter((a) => a.campaignId === id), [data.activities, id]);
  if (!campaign) {
    return (
      <Card>
        <EmptyState icon="mail" title="Campaign not found" message="It may have been deleted." action={<Link to="/campaigns" className="text-sm font-medium text-ivey-700 hover:underline">Back to campaigns</Link>} />
      </Card>
    );
  }

  const db = data.database;
  const counts = campaign.participants.reduce<Record<string, number>>((m, p) => ((m[p.status] = (m[p.status] ?? 0) + 1), m), {});
  const dncCount = campaign.participants.filter((p) => data.contactById.get(p.contactId)?.priority === DO_NOT_CONTACT).length;
  const previewParticipant = campaign.participants.find((p) => p.id === previewFor) ?? campaign.participants.find((p) => data.contactById.get(p.contactId)?.priority !== DO_NOT_CONTACT);
  const previewContact = previewParticipant ? data.contactById.get(previewParticipant.contactId) : undefined;
  const values = previewParticipant ? templateValues(db, campaign, previewParticipant.contactId) : null;
  const filledSubject = values ? fillTemplate(campaign.templateSubject, values) : campaign.templateSubject;
  const filledBody = values ? fillTemplate(campaign.templateBody, values) : campaign.templateBody;

  function exportCsv() {
    const r = participantsCsv(db, campaign!);
    downloadTextFile(`el-campaign-${campaign!.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${timestampForFilename()}.csv`, r.csv, 'text/csv;charset=utf-8');
    notify(`Exported ${r.included} participant${r.included === 1 ? '' : 's'}${r.excludedDnc ? `; ${r.excludedDnc} Do Not Contact left out` : ''}${r.excludedMissing ? `; ${r.excludedMissing} deleted contact${r.excludedMissing === 1 ? '' : 's'} left out` : ''}.`);
  }

  return (
    <>
      <PageHeader
        back={{ to: '/campaigns', label: 'Campaigns' }}
        title={<span className="flex flex-wrap items-center gap-3">{campaign.name}<CampaignStateBadge state={campaign.state} /></span>}
        description={
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span title={CAMPAIGN_PURPOSE_HINTS[campaign.purpose as keyof typeof CAMPAIGN_PURPOSE_HINTS]}>{campaign.purpose}</span>
            {campaignTerm(campaign) && <span>{campaignTerm(campaign)}</span>}
            {campaign.projectTypes.length > 0 && <span>{campaign.projectTypes.join(', ')}</span>}
          </span>
        }
        actions={
          <>
            <Button variant="secondary" icon="pencil" onClick={() => setModal('edit')}>Edit</Button>
            <Button variant="secondary" icon="download" onClick={exportCsv} disabled={campaign.participants.length === 0}>Export participants</Button>
            <MoreActions items={[{ label: 'Delete campaign…', icon: 'trash', danger: true, onSelect: () => setModal('delete') }]} />
            <Button icon="mail" onClick={() => setModal('outreach')} disabled={campaign.participants.length === 0}>Record outreach</Button>
          </>
        }
      />
      <p className="-mt-4 mb-6 flex items-center gap-2 text-xs text-neutral-500">
        <Icon name="info" className="h-3.5 w-3.5" />
        Nothing is sent from here. Send emails from your own email program, then record them so the history stays complete.
      </p>

      {dncCount > 0 && (
        <p role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-900">
          <Icon name="alert" className="h-4 w-4" />
          {dncCount} participant{dncCount === 1 ? ' is' : 's are'} now marked Do Not Contact. They're excluded from outreach and exports.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card
            title={`Participants (${campaign.participants.length})`}
            action={<Button size="sm" variant="secondary" icon="plus" onClick={() => setModal('add')}>Add participants</Button>}
          >
            {campaign.participants.length > 0 && (
              <p className="mb-4 flex flex-wrap gap-1.5">{APPLICATION_STAGES.filter((s) => counts[s]).map((s) => <Badge key={s}>{s}: {counts[s]}</Badge>)}</p>
            )}
            {campaign.participants.length === 0 ? (
              <EmptyState compact icon="users" title="No participants yet" message="Add the contacts this campaign is for. Do Not Contact contacts can't be added." action={<Button size="sm" icon="plus" onClick={() => setModal('add')}>Add participants</Button>} />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {campaign.participants.map((p) => {
                  const c = data.contactById.get(p.contactId);
                  const company = c?.companyId ? data.companyById.get(c.companyId) : p.companyId ? data.companyById.get(p.companyId) : undefined;
                  const dnc = c?.priority === DO_NOT_CONTACT;
                  const count = outreach.filter((a) => a.contactId === p.contactId).length;
                  return (
                    <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900">
                          {c ? <Link to={`/contacts/${c.id}`} className="hover:text-ivey-700 hover:underline">{fullName(c)}</Link> : <span className="text-neutral-500">(deleted contact)</span>}
                          {dnc && <PriorityBadge priority={DO_NOT_CONTACT} />}
                        </p>
                        <p className="text-xs text-neutral-600">
                          {company ? <Link to={`/companies/${company.id}`} className="hover:underline">{company.name}</Link> : 'No company'}
                          {' · '}{count} outreach record{count === 1 ? '' : 's'}
                          {' · '}status since {formatDate(p.statusHistory.at(-1)?.changedAt ?? p.addedAt)}
                        </p>
                        <label className="mt-1.5 block">
                          <span className="sr-only">Notes for {c ? fullName(c) : 'participant'}</span>
                          <input
                            defaultValue={p.notes}
                            placeholder="Notes"
                            onBlur={(e) => { if (e.target.value !== p.notes) data.updateParticipantNotes(campaign.id, p.id, e.target.value.trim()).then(() => notify('Notes saved.')); }}
                            className={`${inputClass} py-1 text-xs`}
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Campaign status for ${c ? fullName(c) : 'participant'}`}
                          value={p.status}
                          onChange={(e) => data.setParticipantStatus(campaign.id, p.id, e.target.value).then(() => notify(`Status set to ${e.target.value}.`))}
                          className={`${inputClass} w-auto py-1.5 text-xs`}
                          title={STAGE_MEANINGS[p.status as keyof typeof STAGE_MEANINGS]}
                        >
                          {APPLICATION_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button type="button" onClick={() => setRemoving(p.id)} className="rounded p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-700" aria-label={`Remove ${c ? fullName(c) : 'participant'} from campaign`}>
                          <Icon name="x" className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-neutral-500">Campaign status uses Lauren's Opportunity stages and is separate from the company's partner status and any application stage.</p>
          </Card>

          <Card title={`Recorded outreach (${outreach.length})`}>
            <ActivityTimeline activities={outreach} emptyState={<EmptyState compact icon="mail" title="No outreach recorded yet" message="After sending emails or making calls, record them here so they appear in each contact's history." />} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Email template" action={<Button size="sm" variant="ghost" icon="pencil" onClick={() => setModal('edit')}>Edit</Button>}>
            {campaign.participants.length > 0 && (
              <label className="mb-3 block text-xs text-neutral-700">
                Preview for
                <select value={previewParticipant?.id ?? ''} onChange={(e) => setPreviewFor(e.target.value)} className={`${inputClass} mt-1 py-1.5`}>
                  {campaign.participants.map((p) => {
                    const c = data.contactById.get(p.contactId);
                    return <option key={p.id} value={p.id} disabled={c?.priority === DO_NOT_CONTACT}>{c ? fullName(c) : '(deleted contact)'}{c?.priority === DO_NOT_CONTACT ? ' · Do Not Contact' : ''}</option>;
                  })}
                </select>
              </label>
            )}
            <p className="text-xs font-medium text-neutral-500">Subject</p>
            <p className="text-sm text-neutral-900">{filledSubject || <em className="text-neutral-500">No subject</em>}</p>
            <p className="mt-3 text-xs font-medium text-neutral-500">Message</p>
            <p className="text-sm whitespace-pre-line text-neutral-800">{filledBody || <em className="text-neutral-500">No message yet. Edit the campaign to add a template.</em>}</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-neutral-500">For your own email program. Nothing is sent.</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={!filledBody || previewContact?.priority === DO_NOT_CONTACT}
                onClick={async () => notify((await copy(`Subject: ${filledSubject}\n\n${filledBody}`)) ? `Copied for ${previewContact ? fullName(previewContact) : 'the template'}.` : 'Couldn’t copy. Select the text and copy it yourself.', 'info')}
              >
                Copy{previewContact ? ` for ${previewContact.firstName}` : ''}
              </Button>
            </div>
          </Card>
          {campaign.description && (
            <Card title="About this campaign"><p className="text-sm text-neutral-700">{campaign.description}</p></Card>
          )}
        </div>
      </div>

      <Modal open={modal === 'edit'} onClose={close} title={`Edit “${campaign.name}”`} size="xl">
        <CampaignForm campaign={campaign} onSaved={close} onCancel={close} />
      </Modal>
      <Modal open={modal === 'add'} onClose={close} title="Add participants" size="lg">
        <AddParticipants campaignId={campaign.id} existing={new Set(campaign.participants.map((p) => p.contactId))} onDone={close} />
      </Modal>
      <Modal open={modal === 'outreach'} onClose={close} title="Record outreach" description="Record emails or calls you've already made outside the app." size="lg">
        <RecordOutreach campaignId={campaign.id} defaultSubject={campaign.templateSubject} onDone={close} />
      </Modal>
      <ConfirmDialog
        open={!!removing}
        title="Remove from this campaign?"
        message={(() => {
          const p = campaign.participants.find((x) => x.id === removing);
          const c = p ? data.contactById.get(p.contactId) : undefined;
          return `${c ? fullName(c) : 'This participant'} and their campaign status history (${p?.statusHistory.length ?? 0} change${p?.statusHistory.length === 1 ? '' : 's'}) will be removed from “${campaign.name}”. The contact and any recorded outreach stay in their history.`;
        })()}
        confirmLabel="Remove from campaign"
        onConfirm={async () => { const pid = removing!; setRemoving(null); await data.removeParticipant(campaign.id, pid); notify('Removed from campaign.'); }}
        onCancel={() => setRemoving(null)}
      />
      <ConfirmDialog
        open={modal === 'delete'}
        title={`Delete “${campaign.name}”?`}
        message={`The campaign, its template and the statuses of its ${campaign.participants.length} participant${campaign.participants.length === 1 ? '' : 's'} are removed. The contacts and the ${outreach.length} recorded outreach activit${outreach.length === 1 ? 'y' : 'ies'} stay in their histories.`}
        confirmLabel="Delete campaign"
        onConfirm={async () => { close(); await data.deleteCampaign(campaign.id); notify('Campaign deleted.'); navigate('/campaigns'); }}
        onCancel={close}
      />
    </>
  );
}

function AddParticipants({ campaignId, existing, onDone }: { campaignId: string; existing: Set<string>; onDone: () => void }) {
  const data = useData();
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const list = data.contacts
    .filter((c) => matchesQuery(query, fullName(c), c.email, c.jobTitle, c.roles.join(' '), c.companyId ? data.companyById.get(c.companyId)?.name : ''))
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));

  async function add() {
    try {
      const n = await data.addParticipants(campaignId, [...picked]);
      notify(`${n} participant${n === 1 ? '' : 's'} added.`);
      onDone();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not add participants.', 'error');
    }
  }

  return (
    <div>
      <SearchInput value={query} onChange={setQuery} placeholder="Search name, company, role" label="Search contacts" />
      <ul className="mt-3 max-h-96 divide-y divide-neutral-100 overflow-y-auto">
        {list.map((c) => {
          const dnc = c.priority === DO_NOT_CONTACT;
          const already = existing.has(c.id);
          return (
            <li key={c.id}>
              <label className={`flex items-center gap-3 py-2 ${dnc || already ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  disabled={dnc || already}
                  checked={picked.has(c.id)}
                  onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })}
                  aria-label={`Add ${fullName(c)}`}
                  className="h-4 w-4 accent-ivey-700"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-neutral-900">{fullName(c)}</span>
                  <span className="block text-xs text-neutral-600">{[c.companyId ? data.companyById.get(c.companyId)?.name : 'No company', c.roles.join(', ')].filter(Boolean).join(' · ')}</span>
                </span>
                {dnc && <span className="text-xs font-medium text-red-700">Do Not Contact: excluded from outreach</span>}
                {already && <span className="text-xs text-neutral-500">Already in campaign</span>}
              </label>
            </li>
          );
        })}
      </ul>
      <div className="-mx-6 mt-4 -mb-5 flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-6 py-4">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button onClick={add} disabled={picked.size === 0}>Add {picked.size || ''} participant{picked.size === 1 ? '' : 's'}</Button>
      </div>
    </div>
  );
}

function RecordOutreach({ campaignId, defaultSubject, onDone }: { campaignId: string; defaultSubject: string; onDone: () => void }) {
  const data = useData();
  const { notify } = useToast();
  const campaign = data.campaigns.find((c) => c.id === campaignId)!;
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [type, setType] = useState<ActivityType>('email');
  const [when, setWhen] = useState(toDateTimeLocalValue(new Date().toISOString()));
  const [subject, setSubject] = useState(defaultSubject);
  const [details, setDetails] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [error, setError] = useState('');

  async function save() {
    const iso = fromDateTimeLocalValue(when);
    if (!picked.size) return setError('Choose who the outreach was with.');
    if (!subject.trim()) return setError('Add a short subject.');
    if (!iso) return setError('Choose a valid date and time.');
    try {
      const n = await data.recordOutreach(campaignId, { participantIds: [...picked], type, occurredAt: iso, subject: subject.trim(), details: details.trim(), newStatus: newStatus || null });
      notify(`Outreach recorded for ${n} participant${n === 1 ? '' : 's'}${newStatus ? `; status set to ${newStatus}` : ''}.`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the outreach. Nothing was saved.');
    }
  }

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-neutral-800">Who was it with?</legend>
        <ul className="max-h-56 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200 px-3">
          {campaign.participants.map((p) => {
            const c = data.contactById.get(p.contactId);
            const dnc = !c || c.priority === DO_NOT_CONTACT;
            return (
              <li key={p.id}>
                <label className={`flex items-center gap-3 py-2 text-sm ${dnc ? 'opacity-70' : ''}`}>
                  <input type="checkbox" disabled={dnc} checked={picked.has(p.id)} aria-label={`Outreach with ${c ? fullName(c) : 'deleted contact'}`}
                    onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} className="h-4 w-4 accent-ivey-700" />
                  <span className="flex-1">{c ? fullName(c) : '(deleted contact)'} <span className="text-xs text-neutral-500">· {p.status}</span></span>
                  {c?.priority === DO_NOT_CONTACT && <span className="text-xs font-medium text-red-700">Do Not Contact</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-neutral-800">Type</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {ACTIVITY_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2"><input type="radio" name="outreach-type" checked={type === t} onChange={() => setType(t)} className="accent-ivey-700" />{ACTIVITY_LABELS[t]}</label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Subject" value={subject} onChange={setSubject} hint="Placeholders like {{companyName}} are filled for each person." />
        <TextField label="Date and time" type="datetime-local" value={when} onChange={setWhen} />
        <TextAreaField className="sm:col-span-2" label="Notes" value={details} onChange={setDetails} rows={3} placeholder="What was sent or discussed" />
        <label className="sm:col-span-2 text-sm">
          <span className="mb-1.5 block font-medium text-neutral-800">Also set their campaign status to</span>
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={inputClass} aria-label="Also set their campaign status to">
            <option value="">No change</option>
            {APPLICATION_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-neutral-500">Creates one activity per person in their contact and company history, linked to this campaign. Nothing is sent.</p>
      <div className="-mx-6 -mb-5 flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-6 py-4">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button onClick={save}>Record outreach</Button>
      </div>
    </div>
  );
}
