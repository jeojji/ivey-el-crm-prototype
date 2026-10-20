import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { checkLocalAi, generateBrief, type AiAvailability } from '../ai/client';
import { buildSources, briefFreshness } from '../lib/briefSources';
import { formatDateTime, toDateString } from '../lib/dates';
import { ACTIVITY_LABELS, byOccurredDesc, fullName } from '../lib/selectors';
import { DO_NOT_CONTACT } from '../lib/options';
import { Badge, Button, Card, PageHeader, SelectField } from '../components/ui';
import { Icon } from '../components/Icon';
import { ActivityTypeIcon } from '../components/ActivityTimeline';

export function PrepPage() {
  const data = useData();
  const { companies, contacts, applications, activities, companyById, contactById, applicationById } = data;
  const { notify } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [availability, setAvailability] = useState<AiAvailability>({ state: 'checking' });
  const [companyId, setCompanyId] = useState(params.get('company') ?? '');
  const [contactId, setContactId] = useState(params.get('contact') ?? '');
  const [applicationId, setApplicationId] = useState(params.get('application') ?? '');
  const presetActivities = params.get('activities');
  const [picked, setPicked] = useState<Set<string> | null>(presetActivities ? new Set(presetActivities.split(',')) : null);
  const [running, setRunning] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const cancelRef = useRef<AbortController | null>(null);

  // Fill the company from a contact or application given in the link.
  useEffect(() => {
    if (!companyId) {
      const fromApp = applicationById.get(applicationId)?.companyId;
      const fromContact = contactById.get(contactId)?.companyId;
      if (fromApp || fromContact) setCompanyId(fromApp || fromContact || '');
    }
  }, []);
  useEffect(() => void checkLocalAi().then(setAvailability), []);
  useEffect(() => {
    if (running === null) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - running) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);

  const companyContacts = contacts.filter((c) => !companyId || c.companyId === companyId || c.id === contactId).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const companyApps = applications.filter((a) => !companyId || a.companyId === companyId || a.id === applicationId);
  const contact = contactById.get(contactId);
  const company = companyById.get(companyId);
  const app = applicationById.get(applicationId);

  // Communications linked to any of the chosen records.
  const candidates = useMemo(
    () =>
      activities
        .filter((a) => (companyId && a.companyId === companyId) || (contactId && a.contactId === contactId) || (applicationId && a.applicationId === applicationId))
        .sort(byOccurredDesc),
    [activities, companyId, contactId, applicationId],
  );
  const defaultPick = useMemo(() => {
    const forApp = applicationId ? candidates.filter((a) => a.applicationId === applicationId) : [];
    return new Set((forApp.length ? forApp : candidates).slice(0, 6).map((a) => a.id));
  }, [candidates, applicationId]);
  const selected = picked ?? defaultPick;
  const selection = { companyId: companyId || null, contactId: contactId || null, applicationId: applicationId || null, activityIds: candidates.filter((a) => selected.has(a.id)).map((a) => a.id) };
  const { sources, truncated } = useMemo(() => buildSources(data.database, selection), [data.database, companyId, contactId, applicationId, [...selected].join()]);
  const savedBriefs = data.briefs
    .filter((b) => (companyId && b.companyId === companyId) || (contactId && b.contactId === contactId))
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, 5);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  async function generate() {
    setError(null);
    const ctrl = new AbortController();
    cancelRef.current = ctrl;
    setElapsed(0);
    setRunning(Date.now());
    const res = await generateBrief(
      {
        focus: {
          companyName: company?.name ?? '',
          contactName: contact ? fullName(contact) : '',
          contactFirstName: contact?.firstName ?? '',
          applicationTitle: app?.title ?? '',
          doNotContact: contact?.priority === DO_NOT_CONTACT,
        },
        today: toDateString(new Date()),
        sources,
      },
      ctrl.signal,
    );
    setRunning(null);
    if (ctrl.signal.aborted) return;
    if (!res.ok) return setError(res.message);
    try {
      const saved = await data.createBrief({
        companyId: selection.companyId,
        contactId: selection.contactId,
        applicationId: selection.applicationId,
        sources: sources.map(({ text: _text, ...rest }) => rest),
        model: res.model,
        generatedAt: new Date().toISOString(),
        durationMs: res.durationMs,
        content: res.content,
        warnings: res.warnings,
        flaggedSources: res.flaggedSources,
        edits: {
          openingScript: res.content.openingScript,
          talkingPoints: res.content.talkingPoints.join('\n'),
          emailSubject: res.content.followUpEmail.subject,
          emailBody: res.content.followUpEmail.body,
        },
        createdTaskIds: [],
      });
      notify('Brief generated and saved.');
      navigate(`/briefs/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The brief couldn’t be saved.');
    }
  }

  const canGenerate = availability.state === 'available' && (companyId || contactId) && sources.length > 0 && running === null;

  const communicationCount = selection.activityIds.length;
  const recordCount = sources.length - communicationCount;
  const fromRecord = params.get('company') || params.get('contact') || params.get('application');

  return (
    <>
      <PageHeader
        title="Conversation prep"
        description="Open a saved relationship brief, or make a new one from your records with the local AI. Facts link to the records they come from. Suggestions are kept separate for you to edit."
      />

      <div className="max-w-4xl space-y-6">
        <Card title="Who is the conversation with?">
          {fromRecord && (companyId || contactId) && (
            <p className="mb-4 text-xs text-neutral-600">Filled in from the page you came from. Change it if the conversation is with someone else.</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SelectField
              label="Company"
              value={companyId}
              onChange={(v) => {
                setCompanyId(v);
                if (contact && contact.companyId !== v) setContactId('');
                if (app && app.companyId !== v) setApplicationId('');
                setPicked(null);
              }}
              options={[{ value: '', label: 'Choose a company' }, ...[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name }))]}
            />
            <SelectField
              label="Contact"
              value={contactId}
              onChange={(v) => { setContactId(v); setPicked(null); }}
              options={[{ value: '', label: companyContacts.length ? 'Not a specific person' : 'No contacts' }, ...companyContacts.map((c) => ({ value: c.id, label: `${fullName(c)}${c.priority === DO_NOT_CONTACT ? ' · Do Not Contact' : ''}` }))]}
            />
            <SelectField
              label="Application"
              value={applicationId}
              onChange={(v) => { setApplicationId(v); setPicked(null); }}
              options={[{ value: '', label: companyApps.length ? 'Not about a specific application' : 'No applications' }, ...companyApps.map((a) => ({ value: a.id, label: `${a.title} · ${a.stage}` }))]}
            />
          </div>
          {contact?.priority === DO_NOT_CONTACT && (
            <p role="alert" className="mt-4 flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
              <Icon name="alert" className="h-4 w-4 shrink-0" />
              {fullName(contact)} is marked Do Not Contact. The brief will say so, and you should check before any outreach.
            </p>
          )}
        </Card>

        {(companyId || contactId) && (
          <Card title={`Saved briefs (${savedBriefs.length})`}>
            {savedBriefs.length === 0 ? (
              <p className="text-sm text-neutral-600">No saved briefs for {contact ? fullName(contact) : company?.name} yet. Make one below.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {savedBriefs.map((b, i) => {
                  const f = briefFreshness(b, data.database);
                  const about = [contactById.get(b.contactId ?? '') && fullName(contactById.get(b.contactId!)!), applicationById.get(b.applicationId ?? '')?.title].filter(Boolean).join(' · ') || companyById.get(b.companyId ?? '')?.name;
                  return (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="min-w-0 text-sm">
                        <span className="block font-medium text-neutral-900">{formatDateTime(b.generatedAt)}{i === 0 && <span className="ml-2 text-xs font-normal text-neutral-500">latest</span>}</span>
                        <span className="block text-xs text-neutral-600">
                          {about} · {b.sources.length} records
                          {f.outdated && <Badge className="ml-2 bg-amber-50 text-amber-900 ring-amber-300">May be outdated</Badge>}
                          {f.newer > 0 && <span className="ml-2">{f.newer} newer not included</span>}
                        </span>
                      </span>
                      <Link to={`/briefs/${b.id}`} className={i === 0 ? 'rounded-md bg-ivey-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-ivey-800' : 'text-sm font-medium text-ivey-700 hover:underline'}>
                        Open brief
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        <Card title="Make a new brief">
          {!companyId && !contactId ? (
            <p className="text-sm text-neutral-600">Choose a company or contact first.</p>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-neutral-900">Records included ({sources.length})</h3>
              <p className="mt-0.5 text-xs text-neutral-600">
                {communicationCount} of {candidates.length} saved communications, most relevant first, plus {recordCount} workspace record{recordCount === 1 ? '' : 's'} (the people, company and application chosen above, and their open follow-ups). Originals are only read, never changed.
              </p>
              {sources.length > 0 && (
                <ol className="mt-3 space-y-1.5 text-sm">
                  {sources.map((src) => (
                    <li key={src.id} className="flex gap-2">
                      <Badge>{src.id}</Badge>
                      <span className="min-w-0 text-neutral-800">{src.label}</span>
                    </li>
                  ))}
                </ol>
              )}
              {truncated && <p className="mt-3 text-xs text-amber-800">Too much to read at once: the oldest communications were left out. Use Adjust sources to choose which.</p>}

              <div className="mt-4 rounded-lg border border-neutral-200">
                <button
                  type="button"
                  aria-expanded={adjusting}
                  aria-controls="adjust-sources"
                  onClick={() => setAdjusting((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left text-sm font-medium text-neutral-900 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-ivey-600"
                >
                  <Icon name="chevronRight" className={`h-4 w-4 text-neutral-500 transition-transform ${adjusting ? 'rotate-90' : ''}`} />
                  Adjust sources
                  <span className="ml-auto text-xs font-normal text-neutral-500">{selected.size} of {candidates.length} communications selected</span>
                </button>
                <div id="adjust-sources" hidden={!adjusting} className="border-t border-neutral-100 px-4 py-3">
                  {candidates.length === 0 ? (
                    <p className="text-sm text-neutral-600">No saved communications. The brief can still use the records above, but it will have little to say. Add emails, calls or meetings first for a useful brief.</p>
                  ) : (
                    <>
                      <div className="mb-1 flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(candidates.map((a) => a.id)))}>Select all</Button>
                        <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>None</Button>
                      </div>
                      <ul className="divide-y divide-neutral-100">
                        {candidates.map((a) => (
                          <li key={a.id}>
                            <label className="flex cursor-pointer items-start gap-3 py-2.5">
                              <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="mt-1.5 h-4 w-4 accent-ivey-700" aria-label={`Use ${a.subject || ACTIVITY_LABELS[a.type]}`} />
                              <ActivityTypeIcon type={a.type} />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-neutral-900">{a.subject || '(no subject)'}</span>
                                <span className="block text-xs text-neutral-600">
                                  {ACTIVITY_LABELS[a.type]} · {a.email && !a.email.dateKnown ? 'date unknown' : formatDateTime(a.occurredAt)}
                                  {a.contactId && contactById.get(a.contactId) ? ` · ${fullName(contactById.get(a.contactId)!)}` : ''}
                                  {a.applicationId && applicationById.get(a.applicationId) ? ` · ${applicationById.get(a.applicationId)!.title}` : ''}
                                  {a.email && ' · original email included'}
                                </span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="mt-5 border-t border-neutral-100 pt-4">
            <p className="text-sm text-neutral-700">
              {availability.state === 'checking' && 'Checking for the local model…'}
              {availability.state === 'available' && <>Runs on this computer with <strong className="font-semibold">{availability.model}</strong>. Nothing leaves this computer. Usually takes 30–90 seconds.</>}
              {availability.state === 'demo' && 'Local AI isn’t available in the online demo. Briefs can only be generated on a computer set up with Ollama (see the setup guide).'}
              {availability.state === 'unavailable' && <>Local AI is unavailable: {availability.reason}</>}
            </p>
            {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {running !== null ? (
                <>
                  <span role="status" className="text-sm text-neutral-700">Reading {sources.length} records on this computer… {elapsed}s</span>
                  <Button variant="secondary" onClick={() => { cancelRef.current?.abort(); setRunning(null); }}>Cancel</Button>
                </>
              ) : (
                <Button variant={savedBriefs.length ? 'secondary' : 'primary'} icon="note" onClick={generate} disabled={!canGenerate}>Generate brief and conversation prep</Button>
              )}
              {availability.state === 'unavailable' && <Button variant="ghost" size="sm" onClick={() => checkLocalAi().then(setAvailability)}>Check again</Button>}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
