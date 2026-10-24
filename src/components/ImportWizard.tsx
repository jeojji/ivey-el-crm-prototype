import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { useClearDraft, useDraft } from '../state/ImportDraftContext';
import { parseCsv, readFileText } from '../lib/csv';
import { createId } from '../lib/id';
import { fullName } from '../lib/selectors';
import { autoMap, detectKind, fieldsFor, getPath, type FieldDef, type ImportKind } from '../import/fields';
import {
  SAME_AS,
  SAME_ROW,
  buildOperations,
  changesSomething,
  defaultCompanyDecision,
  defaultRowDecision,
  isInstructionsRow,
  matchRows,
  originalCells,
  outcomeFor,
  parseRowCells,
  planCompanyGroups,
  prepareFile,
  resolveCompanyDecision,
  type CompanyDecision,
  type CompanyGroup,
  type ConflictChoice,
  type FieldChange,
  type ImportSummary,
  type PlanRow,
  type RowDecision,
  type RowEdits,
  type RowOutcome,
  type Value,
} from '../import/plan';
import type { Company, Contact, Database } from '../types';
import { Badge, Button, CheckboxGroupField, SelectField, TextAreaField, TextField, inputClass, filterSelectClass, picklist } from './ui';
import { Icon } from './Icon';
import { ConfirmDialog, Modal } from './Modal';

type Step = 'choose' | 'map' | 'preview' | 'done';
type Filter = 'all' | 'ready' | 'accept' | 'review' | 'conflict' | 'edited' | 'unchanged' | 'skip' | 'flagged';
/** What a row is waiting for, or what will happen to it. */
type RowState = 'ready' | 'accept' | 'review' | 'unchanged' | 'skip';
/** Where an Account Name's company link stands. */
type GroupState = 'ready' | 'accept' | 'review' | 'decided';

/** A choice the user made, with the match it was made for. If the match changes (e.g. after an edit), the choice is reset. */
type StoredRow = RowDecision & { sig: string };
type StoredCompany = { decision: CompanyDecision; sig: string };

const KIND_LABEL: Record<ImportKind, { noun: string; plural: string; template: string }> = {
  companies: { noun: 'company', plural: 'companies', template: 'Accounts template (SF_Import_Accounts)' },
  contacts: { noun: 'contact', plural: 'contacts', template: 'Contacts template (SF_Import_Contacts)' },
};

const CHOICE_LABEL: Record<ConflictChoice, string> = {
  keep: 'Keep current',
  file: 'Use proposed value',
  combine: 'Keep both (add new values)',
  append: 'Add proposed note below current',
};

function show(v: Value | null | undefined): string {
  if (v == null || v === '') return '—';
  return Array.isArray(v) ? v.join('; ') : String(v);
}

const rowSig = (r: PlanRow) => [r.match.status, r.match.matchId, r.match.candidates.map((c) => c.id).join(','), r.errors.length > 0, r.duplicateOfLine ?? ''].join('|');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function ImportWizard() {
  const data = useData();
  const { notify } = useToast();
  const db = data.database;
  const clearDraft = useClearDraft();

  // Everything about the import in progress is kept in a draft, so visiting another page and coming
  // back doesn't lose it. The uploaded file (`table`) is never changed: edits are stored separately.
  const [step, setStep] = useDraft<Step>('step', 'choose');
  const [kind, setKind] = useDraft<ImportKind>('kind', 'companies');
  const [fileName, setFileName] = useDraft('fileName', '');
  const [table, setTable] = useDraft<string[][]>('table', []);
  const [mapping, setMapping] = useDraft<(string | null)[]>('mapping', []);
  const [notice, setNotice] = useDraft<string | null>('notice', null);
  // Matching uses a snapshot of the data taken when the review opens, so the list doesn't reshuffle while choosing.
  const [snapshot, setSnapshot] = useDraft<Database | null>('snapshot', null);
  const [edits, setEdits] = useDraft<RowEdits>('edits', {});
  const [rowChoices, setRowChoices] = useDraft<Record<number, StoredRow>>('rowChoices', {});
  const [companyChoices, setCompanyChoices] = useDraft<Record<string, StoredCompany>>('companyChoices', {});
  const [filter, setFilter] = useDraft<Filter>('filter', 'all');
  const [result, setResult] = useDraft<ImportSummary | null>('result', null);

  const [restored] = useState(() => step === 'map' || step === 'preview');
  const [readError, setReadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<null | (() => void)>(null);

  const hasPendingWork = (step === 'map' || step === 'preview') && (Object.keys(edits).length > 0 || Object.keys(rowChoices).length > 0 || Object.keys(companyChoices).length > 0);

  // Warn before closing or reloading the tab while edits or choices haven't been imported.
  useEffect(() => {
    if (!hasPendingWork) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasPendingWork]);

  const base = snapshot ?? db;
  const prepared = useMemo(() => (table.length ? prepareFile(kind, table, mapping, edits) : null), [kind, table, mapping, edits]);
  const rows = useMemo(() => (prepared && step === 'preview' ? matchRows(prepared, base) : []), [prepared, step, base]);
  const decisions: StoredRow[] = rows.map((r) => {
    const stored = rowChoices[r.line];
    const sig = rowSig(r);
    return stored && stored.sig === sig ? stored : { ...defaultRowDecision(r), sig };
  });
  const groups = useMemo(() => (kind === 'contacts' ? planCompanyGroups(rows) : []), [rows, kind]);
  const groupByKey = new Map(groups.map((g) => [g.key, g]));
  const companyDecisions: Record<string, CompanyDecision> = {};
  for (const g of groups) {
    const stored = companyChoices[g.key];
    companyDecisions[g.key] = stored && stored.sig === g.signature ? stored.decision : defaultCompanyDecision(g.match);
  }

  function groupState(g: CompanyGroup): GroupState {
    const d = companyDecisions[g.key];
    if (d === null || d === undefined) return g.kind === 'accept' ? 'accept' : 'review';
    if (typeof d === 'string' && d.startsWith(SAME_AS)) {
      const target = groupByKey.get(d.slice(SAME_AS.length));
      if (resolveCompanyDecision(g.key, companyDecisions).decision == null) return target && target.kind === 'accept' ? 'accept' : 'review';
      return 'decided';
    }
    return g.kind === 'ready' && d === g.proposal ? 'ready' : 'decided';
  }

  const outcomes: RowOutcome[] = useMemo(
    () => rows.map((r, i) => outcomeFor(kind, r, decisions[i], base, companyDecisions)),
    // decisions/companyDecisions are rebuilt each render from the stored choices below.
    [rows, kind, base, rowChoices, companyChoices],
  );

  function rowState(i: number): RowState {
    const r = rows[i];
    const d = decisions[i];
    if (r.errors.length || r.duplicateOfLine !== undefined || !d.include) return 'skip';
    if (d.target === null) return 'review';
    const g = r.company && r.company.status !== 'none' ? groupByKey.get(r.company.key) : undefined;
    if (g) {
      const gs = groupState(g);
      if (gs === 'accept' || gs === 'review') return gs;
    }
    const o = outcomes[i];
    if (o.action === 'create' || changesSomething(o, d)) return 'ready';
    if (o.action === 'skip') return 'skip';
    return 'unchanged';
  }
  const states = rows.map((_, i) => rowState(i));
  const hasConflict = (o: RowOutcome) => o.action === 'update' && o.changes.some((c) => c.kind === 'conflict');

  const counts = {
    all: rows.length,
    ready: states.filter((s) => s === 'ready').length,
    accept: states.filter((s) => s === 'accept').length,
    review: states.filter((s) => s === 'review').length,
    conflict: outcomes.filter(hasConflict).length,
    edited: rows.filter((r) => edits[r.line]).length,
    unchanged: states.filter((s) => s === 'unchanged').length,
    skip: states.filter((s) => s === 'skip').length,
    flagged: rows.filter((r) => r.unknown.length).length,
  };

  const visible = rows
    .map((r, i) => ({ r, i, o: outcomes[i], s: states[i] }))
    .filter(({ r, o, s }) => {
      switch (filter) {
        case 'ready':
        case 'accept':
        case 'review':
        case 'unchanged':
        case 'skip':
          return s === filter;
        case 'conflict': return hasConflict(o);
        case 'edited': return !!edits[r.line];
        case 'flagged': return r.unknown.length > 0;
        default: return true;
      }
    });

  const setDecision = (i: number, patch: Partial<RowDecision>) => {
    const r = rows[i];
    setRowChoices((c) => ({ ...c, [r.line]: { ...decisions[i], ...patch, sig: rowSig(r) } }));
  };
  const setCompany = (g: CompanyGroup, decision: CompanyDecision) =>
    setCompanyChoices((c) => ({ ...c, [g.key]: { decision, sig: g.signature } }));
  const acceptable = groups.filter((g) => g.kind === 'accept' && groupState(g) === 'accept');
  const acceptAllNew = () =>
    setCompanyChoices((c) => {
      const next = { ...c };
      for (const g of acceptable) next[g.key] = { decision: 'create', sig: g.signature };
      return next;
    });

  /** Stores only the fields that really differ from the uploaded file; restoring a value removes its edit. */
  function saveRowEdits(line: number, cells: Record<string, string> | null) {
    setEdits((all) => {
      const next = { ...all };
      if (!cells) {
        delete next[line];
        return next;
      }
      const original = originalCells(table, mapping, line);
      const changed: Record<string, string> = {};
      for (const [key, value] of Object.entries(cells)) {
        const a = parseRowCells(kind, line, { [key]: value });
        const b = parseRowCells(kind, line, { [key]: original[key] ?? '' });
        if (JSON.stringify([a.values[key], a.accountName]) !== JSON.stringify([b.values[key], b.accountName])) changed[key] = value;
      }
      if (Object.keys(changed).length) next[line] = changed;
      else delete next[line];
      return next;
    });
  }

  /** Renames an Account Name for every contact that uses it, so they stay linked together. */
  function renameAccount(g: CompanyGroup, name: string) {
    const lines = rows.filter((r) => r.company?.key === g.key).map((r) => r.line);
    setEdits((all) => {
      const next = { ...all };
      for (const line of lines) {
        const original = originalCells(table, mapping, line).companyId ?? '';
        const rest = { ...(next[line] ?? {}) };
        if (name.trim() === original.trim()) delete rest.companyId;
        else rest.companyId = name.trim();
        if (Object.keys(rest).length) next[line] = rest;
        else delete next[line];
      }
      return next;
    });
  }

  function reset() {
    clearDraft();
    setReadError(null);
  }
  /** Asks first when there are edits or choices that haven't been imported. */
  const guard = (action: () => void) => (hasPendingWork ? setConfirmDiscard(() => action) : action());

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
      setEdits({});
      setRowChoices({});
      setCompanyChoices({});
      setStep('map');
    } catch {
      setReadError("This file couldn't be read. Check that it's a CSV saved from Excel or Salesforce.");
    }
  }

  function openPreview() {
    if (!prepared) return;
    setSnapshot(db);
    setFilter('all');
    setStep('preview');
  }

  async function runImport() {
    setSaving(true);
    try {
      const { ops, summary } = buildOperations(kind, rows, decisions, base, companyDecisions, createId);
      await data.saveBatch({
        creates: { companies: ops.createCompanies, contacts: ops.createContacts },
        updates: { companies: ops.updateCompanies, contacts: ops.updateContacts },
      });
      setResult(summary);
      setEdits({});
      setRowChoices({});
      setCompanyChoices({});
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

  const discardDialog = (
    <ConfirmDialog
      open={confirmDiscard !== null}
      title="Discard this import?"
      message={<p>Your edits and choices for “{fileName}” haven't been imported yet. They'll be lost. Nothing in the workspace changes.</p>}
      confirmLabel="Discard import"
      onConfirm={() => { const action = confirmDiscard; setConfirmDiscard(null); action?.(); }}
      onCancel={() => setConfirmDiscard(null)}
    />
  );

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
                      : 'Salesforce Contacts template. Each Account Name is linked to a company for you to check.'}
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
        <StepHeader fileName={fileName} kind={kind} onReset={() => guard(reset)} />
        {restored && <Notice tone="info">Your import in progress was kept while you were on other pages.</Notice>}
        {notice && <Notice tone="info">{notice}</Notice>}
        <div className="mb-4 space-y-1 text-sm text-neutral-700">
          <p>Check how each column will be imported. Columns are matched by their header. Change any that are wrong.</p>
          {prepared.instructionsLine && (
            <p className="flex items-center gap-1.5 text-neutral-600"><Icon name="check" className="h-4 w-4 text-ivey-700" />Row 2 is the template's instructions row and will be skipped.</p>
          )}
          <p className="text-neutral-600">{plural(prepared.rows.length, 'data row', 'data rows')} found.</p>
          {Object.keys(edits).length > 0 && <p className="text-neutral-600">Your edits to {plural(Object.keys(edits).length, 'row', 'rows')} are kept and will still apply on the next step.</p>}
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
          <Button variant="secondary" onClick={() => guard(reset)}>Choose a different file</Button>
          <Button onClick={openPreview} disabled={prepared.mappingErrors.length > 0}>Review import</Button>
        </div>
        {discardDialog}
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
            <p className="mt-1 text-neutral-600">Values outside Lauren's lists were kept as written. Use the "Needs review" filter to find them. The uploaded file itself was not changed.</p>
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
  const editingIndex = editingLine === null ? -1 : rows.findIndex((r) => r.line === editingLine);
  const editingRow = editingIndex >= 0 ? rows[editingIndex] : undefined;
  const editingTarget = editingRow ? decisions[editingIndex].target : null;
  const editingExisting = editingRow && editingTarget && editingTarget !== 'new'
    ? (kind === 'companies' ? base.companies : base.contacts).find((x) => x.id === editingTarget)
    : undefined;
  const groupsByState = (s: GroupState) => groups.filter((g) => groupState(g) === s);

  return (
    <div>
      <StepHeader fileName={fileName} kind={kind} onReset={() => guard(reset)} />
      {restored && <Notice tone="info">Your import in progress was kept while you were on other pages. Nothing has been imported yet.</Notice>}
      <p className="mb-4 text-sm text-neutral-700">
        Nothing has been saved yet. Check the proposed actions, edit any row, then import.
        Blank cells never clear existing values, existing notes only change if you choose, and the uploaded file itself is never changed.
      </p>

      <section aria-label="Import summary" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Ready to import" value={counts.ready} tone="ready" onClick={() => setFilter('ready')} />
        {kind === 'contacts' && <SummaryTile label="Waiting for new companies to be accepted" value={counts.accept} tone={counts.accept ? 'accept' : 'muted'} onClick={() => setFilter('accept')} />}
        <SummaryTile label="Need review" value={counts.review} tone={counts.review ? 'review' : 'muted'} onClick={() => setFilter('review')} />
        <SummaryTile label="Already up to date or skipped" value={counts.unchanged + counts.skip} tone="muted" onClick={() => setFilter('skip')} />
      </section>

      {kind === 'contacts' && groups.length > 0 && (
        <section className="mb-6 rounded-lg border border-neutral-200" aria-labelledby="company-links">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
            <div>
              <h3 id="company-links" className="text-sm font-semibold text-neutral-950">Company links</h3>
              <p className="text-xs text-neutral-600">
                One decision per Account Name covers all its contacts. {groupsByState('ready').length + groupsByState('decided').length} ready ·{' '}
                {plural(acceptable.length, 'new company', 'new companies')} to accept · {groupsByState('review').length} need review
              </p>
            </div>
            {acceptable.length > 0 && (
              <Button onClick={acceptAllNew} icon="check">Accept {acceptable.length === 1 ? 'the proposed new company' : `all ${acceptable.length} proposed new companies`}</Button>
            )}
          </div>
          <ul className="divide-y divide-neutral-100">
            {[...groupsByState('review'), ...groupsByState('accept'), ...groupsByState('decided'), ...groupsByState('ready')].map((g) => (
              <CompanyLinkRow
                key={g.key}
                group={g}
                state={groupState(g)}
                decision={companyDecisions[g.key]}
                contacts={rows.filter((r, i) => r.company?.key === g.key && decisions[i].include).length}
                companies={base.companies}
                otherGroups={groups.filter((o) => o.key !== g.key && o.match.status === 'new')}
                onDecide={(d) => setCompany(g, d)}
                onRename={(name) => renameAccount(g, name)}
              />
            ))}
          </ul>
        </section>
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Show rows">
        {(
          [
            ['all', 'All rows'],
            ['ready', 'Ready'],
            ...(kind === 'contacts' ? [['accept', 'Waiting for new companies'] as [Filter, string]] : []),
            ['review', 'Need review'],
            ['conflict', 'Conflicts'],
            ['edited', 'Edited'],
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
            <span className={`tabular-nums ${filter === id ? 'text-ivey-100' : (id === 'review' || id === 'conflict' || id === 'accept') && counts[id] > 0 ? 'font-semibold text-amber-700' : 'text-neutral-500'}`}>{counts[id]}</span>
          </button>
        ))}
      </div>

      <ol className="space-y-3">
        {visible.map(({ r, i, o, s }) => (
          <RowCard
            key={r.line}
            kind={kind}
            row={r}
            outcome={o}
            state={s}
            edited={!!edits[r.line]}
            decision={decisions[i]}
            snapshot={base}
            companyLine={r.company && r.company.status !== 'none' ? describeLink(r, groupByKey.get(r.company.key), companyDecisions, base, groupByKey, groupState) : null}
            onDecision={(patch) => setDecision(i, patch)}
            onEdit={() => setEditingLine(r.line)}
            onRestore={() => saveRowEdits(r.line, null)}
          />
        ))}
        {visible.length === 0 && <li className="rounded-lg border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-600">No rows in this view.</li>}
      </ol>

      <div className="sticky bottom-0 -mx-5 mt-6 -mb-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-white/95 px-5 py-4 backdrop-blur">
        <p className="text-sm text-neutral-700" aria-live="polite">
          <strong className="font-semibold text-neutral-950">{counts.ready}</strong> ready
          {counts.accept > 0 && <span className="text-amber-800"> · {counts.accept} waiting for new companies</span>}
          {counts.review > 0 && <span className="text-amber-800"> · {counts.review} need review</span>}
          {' '}· {counts.unchanged} already up to date · {counts.skip} skipped
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setStep('map')}>Back to columns</Button>
          <Button variant="secondary" icon="download" onClick={backupFirst}>Download backup first</Button>
          <Button onClick={runImport} disabled={saving || counts.ready === 0}>
            {saving ? 'Importing…' : counts.ready === 0 ? 'Nothing to import' : `Import ${counts.ready} ${counts.ready === 1 ? KIND_LABEL[kind].noun : KIND_LABEL[kind].plural}`}
          </Button>
        </div>
      </div>

      <Modal
        open={!!editingRow}
        onClose={() => setEditingLine(null)}
        title={editingRow ? `Edit row ${editingRow.line}: ${editingRow.label}` : 'Edit row'}
        description="Changes apply only to this import, until you click Import. The uploaded file isn't changed."
        size="xl"
      >
        {editingRow && (
          <RowEditor
            kind={kind}
            row={editingRow}
            mappedKeys={mapping.filter((k): k is string => !!k)}
            original={originalCells(table, mapping, editingRow.line)}
            pending={edits[editingRow.line] ?? {}}
            existing={editingExisting}
            companies={base.companies}
            onSave={(cells) => { saveRowEdits(editingRow.line, cells); setEditingLine(null); }}
            onCancel={() => setEditingLine(null)}
          />
        )}
      </Modal>
      {discardDialog}
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

function SummaryTile({ label, value, tone, onClick }: { label: string; value: number; tone: 'ready' | 'accept' | 'review' | 'muted'; onClick: () => void }) {
  const tones = {
    ready: 'border-ivey-200 bg-ivey-50/60 text-ivey-900',
    accept: 'border-sky-200 bg-sky-50 text-sky-900',
    review: 'border-amber-300 bg-amber-50 text-amber-950',
    muted: 'border-neutral-200 bg-white text-neutral-800',
  };
  return (
    <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-2.5 text-left hover:shadow-xs ${tones[tone]}`}>
      <span className="block text-xl leading-tight font-semibold tabular-nums">{value}</span>
      <span className="block text-xs">{label}</span>
    </button>
  );
}

/** Plain-language company line for a contact row. */
function describeLink(
  row: PlanRow,
  g: CompanyGroup | undefined,
  decisions: Record<string, CompanyDecision>,
  db: Database,
  groupByKey: Map<string, CompanyGroup>,
  groupState: (g: CompanyGroup) => GroupState,
): ReactNode {
  if (!g) return null;
  const d = decisions[g.key];
  const name = (id: string) => db.companies.find((c) => c.id === id)?.name ?? 'a company';
  const state = groupState(g);
  let what: ReactNode;
  if (state === 'accept') what = <span className="font-medium text-sky-800">proposed new company “{g.accountName}”, waiting for your OK</span>;
  else if (state === 'review') what = <span className="font-medium text-amber-800">needs review (see Company links)</span>;
  else if (d === 'create') what = <>new company “{g.accountName}”</>;
  else if (d === 'none') what = <>no company</>;
  else if (typeof d === 'string' && d.startsWith(SAME_AS)) {
    const target = groupByKey.get(d.slice(SAME_AS.length));
    const resolved = resolveCompanyDecision(g.key, decisions).decision;
    what = <>same company as “{target?.accountName}” ({resolved === 'create' ? 'new' : resolved && resolved !== 'none' ? name(resolved) : 'no company'})</>;
  } else if (d) what = <>existing company “{name(d)}”{state === 'ready' ? ' (exact name)' : ''}</>;
  return <>Account Name “{row.company?.accountName}” → {what}</>;
}

function CompanyLinkRow({ group, state, decision, contacts, companies, otherGroups, onDecide, onRename }: {
  group: CompanyGroup;
  state: GroupState;
  decision: CompanyDecision;
  contacts: number;
  companies: Company[];
  otherGroups: CompanyGroup[];
  onDecide: (d: CompanyDecision) => void;
  onRename: (name: string) => void;
}) {
  const [changing, setChanging] = useState(false);
  const m = group.match;
  const nameOf = (id: string) => companies.find((c) => c.id === id)?.name ?? 'a company';
  const proposalText = (() => {
    const p = group.proposal;
    if (m.status === 'matched') return <>Linked to existing “{nameOf(m.companyId!)}”: exactly the same name.</>;
    if (p === 'create') return <>Proposed: create new company “{group.accountName}”. No similar company exists. Only the name is filled in.</>;
    if (typeof p === 'string' && p.startsWith(SAME_AS)) {
      const o = group.similarInFile[0];
      return <>Suggested: the same new company as “{o.accountName}”, also in this file. {o.reason} Please confirm.</>;
    }
    if (m.status === 'possible' && p) return <>Suggested: existing “{nameOf(p)}”. {m.candidates[0]?.reason} Please confirm.</>;
    return <>Several companies could be this one: {m.candidates.map((c) => `“${c.label}”`).join(', ')}. Choose one, or create a new company.</>;
  })();
  const decidedText = (() => {
    if (decision === 'create') return `Will create new company “${group.accountName}”.`;
    if (decision === 'none') return 'Contacts will be imported without a company.';
    if (typeof decision === 'string' && decision.startsWith(SAME_AS)) return `Same company as “${otherGroups.find((o) => o.key === decision.slice(SAME_AS.length))?.accountName ?? 'another Account Name'}”.`;
    if (decision) return `Linked to existing “${nameOf(decision)}”.`;
    return '';
  })();
  const chip = {
    ready: ['Ready', 'bg-ivey-50 text-ivey-800 ring-ivey-200'],
    decided: ['Decided', 'bg-ivey-50 text-ivey-800 ring-ivey-200'],
    accept: ['Waiting for your OK', 'bg-sky-50 text-sky-800 ring-sky-200'],
    review: ['Needs review', 'bg-amber-50 text-amber-900 ring-amber-300'],
  }[state];

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-950">
            “{group.accountName}”
            <Badge className={chip[1]}>{chip[0]}</Badge>
            <span className="text-xs font-normal text-neutral-600">{plural(contacts, 'contact', 'contacts')}</span>
          </p>
          {group.spellings.length > 0 && <p className="text-xs text-neutral-500">Also written as {group.spellings.map((s) => `“${s}”`).join(', ')} (same apart from capitals or spacing).</p>}
          <p className="mt-0.5 text-xs text-neutral-700">{state === 'decided' ? decidedText : proposalText}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {(state === 'accept' || state === 'review') && group.proposal && (
            <Button size="sm" onClick={() => onDecide(group.proposal)}>
              {group.proposal === 'create' ? 'Accept' : group.proposal.startsWith(SAME_AS) ? 'Confirm same company' : `Use “${nameOf(group.proposal)}”`}
            </Button>
          )}
          <Button size="sm" variant="secondary" aria-expanded={changing} onClick={() => setChanging((v) => !v)}>Change</Button>
        </div>
      </div>
      {changing && (
        <CompanyLinkEditor
          group={group}
          decision={decision}
          companies={companies}
          otherGroups={otherGroups}
          onApply={(d) => { onDecide(d); setChanging(false); }}
          onRename={(name) => { onRename(name); setChanging(false); }}
          onCancel={() => setChanging(false)}
        />
      )}
    </li>
  );
}

function CompanyLinkEditor({ group, decision, companies, otherGroups, onApply, onRename, onCancel }: {
  group: CompanyGroup;
  decision: CompanyDecision;
  companies: Company[];
  otherGroups: CompanyGroup[];
  onApply: (d: CompanyDecision) => void;
  onRename: (name: string) => void;
  onCancel: () => void;
}) {
  const suggested = group.match.candidates;
  const initial = decision ?? group.proposal ?? '';
  const isListed = (v: string) => suggested.some((c) => c.id === v) || v === group.match.companyId || ['create', 'none'].includes(v) || v.startsWith(SAME_AS);
  const [choice, setChoice] = useState<string>(initial && !isListed(initial) ? 'other' : initial);
  const [otherId, setOtherId] = useState(typeof initial === 'string' && companies.some((c) => c.id === initial) ? initial : '');
  const [name, setName] = useState(group.accountName);
  const sameTargets = otherGroups.filter((o) => o.match.status === 'new');
  const option = (value: string, label: ReactNode, detail?: string) => (
    <label key={value} className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-neutral-50">
      <input type="radio" name={`link-${group.key}`} value={value} checked={choice === value} onChange={() => setChoice(value)} className="mt-1 accent-ivey-700" />
      <span className="text-sm text-neutral-900">{label}{detail && <span className="block text-xs text-neutral-600">{detail}</span>}</span>
    </label>
  );
  const apply = () => onApply(choice === 'other' ? otherId || null : (choice || null) as CompanyDecision);
  return (
    <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50/60 p-3">
      <fieldset>
        <legend className="mb-1 text-xs font-semibold text-neutral-700">Link the contacts with Account Name “{group.accountName}” to:</legend>
        {suggested.map((c) => option(c.id, <>Existing company “{c.label}”</>, c.reason))}
        {group.match.status === 'matched' && option(group.match.companyId!, <>Existing company “{companies.find((c) => c.id === group.match.companyId)?.name}”</>, 'Exactly the same name.')}
        {sameTargets.map((o) => option(SAME_AS + o.key, <>The same new company as “{o.accountName}” (also in this file)</>, similarNameReasonText(group, o)))}
        {option('create', <>Create new company “{group.accountName}”</>, 'Only the name is filled in. Add other details later.')}
        {option('other', <>Another existing company</>)}
        {choice === 'other' && (
          <select aria-label="Choose an existing company" value={otherId} onChange={(e) => setOtherId(e.target.value)} className={`${filterSelectClass} mt-1 ml-7 max-w-xs`}>
            <option value="">Choose…</option>
            {[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {option('none', <>No company</>, 'Import these contacts without a company.')}
      </fieldset>
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-neutral-200 pt-3">
        <div className="min-w-[14rem] flex-1">
          <TextField label="Or correct the Account Name for these contacts" value={name} onChange={setName} hint="Changes the name in this import only, for every contact that uses it. Matching runs again." />
        </div>
        <Button size="sm" variant="secondary" disabled={!name.trim() || name.trim() === group.accountName} onClick={() => onRename(name)}>Rename</Button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={apply} disabled={!choice || (choice === 'other' && !otherId)}>Apply</Button>
      </div>
    </div>
  );
}

function similarNameReasonText(group: CompanyGroup, other: CompanyGroup): string | undefined {
  return group.similarInFile.find((s) => s.key === other.key)?.reason || undefined;
}

function RowCard({ kind, row, outcome, state, edited, decision, snapshot, companyLine, onDecision, onEdit, onRestore }: {
  kind: ImportKind;
  row: PlanRow;
  outcome: RowOutcome;
  state: RowState;
  edited: boolean;
  decision: RowDecision;
  snapshot: Database;
  companyLine: ReactNode;
  onDecision: (patch: Partial<RowDecision>) => void;
  onEdit: () => void;
  onRestore: () => void;
}) {
  const blocked = row.errors.length > 0 || row.duplicateOfLine !== undefined;
  const existingName = (id: string) =>
    kind === 'companies'
      ? snapshot.companies.find((c) => c.id === id)?.name
      : (() => {
          const c = snapshot.contacts.find((x) => x.id === id);
          return c ? fullName(c) : undefined;
        })();

  const badge =
    state === 'review'
      ? { text: 'Needs review', tone: 'bg-amber-50 text-amber-900 ring-amber-300' }
      : state === 'accept'
        ? { text: 'Waiting for new company', tone: 'bg-sky-50 text-sky-800 ring-sky-200' }
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
    <li className={`rounded-lg border bg-white p-4 ${state === 'review' ? 'border-amber-300' : blocked ? 'border-red-200' : 'border-neutral-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-950">
            <span className="text-xs font-normal text-neutral-500 tabular-nums">Row {row.line}</span>
            {row.label}
            <Badge className={badge.tone}>{badge.text}</Badge>
            {edited && <Badge className="bg-violet-50 text-violet-800 ring-violet-200">Edited</Badge>}
          </p>
          {row.match.status === 'matched' && decision.target !== 'new' && (
            <p className="mt-0.5 text-xs text-neutral-600">Updates existing {kind === 'companies' ? 'company' : 'contact'} “{existingName(row.match.matchId!)}” ({row.match.reason})</p>
          )}
          {companyLine && <p className="mt-0.5 text-xs text-neutral-600">{companyLine}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {edited && <button type="button" onClick={onRestore} className="text-xs font-medium text-ivey-700 hover:underline" aria-label={`Restore row ${row.line} as in the file`}>Restore original</button>}
          <Button size="sm" variant="secondary" icon="pencil" onClick={onEdit} aria-label={`Edit row ${row.line}`}>Edit</Button>
          {!blocked && (
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" checked={decision.include} onChange={(e) => onDecision({ include: e.target.checked })} className="h-4 w-4 accent-ivey-700" />
              Include
            </label>
          )}
        </div>
      </div>

      {row.errors.map((e) => (
        <p key={e} className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-700"><Icon name="alert" className="h-4 w-4" />{e} Edit the row to fix it, or it won't be imported.</p>
      ))}
      {row.duplicateOfLine !== undefined && (
        <p className="mt-2 text-sm text-neutral-700">Same {kind === 'companies' ? 'company' : 'contact'} as row {row.duplicateOfLine} in this file, so it's skipped to avoid a duplicate. Edit it if it's actually a different {kind === 'companies' ? 'company' : 'person'}.</p>
      )}

      {!blocked && decision.include && (row.match.status === 'possible' || row.match.status === 'ambiguous') && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-amber-50 px-3 py-2.5 text-sm">
          <span className="text-amber-950">
            {row.match.status === 'ambiguous' ? 'Several existing records could be this one.' : `Possible match: ${row.match.reason}`} Choose what to do:
          </span>
          <select
            aria-label={`Match for row ${row.line}`}
            value={decision.target ?? ''}
            onChange={(e) => onDecision({ target: e.target.value || null, conflicts: {} })}
            className={`${filterSelectClass} max-w-sm`}
          >
            <option value="">Choose…</option>
            {row.match.candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.id.startsWith(SAME_ROW) ? `Same company as ${c.label}: skip this row` : `Update existing “${c.label}”`}</option>
            ))}
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
        <ChangeTable changes={outcome.changes} decision={decision} edited={edited} onChoice={(key, choice) => onDecision({ conflicts: { ...decision.conflicts, [key]: choice } })} companyName={(id) => snapshot.companies.find((c) => c.id === id)?.name} />
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

function ChangeTable({ changes, decision, edited, onChoice, companyName }: {
  changes: FieldChange[];
  decision: RowDecision;
  edited: boolean;
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
            <th scope="col" className="px-3 py-2 font-semibold">Current (in the workspace)</th>
            <th scope="col" className="px-3 py-2 font-semibold">Proposed ({edited ? 'file, with your edits' : 'from the file'})</th>
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

/**
 * Edit form for one pending row: every mapped field, checked live exactly as the import checks it.
 * For a row that updates an existing record, each field shows the value currently in the workspace.
 */
function RowEditor({ kind, row, mappedKeys, original, pending, existing, companies, onSave, onCancel }: {
  kind: ImportKind;
  row: PlanRow;
  mappedKeys: string[];
  original: Record<string, string>;
  pending: Record<string, string>;
  existing: Company | Contact | undefined;
  companies: Company[];
  onSave: (cells: Record<string, string> | null) => void;
  onCancel: () => void;
}) {
  const fields = fieldsFor(kind).filter((f) => mappedKeys.includes(f.key) && f.type !== 'id');
  const [values, setValues] = useState<Record<string, string | string[]>>(() => {
    const v: Record<string, string | string[]> = {};
    for (const f of fields) {
      if (f.type === 'single') v[f.key] = (row.values[f.key] as string) ?? '';
      else if (f.type === 'multi') v[f.key] = (row.values[f.key] as string[]) ?? [];
      else v[f.key] = pending[f.key] ?? original[f.key] ?? '';
    }
    return v;
  });
  const toCells = () => Object.fromEntries(fields.map((f) => [f.key, Array.isArray(values[f.key]) ? (values[f.key] as string[]).join('; ') : String(values[f.key] ?? '')]));
  const check = parseRowCells(kind, row.line, toCells());
  const messageFor = (f: FieldDef) =>
    check.errors.find((e) => e.startsWith(`${f.label} `)) ?? check.warnings.find((w) => w.startsWith(`${f.label} “`));
  const set = (key: string) => (v: string | string[]) => setValues((all) => ({ ...all, [key]: v }));
  const currentText = (f: FieldDef): string | undefined => {
    if (!existing) return undefined;
    if (f.type === 'company') {
      const id = (existing as Contact).companyId;
      return id ? companies.find((c) => c.id === id)?.name ?? '—' : 'No company';
    }
    return show(getPath(existing, f.key) as Value | null);
  };
  const hint = (f: FieldDef, extra?: string) => {
    const cur = currentText(f);
    const parts = [extra, cur !== undefined ? `In the workspace now: ${cur}` : undefined].filter(Boolean);
    return parts.length ? parts.join(' · ') : undefined;
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    onSave(toCells());
  }

  return (
    <form onSubmit={submit} noValidate>
      {existing && (
        <p className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
          This row updates an existing {kind === 'companies' ? 'company' : 'contact'}. Under each field you'll see what the workspace holds now.
          After saving, the review lists each difference, and conflicting values keep the current value unless you choose otherwise.
        </p>
      )}
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        {fields.map((f) => {
          const err = messageFor(f);
          const error = err && check.errors.includes(err) ? err : undefined;
          const warning = err && !error ? err : undefined;
          if (f.type === 'single') {
            return <SelectField key={f.key} label={f.label} value={values[f.key] as string} onChange={set(f.key)} options={picklist(f.options ?? [])} hint={hint(f)} />;
          }
          if (f.type === 'multi') {
            const chosen = values[f.key] as string[];
            const extra = chosen.filter((v) => !(f.options ?? []).includes(v));
            return (
              <CheckboxGroupField key={f.key} className="sm:col-span-2" label={f.label} options={[...(f.options ?? []), ...extra]} value={chosen} onChange={set(f.key)} columns={3}
                hint={hint(f, extra.length ? `Not in Lauren's list (kept, flagged): ${extra.join(', ')}` : undefined)} />
            );
          }
          if (f.type === 'longtext') {
            return <TextAreaField key={f.key} className="sm:col-span-2" label={f.label} value={values[f.key] as string} onChange={set(f.key)} rows={3}
              hint={hint(f, existing ? 'Existing notes stay as they are unless you choose otherwise in the review.' : undefined)} />;
          }
          return (
            <TextField
              key={f.key}
              label={f.label}
              required={f.required}
              value={values[f.key] as string}
              onChange={set(f.key)}
              error={error}
              placeholder={f.type === 'date' ? 'YYYY-MM-DD' : f.type === 'company' ? 'Leave blank for no company' : undefined}
              hint={warning ?? hint(f, f.type === 'company' ? 'Contacts with the same Account Name are linked to the same company.' : undefined)}
            />
          );
        })}
      </div>
      {check.errors.length > 0 && (
        <p role="alert" className="mt-4 text-sm font-medium text-red-700">{check.errors.join(' ')} The row can be saved, but it won't be imported until this is fixed.</p>
      )}
      <div className="sticky bottom-0 -mx-6 mt-6 -mb-5 flex flex-wrap justify-between gap-2 border-t border-neutral-100 bg-neutral-50 px-6 py-4">
        <Button variant="ghost" onClick={() => onSave(null)} disabled={Object.keys(pending).length === 0}>Restore original row</Button>
        <span className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save edits</Button>
        </span>
      </div>
    </form>
  );
}
