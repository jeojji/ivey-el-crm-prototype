// "Suggest details with local AI" panel for the Add email form. Suggestions are proposals only:
// each is editable, shows the email excerpt it came from, and is copied into the form only when
// Lauren clicks Apply. Nothing is saved from here.
import { useEffect, useRef, useState } from 'react';
import { checkLocalAi, extractEmail, type AiAvailability } from '../ai/client';
import { FIELD_KEYS, FIELD_LABELS, type EmailInput, type Extraction, type FieldKey } from '../ai/extraction';
import { APPLICATION_PROJECT_TYPES, TERM_SEASONS } from '../lib/options';
import { Badge, Button, inputClass } from './ui';
import { Icon } from './Icon';

export interface AiApply {
  contactName?: string;
  contactEmail?: string;
  contactJobTitle?: string;
  companyName?: string;
  forwarded?: boolean;
  projectTitle?: string;
  projectNeed?: string;
  projectType?: string;
  termSeason?: string;
  termYear?: string;
  missingInformation?: string[];
  meta: { model: string; extractedAt: string; appliedFields: string[] };
}

type Run =
  | { state: 'idle' }
  | { state: 'running'; startedAt: number }
  | { state: 'error'; message: string }
  | { state: 'result'; extraction: Extraction; warnings: string[]; model: string; durationMs: number; truncated: boolean; at: string };

export function AiAssist({ input, onApply }: { input: EmailInput; onApply: (a: AiApply) => void }) {
  const [availability, setAvailability] = useState<AiAvailability>({ state: 'checking' });
  const [run, setRun] = useState<Run>({ state: 'idle' });
  const [values, setValues] = useState<Record<FieldKey, string>>(() => Object.fromEntries(FIELD_KEYS.map((k) => [k, ''])) as Record<FieldKey, string>);
  const [use, setUse] = useState<Record<string, boolean>>({});
  const [elapsed, setElapsed] = useState(0);
  const [applied, setApplied] = useState<number | null>(null);
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    checkLocalAi().then(setAvailability);
  }, []);

  useEffect(() => {
    if (run.state !== 'running') return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - run.startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [run]);

  async function start() {
    const ctrl = new AbortController();
    cancelRef.current = ctrl;
    setApplied(null);
    setElapsed(0);
    setRun({ state: 'running', startedAt: Date.now() });
    const res = await extractEmail(input, ctrl.signal);
    if (ctrl.signal.aborted) return setRun({ state: 'idle' });
    if (!res.ok) return setRun({ state: 'error', message: res.message });
    const x = res.extraction;
    setValues(Object.fromEntries(FIELD_KEYS.map((k) => [k, x[k].value])) as Record<FieldKey, string>);
    setUse({ ...Object.fromEntries(FIELD_KEYS.map((k) => [k, !!x[k].value])), forwarded: x.isForwarded, missing: false });
    setRun({ state: 'result', extraction: x, warnings: res.warnings, model: res.model, durationMs: res.durationMs, truncated: res.truncated, at: new Date().toISOString() });
  }

  function apply() {
    if (run.state !== 'result') return;
    const a: AiApply = { meta: { model: run.model, extractedAt: run.at, appliedFields: [] } };
    for (const k of FIELD_KEYS) {
      if (!use[k]) continue;
      a[k] = values[k].trim();
      a.meta.appliedFields.push(k);
    }
    if (use.forwarded && run.extraction.isForwarded) {
      a.forwarded = true;
      a.meta.appliedFields.push('forwarded');
    }
    if (use.missing && run.extraction.missingInformation.length) {
      a.missingInformation = run.extraction.missingInformation;
      a.meta.appliedFields.push('missingInformation');
    }
    onApply(a);
    setApplied(a.meta.appliedFields.length);
  }

  const canRun = input.originalText.trim().length > 0;

  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-4 lg:col-span-2" aria-labelledby="ai-assist-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="ai-assist-title" className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
            Local AI suggestions <Badge>optional</Badge>
          </h3>
          <p className="mt-0.5 text-xs text-neutral-600">
            {availability.state === 'checking' && 'Checking for a local model…'}
            {availability.state === 'available' && <>Runs on this computer with <strong className="font-semibold">{availability.model}</strong>. The email never leaves this computer. Suggestions are proposals: check each one.</>}
            {availability.state === 'demo' && 'Not available in the online demo. Local AI only runs on a computer set up with Ollama (see the setup guide). Fill in the details by hand.'}
            {availability.state === 'unavailable' && <>Local AI is unavailable: {availability.reason} You can fill in the details by hand.</>}
          </p>
        </div>
        {availability.state === 'available' && run.state !== 'running' && (
          <Button variant="secondary" icon="activity" onClick={start} disabled={!canRun}>
            {run.state === 'result' ? 'Suggest again' : 'Suggest details with local AI'}
          </Button>
        )}
        {availability.state === 'unavailable' && (
          <Button variant="ghost" size="sm" onClick={() => { setAvailability({ state: 'checking' }); checkLocalAi().then(setAvailability); }}>Check again</Button>
        )}
      </div>

      {run.state === 'running' && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm text-neutral-700 ring-1 ring-neutral-200" role="status">
          <span>Reading the email on this computer… {elapsed}s {elapsed > 20 && '(the first run can take longer while the model loads)'}</span>
          <Button size="sm" variant="secondary" onClick={() => { cancelRef.current?.abort(); setRun({ state: 'idle' }); }}>Cancel</Button>
        </div>
      )}

      {run.state === 'error' && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          {run.message}
        </p>
      )}

      {run.state === 'result' && (
        <div className="mt-4 space-y-4">
          {run.extraction.suspiciousInstructions.length > 0 && (
            <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
              <p className="flex items-center gap-2 font-semibold"><Icon name="alert" className="h-4 w-4 text-amber-700" />This email contains text that looks like instructions to an AI</p>
              <p className="mt-0.5 text-xs">It was treated as part of the email, not followed, and nothing below was taken from it:</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {run.extraction.suspiciousInstructions.map((q) => <li key={q}>“{q}”</li>)}
              </ul>
            </div>
          )}

          <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Suggested details</caption>
              <thead className="bg-neutral-50 text-xs text-neutral-600">
                <tr>
                  <th scope="col" className="w-14 px-3 py-2 font-semibold">Use</th>
                  <th scope="col" className="w-40 px-3 py-2 font-semibold">Field</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Suggested value (editable) and where it came from</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {run.extraction.isForwarded && (
                  <tr>
                    <td className="px-3 py-2.5 align-top"><input type="checkbox" aria-label="Use: forwarded" checked={!!use.forwarded} onChange={(e) => setUse((u) => ({ ...u, forwarded: e.target.checked }))} className="h-4 w-4 accent-ivey-700" /></td>
                    <td className="px-3 py-2.5 align-top font-medium text-neutral-900">Forwarded email</td>
                    <td className="px-3 py-2.5 text-neutral-700">
                      Mark as forwarded. The contact below is the original sender.
                      <Evidence text={run.extraction.forwardedEvidence} />
                    </td>
                  </tr>
                )}
                {FIELD_KEYS.map((k) => {
                  const ev = run.extraction[k].evidence;
                  const control =
                    k === 'projectType' || k === 'termSeason' ? (
                      <select aria-label={`Suggested ${FIELD_LABELS[k]}`} value={values[k]} onChange={(e) => { setValues((v) => ({ ...v, [k]: e.target.value })); setUse((u) => ({ ...u, [k]: !!e.target.value })); }} className={`${inputClass} py-1.5`}>
                        <option value="">Not stated</option>
                        {(k === 'projectType' ? APPLICATION_PROJECT_TYPES : TERM_SEASONS).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : k === 'projectNeed' ? (
                      <textarea aria-label={`Suggested ${FIELD_LABELS[k]}`} rows={2} value={values[k]} onChange={(e) => { setValues((v) => ({ ...v, [k]: e.target.value })); setUse((u) => ({ ...u, [k]: !!e.target.value.trim() })); }} className={`${inputClass} py-1.5`} placeholder="Not stated" />
                    ) : (
                      <input aria-label={`Suggested ${FIELD_LABELS[k]}`} value={values[k]} onChange={(e) => { setValues((v) => ({ ...v, [k]: e.target.value })); setUse((u) => ({ ...u, [k]: !!e.target.value.trim() })); }} className={`${inputClass} py-1.5`} placeholder="Not stated" />
                    );
                  return (
                    <tr key={k}>
                      <td className="px-3 py-2.5 align-top"><input type="checkbox" aria-label={`Use: ${FIELD_LABELS[k]}`} checked={!!use[k]} disabled={!values[k].trim()} onChange={(e) => setUse((u) => ({ ...u, [k]: e.target.checked }))} className="h-4 w-4 accent-ivey-700" /></td>
                      <td className="px-3 py-2.5 align-top font-medium text-neutral-900">{FIELD_LABELS[k]}</td>
                      <td className="px-3 py-2.5">
                        {control}
                        {ev ? <Evidence text={ev} /> : !values[k] && <p className="mt-1 text-xs text-neutral-500">Not stated in the email. Left blank.</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {run.extraction.missingInformation.length > 0 && (
            <div className="rounded-md bg-white px-3 py-2.5 text-sm ring-1 ring-neutral-200">
              <p className="font-medium text-neutral-900">Missing information to ask about</p>
              <ul className="mt-1 list-disc pl-5 text-neutral-700">
                {run.extraction.missingInformation.map((m) => <li key={m}>{m}</li>)}
              </ul>
              <label className="mt-2 flex items-center gap-2 text-xs text-neutral-700">
                <input type="checkbox" checked={!!use.missing} onChange={(e) => setUse((u) => ({ ...u, missing: e.target.checked }))} className="h-4 w-4 accent-ivey-700" />
                Add this list to my notes
              </label>
            </div>
          )}

          {run.warnings.length > 0 && (
            <details className="text-xs text-neutral-600">
              <summary className="cursor-pointer font-medium text-neutral-700">{run.warnings.length} suggestion{run.warnings.length === 1 ? ' was' : 's were'} removed by the safety checks</summary>
              <ul className="mt-1 list-disc pl-5">{run.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </details>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-neutral-500">
              {run.model} · {(run.durationMs / 1000).toFixed(1)}s{run.truncated ? ' · long email: only the first part was read' : ''}. Applying fills the form only. You'll still choose records and confirm before anything is saved.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setRun({ state: 'idle' })}>Discard suggestions</Button>
              <Button size="sm" onClick={apply} disabled={!Object.values(use).some(Boolean)}>Apply selected to the form</Button>
            </div>
          </div>
          {applied !== null && (
            <p role="status" className="flex items-center gap-1.5 text-sm text-ivey-800"><Icon name="check" className="h-4 w-4" />Applied {applied} suggestion{applied === 1 ? '' : 's'}. You can still change anything.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Evidence({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="mt-1 text-xs text-neutral-600">
      <span className="font-medium text-neutral-500">From the email: </span>
      <q className="rounded bg-sky-50 px-1 text-sky-950">{text}</q>
    </p>
  );
}
