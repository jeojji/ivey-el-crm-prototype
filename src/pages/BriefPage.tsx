import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { briefFreshness } from '../lib/briefSources';
import { formatDate, formatDateTime } from '../lib/dates';
import { fullName } from '../lib/selectors';
import { DO_NOT_CONTACT } from '../lib/options';
import type { Fact } from '../ai/brief';
import type { Brief, Database } from '../types';
import { Badge, Button, Card, EmptyState, PageHeader, inputClass } from '../components/ui';
import { Icon } from '../components/Icon';
import { ConfirmDialog, Modal } from '../components/Modal';
import { MoreActions } from '../components/Menu';

/** Where a cited record lives in the app. */
function sourceHref(db: Database, kind: Brief['sources'][number]['kind'], recordId: string): string | null {
  switch (kind) {
    case 'company':
      return db.companies.some((c) => c.id === recordId) ? `/companies/${recordId}` : null;
    case 'contact':
      return db.contacts.some((c) => c.id === recordId) ? `/contacts/${recordId}` : null;
    case 'application':
      return db.applications.some((a) => a.id === recordId) ? `/applications/${recordId}` : null;
    case 'task':
      return db.tasks.some((t) => t.id === recordId) ? '/follow-ups' : null;
    case 'activity': {
      const a = db.activities.find((x) => x.id === recordId);
      if (!a) return null;
      if (a.email) return `/emails/${a.id}`;
      return a.companyId ? `/companies/${a.companyId}` : a.contactId ? `/contacts/${a.contactId}` : '/activity';
    }
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function Facts({ facts, empty, brief, db }: { facts: Fact[]; empty: string; brief: Brief; db: Database }) {
  if (!facts.length) return <p className="text-sm text-neutral-500">{empty}</p>;
  return (
    <ul className="space-y-3">
      {facts.map((f) => (
        <li key={f.text} className="text-sm">
          <p className="text-neutral-900">{f.text}</p>
          <ul className="mt-1 space-y-1">
            {f.citations.map((c) => {
              const s = brief.sources.find((x) => x.id === c.sourceId);
              const href = s ? sourceHref(db, s.kind, s.recordId) : null;
              return (
                <li key={c.sourceId + c.quote} className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-neutral-600">
                  {href ? (
                    <Link to={href} className="font-medium text-ivey-700 hover:underline"><Badge>{c.sourceId}</Badge> {s?.label}</Link>
                  ) : (
                    <span><Badge>{c.sourceId}</Badge> {s?.label ?? 'Unknown source'} (no longer exists)</span>
                  )}
                  <q className="rounded bg-sky-50 px-1 text-sky-950">{c.quote}</q>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function CopyButton({ text, what }: { text: string; what: string }) {
  const { notify } = useToast();
  return (
    <Button size="sm" variant="secondary" onClick={async () => notify((await copyText(text)) ? `${what} copied.` : 'Couldn’t copy. Select the text and copy it yourself.', 'info')} disabled={!text.trim()}>
      Copy
    </Button>
  );
}

export function BriefPage() {
  const { id = '' } = useParams();
  const data = useData();
  const { notify } = useToast();
  const navigate = useNavigate();
  const brief = data.briefs.find((b) => b.id === id);
  const [edits, setEdits] = useState<Brief['edits'] | null>(brief?.edits ?? null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | null>(null);
  const [steps, setSteps] = useState(() => (brief?.content.nextSteps ?? []).map((s) => ({ use: false, text: s.text, due: '' })));
  const [confirmTasks, setConfirmTasks] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // Save draft edits shortly after typing stops.
  useEffect(() => {
    if (!brief || !edits || JSON.stringify(edits) === JSON.stringify(brief.edits)) return;
    setSaveState('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await data.updateBriefEdits(brief.id, edits);
      setSaveState('saved');
    }, 600);
    return () => window.clearTimeout(timer.current);
  }, [edits]);

  if (!brief || !edits) {
    return (
      <Card>
        <EmptyState icon="note" title="Brief not found" message="It may have been deleted." action={<Link to="/prep" className="text-sm font-medium text-ivey-700 hover:underline">Conversation prep</Link>} />
      </Card>
    );
  }

  const db = data.database;
  const company = brief.companyId ? data.companyById.get(brief.companyId) : undefined;
  const contact = brief.contactId ? data.contactById.get(brief.contactId) : undefined;
  const app = brief.applicationId ? data.applicationById.get(brief.applicationId) : undefined;
  const fresh = briefFreshness(brief, db);
  const c = brief.content;
  const chosenSteps = steps.filter((s) => s.use);
  const stepsReady = chosenSteps.length > 0 && chosenSteps.every((s) => s.text.trim() && /^\d{4}-\d{2}-\d{2}$/.test(s.due));
  const createdTasks = data.tasks.filter((t) => brief.createdTaskIds.includes(t.id));
  const regenerateHref = `/prep?${new URLSearchParams({
    ...(brief.companyId ? { company: brief.companyId } : {}),
    ...(brief.contactId ? { contact: brief.contactId } : {}),
    ...(brief.applicationId ? { application: brief.applicationId } : {}),
    activities: brief.sources.filter((s) => s.kind === 'activity').map((s) => s.recordId).join(','),
  }).toString()}`;
  const setEdit = (k: keyof Brief['edits'], v: string) => setEdits((e) => (e ? { ...e, [k]: v } : e));

  async function createTasks() {
    setConfirmTasks(false);
    try {
      await data.createTasksFromBrief(brief!.id, chosenSteps.map((s) => ({ title: s.text.trim(), dueDate: s.due })));
      notify(`${chosenSteps.length} follow-up${chosenSteps.length === 1 ? '' : 's'} created.`);
      setSteps((list) => list.map((s) => (s.use ? { ...s, use: false } : s)));
    } catch (err) {
      notify(err instanceof Error ? `${err.message} Nothing was created.` : 'Nothing was created.', 'error');
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/prep', label: 'Conversation prep' }}
        title={<>Relationship brief{company ? ` · ${company.name}` : ''}</>}
        description={
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {contact && <Link to={`/contacts/${contact.id}`} className="font-medium text-ivey-700 hover:underline">{fullName(contact)}</Link>}
            {app && <Link to={`/applications/${app.id}`} className="font-medium text-ivey-700 hover:underline">{app.title}</Link>}
            <span>Generated {formatDateTime(brief.generatedAt)} · {brief.model} · {Math.round(brief.durationMs / 1000)}s · {brief.sources.length} records</span>
          </span>
        }
        actions={
          <>
            <Link to={regenerateHref} className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-800 shadow-xs hover:bg-neutral-50">Regenerate…</Link>
            <MoreActions items={[{ label: 'Delete brief…', icon: 'trash', danger: true, onSelect: () => setConfirmDelete(true) }]} />
          </>
        }
      />

      {fresh.outdated && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="flex items-center gap-2 font-semibold"><Icon name="alert" className="h-4 w-4 text-amber-700" />This brief may be outdated</p>
          <p className="mt-0.5">These records changed after it was generated:</p>
          <ul className="mt-1 list-disc pl-5">
            {fresh.changed.map((ch) => <li key={ch.label}>{ch.label}: {ch.why === 'deleted' ? 'deleted' : 'edited'}</li>)}
          </ul>
          <Link to={regenerateHref} className="mt-2 inline-block font-medium underline">Regenerate with the current records</Link>
        </div>
      )}
      {fresh.newer > 0 && (
        <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-950">
          {fresh.newer} newer communication{fresh.newer === 1 ? '' : 's'} with this {brief.applicationId ? 'application' : 'company or contact'} {fresh.newer === 1 ? 'was' : 'were'} added after this brief and {fresh.newer === 1 ? 'isn’t' : 'aren’t'} included.
        </p>
      )}
      {contact?.priority === DO_NOT_CONTACT && (
        <p role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-900">
          <Icon name="alert" className="h-4 w-4" />{fullName(contact)} is marked Do Not Contact. Check before using any outreach below.
        </p>
      )}
      {brief.flaggedSources.length > 0 && (
        <p role="note" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          Source{brief.flaggedSources.length === 1 ? '' : 's'} {brief.flaggedSources.join(', ')} contain{brief.flaggedSources.length === 1 ? 's' : ''} text that looks like instructions to an AI. It was treated as data and not followed. It was removed before the model read the record (your original is unchanged), and nothing quoting it was kept.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Card title={<span className="flex items-center gap-2">Recorded facts <Badge className="bg-ivey-50 text-ivey-800 ring-ivey-200">From your records</Badge></span>}>
            <p className="mb-4 text-xs text-neutral-500">Each statement links to the record it came from, with the exact words quoted. Statements that couldn't be traced to a record were removed.</p>
            <section className="space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-neutral-950">Current relationship summary</h3>
                <Facts facts={c.summary} empty="Nothing could be summarised from the selected records." brief={brief} db={db} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-neutral-950">Recorded commitments</h3>
                <Facts facts={c.commitments} empty="No commitments are recorded in the selected records." brief={brief} db={db} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-neutral-950">Outstanding questions</h3>
                <Facts facts={c.outstandingQuestions} empty="No open questions are recorded in the selected records." brief={brief} db={db} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-neutral-950">Not found in the selected records</h3>
                {c.missingInformation.length ? (
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-neutral-800">{c.missingInformation.map((m) => <li key={m}>{m}</li>)}</ul>
                ) : <p className="text-sm text-neutral-500">Nothing listed.</p>}
              </div>
            </section>
            {brief.warnings.length > 0 && (
              <details className="mt-5 text-xs text-neutral-600">
                <summary className="cursor-pointer font-medium text-neutral-700">{brief.warnings.length} statement{brief.warnings.length === 1 ? ' was' : 's were'} removed by the source checks</summary>
                <ul className="mt-1 list-disc pl-5">{brief.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </details>
            )}
          </Card>

          <Card title={`Sources used (${brief.sources.length})`}>
            <ol className="space-y-1.5 text-sm">
              {brief.sources.map((s) => {
                const href = sourceHref(db, s.kind, s.recordId);
                const change = fresh.changed.find((ch) => ch.label === s.label);
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-2">
                    <Badge>{s.id}</Badge>
                    {href ? <Link to={href} className="text-ivey-700 hover:underline">{s.label}</Link> : <span className="text-neutral-600">{s.label}</span>}
                    {change && <Badge className="bg-amber-50 text-amber-900 ring-amber-300">{change.why} since</Badge>}
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={<span className="flex items-center gap-2">AI suggestions <Badge className="bg-violet-50 text-violet-800 ring-violet-200">Review before use</Badge></span>}>
            {(c.suggestionChecks?.length ?? 0) > 0 && (
              <div role="note" className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                <p className="font-semibold">Checked against your records</p>
                <ul className="mt-1 list-disc pl-5">{c.suggestionChecks!.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            )}
            <h3 className="text-sm font-semibold text-neutral-950">Meeting objective</h3>
            <p className="mt-1 text-sm text-neutral-800">{c.meetingObjective || <span className="text-neutral-500">No objective suggested.</span>}</p>

            <h3 className="mt-6 text-sm font-semibold text-neutral-950">Suggested next steps</h3>
            <p className="mt-0.5 text-xs text-neutral-500">Tick the ones you want, adjust the wording, and set a due date. Nothing is created until you confirm.</p>
            {steps.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">No next steps suggested.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {steps.map((s, i) => (
                  <li key={i} className={`rounded-md border p-3 ${s.use ? 'border-ivey-300 bg-ivey-50/40' : 'border-neutral-200'}`}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" aria-label={`Use step ${i + 1}`} checked={s.use} onChange={(e) => setSteps((l) => l.map((x, j) => (j === i ? { ...x, use: e.target.checked } : x)))} className="mt-2.5 h-4 w-4 accent-ivey-700" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <input aria-label={`Wording for step ${i + 1}`} value={s.text} onChange={(e) => setSteps((l) => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className={`${inputClass} py-1.5`} />
                        {c.nextSteps[i]?.why && <p className="text-xs text-neutral-500">Why: {c.nextSteps[i].why}</p>}
                        {s.use && (
                          <label className="flex items-center gap-2 text-xs text-neutral-700">
                            Due date
                            <input type="date" aria-label={`Due date for step ${i + 1}`} value={s.due} onChange={(e) => setSteps((l) => l.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} className={`${inputClass} w-auto py-1`} />
                            {!s.due && <span className="text-amber-800">required</span>}
                          </label>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={() => setConfirmTasks(true)} disabled={!stepsReady}>
                {chosenSteps.length ? `Create ${chosenSteps.length} follow-up${chosenSteps.length === 1 ? '' : 's'}…` : 'Create follow-ups…'}
              </Button>
            </div>
            {createdTasks.length > 0 && (
              <div className="mt-3 rounded-md bg-ivey-50 px-3 py-2 text-xs text-ivey-900">
                <p className="font-semibold">Follow-ups created from this brief</p>
                <ul className="mt-1 list-disc pl-5">{createdTasks.map((t) => <li key={t.id}>{t.title} · due {formatDate(t.dueDate)}{t.status === 'done' ? ' · done' : ''}</li>)}</ul>
                <Link to="/follow-ups" className="mt-1 inline-block font-medium underline">Open follow-ups</Link>
              </div>
            )}
          </Card>

          <Card title="Opening script" action={<CopyButton text={edits.openingScript} what="Opening script" />}>
            <textarea aria-label="Opening script" rows={6} value={edits.openingScript} onChange={(e) => setEdit('openingScript', e.target.value)} className={inputClass} />
            <p className="mt-1 text-xs text-neutral-500">Suggested language. Review and edit before use.</p>
          </Card>

          <Card title="Talking points" action={<CopyButton text={edits.talkingPoints} what="Talking points" />}>
            <textarea aria-label="Talking points" rows={7} value={edits.talkingPoints} onChange={(e) => setEdit('talkingPoints', e.target.value)} className={inputClass} />
            <p className="mt-1 text-xs text-neutral-500">One point per line.</p>
          </Card>

          <Card title="Follow-up email draft" action={<CopyButton text={`Subject: ${edits.emailSubject}\n\n${edits.emailBody}`} what="Email draft" />}>
            <label className="mb-1 block text-xs font-medium text-neutral-700" htmlFor="draft-subject">Subject</label>
            <input id="draft-subject" value={edits.emailSubject} onChange={(e) => setEdit('emailSubject', e.target.value)} className={inputClass} />
            <label className="mt-3 mb-1 block text-xs font-medium text-neutral-700" htmlFor="draft-body">Message</label>
            <textarea id="draft-body" rows={9} value={edits.emailBody} onChange={(e) => setEdit('emailBody', e.target.value)} className={inputClass} />
            <p className="mt-1 text-xs text-neutral-500">Draft only. Nothing is sent: copy it into your email program if you want to use it.</p>
          </Card>

          <p className="flex items-center justify-between px-1 text-xs text-neutral-500">
            <span>{saveState === 'saving' ? 'Saving your edits…' : saveState === 'saved' ? 'Your edits are saved with this brief.' : 'Edits are saved automatically with this brief.'}</span>
            <button
              type="button"
              className="font-medium text-ivey-700 hover:underline"
              onClick={() => setEdits({ openingScript: c.openingScript, talkingPoints: c.talkingPoints.join('\n'), emailSubject: c.followUpEmail.subject, emailBody: c.followUpEmail.body })}
            >
              Reset drafts to the original suggestions
            </button>
          </p>
        </div>
      </div>

      <Modal open={confirmTasks} onClose={() => setConfirmTasks(false)} title="Create these follow-ups?">
        <ul className="space-y-2 text-sm">
          {chosenSteps.map((s) => (
            <li key={s.text} className="rounded-md bg-neutral-50 px-3 py-2"><span className="font-medium text-neutral-900">{s.text}</span><span className="block text-xs text-neutral-600">Due {s.due ? formatDate(s.due) : '—'}{company ? ` · ${company.name}` : ''}{contact ? ` · ${fullName(contact)}` : ''}{app ? ` · ${app.title}` : ''}</span></li>
          ))}
        </ul>
        <div className="-mx-6 mt-6 -mb-5 flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-6 py-4">
          <Button variant="secondary" onClick={() => setConfirmTasks(false)}>Cancel</Button>
          <Button onClick={createTasks}>Create follow-ups</Button>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this brief?"
        message="The brief and your edited drafts are removed. The records it was based on, and any follow-ups you created from it, are not affected."
        confirmLabel="Delete brief"
        onConfirm={async () => { setConfirmDelete(false); await data.deleteBrief(brief.id); notify('Brief deleted.'); navigate('/prep'); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
