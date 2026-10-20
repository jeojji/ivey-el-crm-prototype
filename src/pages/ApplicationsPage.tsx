import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { fullName, matchesQuery } from '../lib/selectors';
import { deadlineState, isAwaitingReview, isClosed, termLabel, termSortKey } from '../lib/applications';
import { APPLICATION_PROJECT_TYPES, APPLICATION_STAGES, PROGRAMS, STAGE_MEANINGS } from '../lib/options';
import { Button, Card, EmptyState, PageHeader, SearchInput, filterSelectClass } from '../components/ui';
import { Modal } from '../components/Modal';
import { ApplicationForm, DeadlineText, StageBadge, StageSelect } from '../components/applications';

type View = 'list' | 'pipeline';
const OPEN = '__open';
const REVIEW = '__review';
const DEADLINES = '__deadlines';

export function ApplicationsPage() {
  const { applications, companies, companyById, contactById } = useData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'pipeline' ? 'pipeline' : 'list';
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState(params.get('stage') ?? '');
  const [projectType, setProjectType] = useState('');
  const [program, setProgram] = useState('');
  const [term, setTerm] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [adding, setAdding] = useState(false);

  const terms = useMemo(
    () => [...new Map(applications.filter((a) => a.termYear).map((a) => [termLabel(a), termSortKey(a)])).entries()].sort((a, b) => a[1] - b[1]).map(([l]) => l),
    [applications],
  );

  const rows = useMemo(
    () =>
      applications
        .filter((a) => {
          if (stage === OPEN ? isClosed(a) : stage === REVIEW ? !isAwaitingReview(a) : stage === DEADLINES ? !['soon', 'passed'].includes(deadlineState(a)) : stage && a.stage !== stage) return false;
          if (projectType && a.projectType !== projectType) return false;
          if (program && a.program !== program) return false;
          if (term && termLabel(a) !== term) return false;
          if (companyId && a.companyId !== companyId) return false;
          const contact = a.primaryContactId ? contactById.get(a.primaryContactId) : undefined;
          return matchesQuery(query, a.title, a.scope, a.notes, companyById.get(a.companyId)?.name, contact && fullName(contact));
        })
        .sort((a, b) => (a.confirmationDeadline || '9999').localeCompare(b.confirmationDeadline || '9999') || a.title.localeCompare(b.title)),
    [applications, stage, projectType, program, term, companyId, query, companyById, contactById],
  );

  const anyFilter = query || stage || projectType || program || term || companyId;
  const clear = () => {
    setQuery('');
    setStage('');
    setProjectType('');
    setProgram('');
    setTerm('');
    setCompanyId('');
  };
  const setView = (v: View) => setParams(v === 'list' ? {} : { view: v }, { replace: true });

  return (
    <>
      <PageHeader
        title="Applications"
        description="Engagement opportunities with partners (Lauren's “Opportunities”), not job applications. Each has its own stage, separate from company and contact statuses."
        actions={<Button icon="plus" onClick={() => setAdding(true)}>Add application</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-neutral-300 bg-white p-0.5" role="group" aria-label="View">
          {(['list', 'pipeline'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-ivey-700 text-white' : 'text-neutral-700 hover:bg-neutral-50'}`}
            >
              {v === 'list' ? 'List' : 'Pipeline'}
            </button>
          ))}
        </div>
        {anyFilter && <p className="text-sm text-neutral-600" aria-live="polite">{rows.length} of {applications.length} shown</p>}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search title, scope, company or contact" label="Search applications" />
        <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by stage" className={`${filterSelectClass}`}>
          <option value="">All stages</option>
          <option value={OPEN}>Open (not completed, declined or deferred)</option>
          <option value={REVIEW}>Awaiting review</option>
          <option value={DEADLINES}>Deadline soon or passed</option>
          <optgroup label="Stage">
            {APPLICATION_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </optgroup>
        </select>
        <select value={projectType} onChange={(e) => setProjectType(e.target.value)} aria-label="Filter by project type" className={`${filterSelectClass} max-w-[13rem]`}>
          <option value="">Any project type</option>
          {APPLICATION_PROJECT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={program} onChange={(e) => setProgram(e.target.value)} aria-label="Filter by program" className={`${filterSelectClass}`}>
          <option value="">Any program</option>
          {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Filter by academic term" className={`${filterSelectClass}`}>
          <option value="">Any term</option>
          {terms.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Filter by company" className={`${filterSelectClass} max-w-[13rem]`}>
          <option value="">All companies</option>
          {[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {applications.length === 0 ? (
        <Card>
          <EmptyState icon="briefcase" title="No applications yet" message="Add an engagement opportunity to track it from first contact to a completed project."
            action={<Button icon="plus" onClick={() => setAdding(true)}>Add application</Button>} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon="search" title="No applications match these filters" action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />
        </Card>
      ) : view === 'list' ? (
        <Card padded={false}>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold tracking-wide text-neutral-600 uppercase">
              <tr>
                <th scope="col" className="px-5 py-3">Application</th>
                <th scope="col" className="px-5 py-3">Stage</th>
                <th scope="col" className="px-5 py-3">Project type</th>
                <th scope="col" className="px-5 py-3">Program · term</th>
                <th scope="col" className="px-5 py-3" title="Participation confirmation deadline">Confirmation deadline</th>
                <th scope="col" className="px-5 py-3">Primary contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((a) => {
                const contact = a.primaryContactId ? contactById.get(a.primaryContactId) : undefined;
                return (
                  <tr key={a.id} onClick={() => navigate(`/applications/${a.id}`)} className="cursor-pointer hover:bg-neutral-50">
                    <td className="px-5 py-3">
                      <Link to={`/applications/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-neutral-900 hover:text-ivey-700 hover:underline">{a.title}</Link>
                      <p className="text-xs text-neutral-600">{companyById.get(a.companyId)?.name}</p>
                    </td>
                    <td className="px-5 py-3"><StageBadge stage={a.stage} /></td>
                    <td className="px-5 py-3 text-neutral-700">{a.projectType || '—'}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-neutral-700">{[a.program, termLabel(a)].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-5 py-3 whitespace-nowrap"><DeadlineText application={a} short /></td>
                    <td className="px-5 py-3 text-neutral-700">{contact ? fullName(contact) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>
      ) : (
        <div className="-mx-6 overflow-x-auto px-6 pb-4 lg:-mx-10 lg:px-10">
          <div className="flex min-w-max gap-3">
            {APPLICATION_STAGES.map((s) => {
              const inStage = rows.filter((a) => a.stage === s);
              return (
                <section key={s} aria-label={`${s}: ${inStage.length}`} className="flex w-64 shrink-0 flex-col rounded-xl bg-neutral-100/80 p-2.5">
                  <header className="mb-2 px-1" title={STAGE_MEANINGS[s]}>
                    <p className="flex items-center justify-between text-sm font-semibold text-neutral-900">
                      {s}
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-neutral-600 tabular-nums">{inStage.length}</span>
                    </p>
                    <p className="text-[11px] leading-snug text-neutral-500">{STAGE_MEANINGS[s]}</p>
                  </header>
                  <ul className="flex flex-col gap-2">
                    {inStage.map((a) => (
                      <li key={a.id} className="rounded-lg border border-neutral-200 bg-white p-3 shadow-xs">
                        <Link to={`/applications/${a.id}`} className="block text-sm font-semibold text-neutral-900 hover:text-ivey-700 hover:underline">{a.title}</Link>
                        <p className="mt-0.5 text-xs text-neutral-600">{companyById.get(a.companyId)?.name}</p>
                        <p className="mt-1 text-xs text-neutral-600">{[a.program, termLabel(a)].filter(Boolean).join(' · ')}</p>
                        {a.confirmationDeadline && <p className="mt-1 text-xs">Deadline: <DeadlineText application={a} short /></p>}
                        <div className="mt-2">
                          <StageSelect application={a} compact />
                        </div>
                      </li>
                    ))}
                    {inStage.length === 0 && <li className="rounded-lg border border-dashed border-neutral-300 px-3 py-4 text-center text-xs text-neutral-500">None</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add application" description="An engagement opportunity with a partner. Fictional data only." size="xl">
        <ApplicationForm
          defaultCompanyId={companyId || undefined}
          onSaved={(a) => { setAdding(false); navigate(`/applications/${a.id}`); }}
          onCancel={() => setAdding(false)}
        />
      </Modal>
    </>
  );
}
