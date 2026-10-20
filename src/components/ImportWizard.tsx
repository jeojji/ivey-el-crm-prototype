import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { parseCsv, readFileText } from '../lib/csv';
import { createId } from '../lib/id';
import { autoMap, detectKind, fieldsFor, type ImportKind } from '../import/fields';
import {
  buildOperations,
  changesSomething,
  defaultCompanyDecision,
  defaultRowDecision,
  isInstructionsRow,
  matchRows,
  outcomeFor,
  prepareFile,
  type CompanyDecision,
  type CompanyMatch,
  type ConflictChoice,
  type FieldChange,
  type ImportSummary,
  type PlanRow,
  type RowDecision,
  type RowOutcome,
  type Value,
} from '../import/plan';
import { Badge, Button, inputClass, filterSelectClass } from './ui';
import { Icon } from './Icon';

type Step = 'choose' | 'map' | 'preview' | 'done';
type Filter = 'all' | 'new' | 'update' | 'conflict' | 'unchanged' | 'choose' | 'skip' | 'flagged';

const KIND_LABEL: Record<ImportKind, { noun: string; plural: string; template: string }> = {
  companies: { noun: 'company', plural: 'companies', template: 'Accounts template (SF_Import_Accounts)' },
  contacts: { noun: 'contact', plural: 'contacts', template: 'Contacts template (SF_Import_Contacts)' },
};

const CHOICE_LABEL: Record<ConflictChoice, string> = {
  keep: 'Keep current',
  file: 'Use file value',
  combine: 'Keep both (add new values)',
  append: 'Add file note below current',
};

function show(v: Value | null | undefined): string {
  if (v == null || v === '') return '—';
  return Array.isArray(v) ? v.join('; ') : String(v);
}

export function ImportWizard() {
  const data = useData();
  const { notify } = useToast();
  const db = data.database;

  const [step, setStep] = useState<Step>('choose');
  const [kind, setKind] = useState<ImportKind>('companies');
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<(string | null)[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  // Preview state. Matching uses a snapshot of the data taken when the preview opens, so the
  // list doesn't reshuffle while the user is making choices.
  const [snapshot, setSnapshot] = useState(db);
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [decisions, setDecisions] = useState<RowDecision[]>([]);
  const [companyDecisions, setCompanyDecisions] = useState<Record<string, CompanyDecision>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);

  const prepared = useMemo(() => (table.length ? prepareFile(kind, table, mapping) : null), [kind, table, mapping]);

  function reset() {
    setStep('choose');
    setFileName('');
    setTable([]);
    setNotice(null);
    setReadError(null);
    setResult(null);
    setFilter('all');
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setReadError(null);
    setNotice(null);
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setReadError(`“${file.name}” isn't a .csv file. In Excel, use File → Save As → CSV UTF-8.`);
      return;
    }
    try {
      const parsed = parseCsv(await readFileText(file));
      if (parsed.length < 2) {
        setReadError('This file has no rows below the header row.');
        return;
      }
      const detected = detectKind(parsed[0]);
      let useKind = kind;
      if (detected && detected !== kind) {
        useKind = detected;
        setNotice(`This looks like the ${KIND_LABEL[detected].template}, so it will be imported as ${KIND_LABEL[detected].plural}.`);
      }
      setKind(useKind);
      setFileName(file.name);
      setTable(parsed);
      setMapping(autoMap(useKind, parsed[0]));
      setStep('map');
    } catch {
      setReadError("This file couldn't be read. Check that it's a CSV saved from Excel or Salesforce.");
    }
  }

  function openPreview() {
    if (!prepared) return;
    const planRows = matchRows(prepared, db);
    setSnapshot(db);
    setRows(planRows);
    setDecisions(planRows.map(defaultRowDecision));
    const cd: Record<string, CompanyDecision> = {};
    for (const r of planRows) if (r.company && !(r.company.key in cd)) cd[r.company.key] = defaultCompanyDecision(r.company);
    setCompanyDecisions(cd);
    setFilter('all');
    setStep('preview');
  }

  const outcomes: RowOutcome[] = useMemo(
    () => rows.map((r, i) => outcomeFor(kind, r, decisions[i], snapshot, companyDecisions)),
    [rows, decisions, snapshot, companyDecisions, kind],
  );

  const needsChoice = (i: number) => {
    const r = rows[i];
    if (r.errors.length || r.duplicateOfLine !== undefined || !decisions[i]?.include) return false;
    if (decisions[i].target === null) return true;
    return !!r.company && r.company.status !== 'none' && (companyDecisions[r.company.key] ?? null) === null;
  };
  const hasConflict = (o: RowOutcome) => o.action === 'update' && o.changes.some((c) => c.kind === 'conflict');

  const counts = useMemo(() => {
    const c = { all: rows.length, new: 0, update: 0, conflict: 0, unchanged: 0, choose: 0, skip: 0, flagged: 0 };
    outcomes.forEach((o, i) => {
      if (o.action === 'create') c.new++;
      if (changesSomething(o, decisions[i])) c.update++;
      if (hasConflict(o)) c.conflict++;
      if (o.action === 'unchanged' || (o.action === 'update' && !changesSomething(o, decisions[i]))) c.unchanged++;
      if (needsChoice(i)) c.choose++;
      else if (o.action === 'skip') c.skip++;
      if (rows[i].unknown.length) c.flagged++;
    });
    return c;
  }, [outcomes, rows, decisions, companyDecisions]);

  const visible = rows
    .map((r, i) => ({ r, i, o: outcomes[i] }))
    .filter(({ r, i, o }) => {
      switch (filter) {
        case 'new': return o.action === 'create';
        case 'update': return changesSomething(o, decisions[i]);
        case 'conflict': return hasConflict(o);
        case 'unchanged': return o.action === 'unchanged' || (o.action === 'update' && !changesSomething(o, decisions[i]));
        case 'choose': return needsChoice(i);
        case 'skip': return o.action === 'skip' && !needsChoice(i);
        case 'flagged': return r.unknown.length > 0;
        default: return true;
      }
    });

  const setDecision = (i: number, patch: Partial<RowDecision>) =>
    setDecisions((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  async function runImport() {
    setSaving(true);
    try {
      const { ops, summary } = buildOperations(kind, rows, decisions, snapshot, companyDecisions, createId);
      await data.saveBatch({
        creates: { companies: ops.createCompanies, contacts: ops.createContacts },
        updates: { companies: ops.updateCompanies, contacts: ops.updateContacts },
      });
      setResult(summary);
      setStep('done');
      notify(`Import complete: ${summary.created} added, ${summary.updated} updated.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'The import failed. Nothing was saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function backupFirst() {
    try {
      await data.downloadBackup('current');
      notify('Backup saved to your Downloads folder.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not create the backup.', 'error');
    }
  }

  // ------------------------------------------------------------------ steps

  if (step === 'choose') {
    return (
      <div>
        <fieldset>
          <legend className="text-sm font-medium text-neutral-800">What are you importing?</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(['companies', 'contacts'] as const).map((k, n) => (
              <label key={k} className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${kind === k ? 'border-ivey-700 bg-ivey-50/60' : 'border-neutral-300 hover:bg-neutral-50'}`}>
                <input type="radio" name="import-kind" checked={kind === k} onChange={() => setKind(k)} className="mt-1 accent-ivey-700" />
                <span>
                  <span className="block text-sm font-semibold text-neutral-900">{n + 1}. {k === 'companies' ? 'Companies' : 'Contacts'}</span>
                  <span className="mt-0.5 block text-xs text-neutral-600">
                    {k === 'companies'
                      ? 'Salesforce Accounts template. Import these first.'
                      : 'Salesforce Contacts template. Matched to companies by Account Name.'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-ivey-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-ivey-800 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ivey-600">
            <Icon name="upload" className="h-4 w-4" />
            Choose CSV file…
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
          </label>
          <span className="text-xs text-neutral-500">The file is read in this browser only. Nothing is uploaded.</span>
        </div>
        {readError && <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm font-medium text-red-700"><Icon name="alert" className="h-4 w-4" />{readError}</p>}
      </div>
    );
  }

  if (step === 'map' && prepared) {
    const fields = fieldsFor(kind);
    const firstData = table.slice(1).find((r) => !isInstructionsRow(r)) ?? [];
    return (
      <div>
        <StepHeader fileName={fileName} kind={kind} onReset={reset} />
        {notice && <Notice tone="info">{notice}</Notice>}
        <div className="mb-4 space-y-1 text-sm text-neutral-700">
          <p>Check how each column will be imported. Columns are matched by their header. Change any that are wrong.</p>
          {prepared.instructionsLine && (
            <p className="flex items-center gap-1.5 text-neutral-600"><Icon name="check" className="h-4 w-4 text-ivey-700" />Row 2 is the template's instructions row and will be skipped.</p>
          )}
          <p className="text-neutral-600">{prepared.rows.length} data row{prepared.rows.length === 1 ? '' : 's'} found.</p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold tracking-wide text-neutral-600 uppercase">
              <tr>
                <th scope="col" className="px-4 py-2.5">Column in file</th>
                <th scope="col" className="px-4 py-2.5">First value</th>
                <th scope="col" className="px-4 py-2.5">Import as</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {table[0].map((header, col) => (
                <tr key={col}>
                  <td className="px-4 py-2 font-medium text-neutral-900">{header || <em className="text-neutral-500">(blank header)</em>}</td>
                  <td className="max-w-[16rem] truncate px-4 py-2 text-neutral-600" title={firstData[col]}>{firstData[col] || '—'}</td>
                  <td className="px-4 py-2">
                    <select
                      aria-label={`Import column ${header} as`}
                      value={mapping[col] ?? ''}
                      onChange={(e) => setMapping((m) => m.map((v, j) => (j === col ? e.target.value || null : v)))}
                      className={`${inputClass} py-1.5 ${mapping[col] ? '' : 'text-neutral-500'}`}
                    >
                      <option value="">Don't import</option>
                      {fields.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}{f.required ? ' (required)' : ''}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {prepared.mappingErrors.length > 0 && (
          <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {prepared.mappingErrors.map((e) => <p key={e}>{e}</p>)}
          </div>
        )}
        <div className="mt-5 flex justify-between">
          <Button variant="secondary" onClick={reset}>Choose a different file</Button>
          <Button onClick={openPreview} disabled={prepared.mappingErrors.length > 0}>Review import</Button>
        </div>
      </div>
    );
  }

  if (step === 'done' && result) {
    return (
      <div>
        <div className="flex items-start gap-3 rounded-lg border border-ivey-200 bg-ivey-50/60 p-4">
          <Icon name="check" className="mt-0.5 h-5 w-5 text-ivey-700" />
          <div className="text-sm text-neutral-800">
            <p className="font-semibold text-neutral-950">Import complete</p>
            <p className="mt-1">
              {result.created} {KIND_LABEL[kind].plural} added · {result.updated} updated · {result.unchanged} already up to date · {result.skipped} skipped
              {result.companiesCreated > 0 && ` · ${result.companiesCreated} new compan${result.companiesCreated === 1 ? 'y' : 'ies'} created`}
            </p>
            <p className="mt-1 text-neutral-600">Values outside Lauren's lists were kept as written. Use the "Needs review" filter to find them.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to={kind === 'companies' ? '/companies' : '/contacts'} className="inline-flex items-center rounded-md bg-ivey-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-ivey-800">
            View {KIND_LABEL[kind].plural}
          </Link>
          <Button variant="secondary" onClick={() => { const next = kind === 'companies' ? 'contacts' : kind; reset(); setKind(next); }}>{kind === 'companies' ? 'Import contacts next' : 'Import another file'}</Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- preview
  const companyGroups = kind === 'contacts' ? groupCompanies(rows, decisions) : [];
  const unresolvedGroups = companyGroups.filter((g) => g.match.status !== 'matched' && g.match.status !== 'none');
  const toWrite = counts.new + counts.update;

  return (
    <div>
      <StepHeader fileName={fileName} kind={kind} onReset={reset} />
      <p className="mb-4 text-sm text-neutral-700">
        Nothing has been saved yet. Review what will happen, make any choices, then import.
        Blank cells never clear existing values, and existing notes are only changed if you choose.
      </p>

      {unresolvedGroups.length > 0 && (
        <section className="mb-6 rounded-lg border border-amber-300 bg-amber-50/70 p-4" aria-labelledby="company-matching">
          <h3 id="company-matching" className="text-sm font-semibold text-amber-950">Company matching: {unresolvedGroups.length} Account Name{unresolvedGroups.length === 1 ? '' : 's'} need{unresolvedGroups.length === 1 ? 's' : ''} your choice</h3>
          <p className="mt-0.5 text-xs text-amber-900">Contacts with an unresolved Account Name are skipped until you choose.</p>
          <ul className="mt-3 space-y-3">
            {unresolvedGroups.map((g) => (
              <CompanyResolver
                key={g.match.key}
                group={g}
                value={companyDecisions[g.match.key] ?? null}
                onChange={(v) => setCompanyDecisions((d) => ({ ...d, [g.match.key]: v }))}
                companies={snapshot.companies}
              />
            ))}
          </ul>
        </section>
      )}
      {kind === 'contacts' && companyGroups.length > unresolvedGroups.length && (
        <p className="mb-4 flex items-center gap-1.5 text-xs text-neutral-600">
          <Icon name="check" className="h-3.5 w-3.5 text-ivey-700" />
          {companyGroups.filter((g) => g.match.status === 'matched').length} Account Name{companyGroups.filter((g) => g.match.status === 'matched').length === 1 ? '' : 's'} matched an existing company.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Show rows">
        {(
          [
            ['all', 'All rows'],
            ['new', 'New'],
            ['update', 'Updates'],
            ['conflict', 'Conflicts'],
            ['choose', 'Needs your choice'],
            ['unchanged', 'Already up to date'],
            ['skip', 'Skipped'],
            ['flagged', 'Flagged values'],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${filter === id ? 'border-ivey-700 bg-ivey-700 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'}`}
          >
            {label}
            <span className={`tabular-nums ${filter === id ? 'text-ivey-100' : (id === 'choose' || id === 'conflict') && counts[id] > 0 ? 'font-semibold text-amber-700' : 'text-neutral-500'}`}>{counts[id]}</span>
          </button>
        ))}
      </div>

      <ol className="space-y-3">
        {visible.map(({ r, i, o }) => (
          <RowCard
            key={r.line}
            kind={kind}
            row={r}
            outcome={o}
            decision={decisions[i]}
            needsChoice={needsChoice(i)}
            snapshot={snapshot}
            companyDecision={r.company ? companyDecisions[r.company.key] ?? null : undefined}
            onDecision={(patch) => setDecision(i, patch)}
          />
        ))}
        {visible.length === 0 && <li className="rounded-lg border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-600">No rows in this view.</li>}
      </ol>

      <div className="sticky bottom-0 -mx-5 mt-6 -mb-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-white/95 px-5 py-4 backdrop-blur">
        <p className="text-sm text-neutral-700">
          <strong className="font-semibold text-neutral-950">{counts.new}</strong> new · <strong className="font-semibold text-neutral-950">{counts.update}</strong> updated ·{' '}
          {counts.unchanged} already up to date · {counts.skip + counts.choose} skipped
          {counts.choose > 0 && <span className="text-amber-800"> ({counts.choose} waiting for your choice)</span>}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" icon="download" onClick={backupFirst}>Download backup first</Button>
          <Button onClick={runImport} disabled={saving || toWrite === 0}>
            {saving ? 'Importing…' : toWrite === 0 ? 'Nothing to import' : `Import ${toWrite} ${toWrite === 1 ? KIND_LABEL[kind].noun : KIND_LABEL[kind].plural}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function StepHeader({ fileName, kind, onReset }: { fileName: string; kind: ImportKind; onReset: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
      <p className="flex items-center gap-2 text-sm text-neutral-800">
        <Icon name="note" className="h-4 w-4 text-neutral-500" />
        <span className="font-medium">{fileName}</span>
        <Badge>{KIND_LABEL[kind].plural}</Badge>
      </p>
      <button type="button" onClick={onReset} className="text-sm font-medium text-ivey-700 hover:underline">Start over</button>
    </div>
  );
}

function Notice({ tone, children }: { tone: 'info' | 'warn'; children: ReactNode }) {
  return (
    <p className={`mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${tone === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-sky-200 bg-sky-50 text-sky-950'}`}>
      <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
      {children}
    </p>
  );
}

interface CompanyGroup {
  match: CompanyMatch;
  rows: number;
}

function groupCompanies(rows: PlanRow[], decisions: RowDecision[]): CompanyGroup[] {
  const map = new Map<string, CompanyGroup>();
  rows.forEach((r, i) => {
    if (!r.company || r.errors.length || r.duplicateOfLine !== undefined || !decisions[i]?.include) return;
    const g = map.get(r.company.key);
    if (g) g.rows++;
    else map.set(r.company.key, { match: r.company, rows: 1 });
  });
  return [...map.values()];
}

function CompanyResolver({ group, value, onChange, companies }: {
  group: CompanyGroup;
  value: CompanyDecision;
  onChange: (v: CompanyDecision) => void;
  companies: { id: string; name: string }[];
}) {
  const { match } = group;
  const why =
    match.status === 'ambiguous'
      ? 'Several companies match this name.'
      : match.status === 'possible'
        ? 'A company with a similar name exists.'
        : 'No company with this name exists yet.';
  const others = [...companies].filter((c) => !match.candidates.some((m) => m.id === c.id)).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white px-3 py-2.5 ring-1 ring-amber-200">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-900">“{match.accountName}”</p>
        <p className="text-xs text-neutral-600">{why} Used by {group.rows} contact{group.rows === 1 ? '' : 's'}.</p>
      </div>
      <select
        aria-label={`Company for Account Name ${match.accountName}`}
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || null) as CompanyDecision)}
        className={`${filterSelectClass} max-w-xs ${value ? '' : 'border-amber-500'}`}
      >
        <option value="">Choose…</option>
        {match.candidates.length > 0 && (
          <optgroup label="Suggested matches">
            {match.candidates.map((c) => <option key={c.id} value={c.id}>Use “{c.label}”</option>)}
          </optgroup>
        )}
        <optgroup label="Other options">
          <option value="create">Create new company “{match.accountName}”</option>
          <option value="none">Import contacts without a company</option>
        </optgroup>
        {others.length > 0 && (
          <optgroup label="All companies">
            {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </optgroup>
        )}
      </select>
    </li>
  );
}

function RowCard({ kind, row, outcome, decision, needsChoice, snapshot, companyDecision, onDecision }: {
  kind: ImportKind;
  row: PlanRow;
  outcome: RowOutcome;
  decision: RowDecision;
  needsChoice: boolean;
  snapshot: { companies: { id: string; name: string }[]; contacts: { id: string; firstName: string; lastName: string }[] };
  companyDecision: CompanyDecision | undefined;
  onDecision: (patch: Partial<RowDecision>) => void;
}) {
  const blocked = row.errors.length > 0 || row.duplicateOfLine !== undefined;
  const existingName = (id: string) =>
    kind === 'companies'
      ? snapshot.companies.find((c) => c.id === id)?.name
      : (() => {
          const c = snapshot.contacts.find((x) => x.id === id);
          return c ? `${c.firstName} ${c.lastName}` : undefined;
        })();

  const badge = needsChoice
    ? { text: 'Needs your choice', tone: 'bg-amber-50 text-amber-900 ring-amber-300' }
    : outcome.action === 'create'
      ? { text: 'New', tone: 'bg-ivey-50 text-ivey-800 ring-ivey-200' }
      : outcome.action === 'update'
        ? changesSomething(outcome, decision)
          ? { text: outcome.changes.some((c) => c.kind === 'conflict') ? 'Update · has conflicts' : 'Update', tone: 'bg-sky-50 text-sky-800 ring-sky-200' }
          : { text: 'Conflicts · keeping current values', tone: 'bg-amber-50 text-amber-900 ring-amber-300' }
        : outcome.action === 'unchanged'
          ? { text: 'Already up to date', tone: 'bg-neutral-100 text-neutral-700 ring-neutral-200' }
          : { text: 'Skipped', tone: blocked ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-neutral-100 text-neutral-700 ring-neutral-200' };

  const fields = fieldsFor(kind);
  const newValues = Object.entries(row.values).filter(([k]) => k !== 'id');

  return (
    <li className={`rounded-lg border bg-white p-4 ${needsChoice ? 'border-amber-300' : blocked ? 'border-red-200' : 'border-neutral-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-950">
            <span className="text-xs font-normal text-neutral-500 tabular-nums">Row {row.line}</span>
            {row.label}
            <Badge className={badge.tone}>{badge.text}</Badge>
          </p>
          {row.match.status === 'matched' && decision.target !== 'new' && (
            <p className="mt-0.5 text-xs text-neutral-600">Matches existing {kind === 'companies' ? 'company' : 'contact'} “{existingName(row.match.matchId!)}” ({row.match.reason})</p>
          )}
          {kind === 'contacts' && row.company && row.company.status !== 'none' && (
            <p className="mt-0.5 text-xs text-neutral-600">
              Account Name “{row.company.accountName}” →{' '}
              {companyDecision === 'create'
                ? 'new company'
                : companyDecision === 'none'
                  ? 'no company'
                  : companyDecision
                    ? snapshot.companies.find((c) => c.id === companyDecision)?.name
                    : <span className="font-medium text-amber-800">not matched yet</span>}
            </p>
          )}
        </div>
        {!blocked && (
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={decision.include} onChange={(e) => onDecision({ include: e.target.checked })} className="h-4 w-4 accent-ivey-700" />
            Include
          </label>
        )}
      </div>

      {row.errors.map((e) => (
        <p key={e} className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-700"><Icon name="alert" className="h-4 w-4" />{e} This row won't be imported.</p>
      ))}
      {row.duplicateOfLine !== undefined && (
        <p className="mt-2 text-sm text-neutral-700">Same {kind === 'companies' ? 'company' : 'contact'} as row {row.duplicateOfLine} in this file, so it's skipped to avoid a duplicate.</p>
      )}

      {!blocked && decision.include && (row.match.status === 'possible' || row.match.status === 'ambiguous') && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-amber-50 px-3 py-2.5 text-sm">
          <span className="text-amber-950">
            {row.match.status === 'ambiguous' ? 'Several existing records could be this one.' : `Possible match: ${row.match.reason}.`} Choose what to do:
          </span>
          <select
            aria-label={`Match for row ${row.line}`}
            value={decision.target ?? ''}
            onChange={(e) => onDecision({ target: e.target.value || null, conflicts: {} })}
            className={`${filterSelectClass} max-w-sm`}
          >
            <option value="">Choose…</option>
            {row.match.candidates.map((c) => <option key={c.id} value={c.id}>Update existing “{c.label}”</option>)}
            <option value="new">Add as a new {kind === 'companies' ? 'company' : 'contact'}</option>
          </select>
        </div>
      )}

      {outcome.action === 'create' && (
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          {newValues.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-40 shrink-0 text-neutral-500">{fields.find((f) => f.key === k)?.label ?? k}</dt>
              <dd className="min-w-0 break-words whitespace-pre-line text-neutral-900">{show(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {outcome.action === 'update' && (
        <ChangeTable changes={outcome.changes} decision={decision} onChoice={(key, choice) => onDecision({ conflicts: { ...decision.conflicts, [key]: choice } })} companyName={(id) => snapshot.companies.find((c) => c.id === id)?.name} />
      )}

      {row.unknown.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-amber-900">Not in Lauren's lists, kept as written and flagged for review:</span>
          {row.unknown.map((u) => (
            <Badge key={u.label + u.value} className="bg-amber-50 text-amber-900 ring-amber-300">{u.label}: {u.value}</Badge>
          ))}
        </div>
      )}
      {row.warnings.map((w) => (
        <p key={w} className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-900"><Icon name="alert" className="mt-px h-3.5 w-3.5 shrink-0" />{w}</p>
      ))}
    </li>
  );
}

function ChangeTable({ changes, decision, onChoice, companyName }: {
  changes: FieldChange[];
  decision: RowDecision;
  onChoice: (key: string, choice: ConflictChoice) => void;
  companyName: (id: string) => string | undefined;
}) {
  const display = (c: FieldChange, v: Value | null) => (c.type === 'company' && typeof v === 'string' ? companyName(v) ?? 'new company' : show(v));
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead className="bg-neutral-50 text-neutral-600">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Field</th>
            <th scope="col" className="px-3 py-2 font-semibold">Current</th>
            <th scope="col" className="px-3 py-2 font-semibold">In file</th>
            <th scope="col" className="px-3 py-2 font-semibold">What happens</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {changes.map((c) => (
            <tr key={c.key} className={c.kind === 'conflict' ? 'bg-amber-50/40' : ''}>
              <td className="px-3 py-2 font-medium text-neutral-900">{c.label}</td>
              <td className="max-w-[14rem] px-3 py-2 break-words whitespace-pre-line text-neutral-700">{display(c, c.current)}</td>
              <td className="max-w-[14rem] px-3 py-2 break-words whitespace-pre-line text-neutral-900">{display(c, c.incoming)}</td>
              <td className="px-3 py-2">
                {c.kind === 'fill' ? (
                  <span className="text-ivey-800">Fills empty field</span>
                ) : (
                  <select
                    aria-label={`${c.label}: conflict choice`}
                    value={decision.conflicts[c.key] ?? 'keep'}
                    onChange={(e) => onChoice(c.key, e.target.value as ConflictChoice)}
                    className={`${inputClass} py-1 text-xs`}
                  >
                    {c.choices.map((ch) => <option key={ch} value={ch}>{CHOICE_LABEL[ch]}</option>)}
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
