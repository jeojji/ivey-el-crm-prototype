import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { daysFromToday, todayDateString } from '../lib/dates';
import { byDueAsc, fullName, matchesQuery } from '../lib/selectors';
import type { Task } from '../types';
import { Button, Card, EmptyState, PageHeader, SearchInput, filterSelectClass } from '../components/ui';
import { Modal } from '../components/Modal';
import { TaskForm } from '../components/TaskForm';
import { FollowUpList } from '../components/FollowUpList';

const VIEWS = [
  { id: 'open', label: 'Open' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'week', label: 'Due in 7 days' },
  { id: 'done', label: 'Completed' },
  { id: 'all', label: 'All' },
] as const;
type View = (typeof VIEWS)[number]['id'];

function inView(task: Task, view: View, today: string): boolean {
  switch (view) {
    case 'open':
      return task.status === 'open';
    case 'overdue':
      return task.status === 'open' && task.dueDate < today;
    case 'week':
      return task.status === 'open' && task.dueDate >= today && daysFromToday(task.dueDate) <= 7;
    case 'done':
      return task.status === 'done';
    case 'all':
      return true;
  }
}

/** Splits open follow-ups into time buckets; completed ones go last, newest first. */
function group(tasks: Task[], today: string): { label: string; tasks: Task[]; alert?: boolean }[] {
  const open = tasks.filter((t) => t.status === 'open').sort(byDueAsc);
  const done = tasks
    .filter((t) => t.status === 'done')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  return [
    { label: 'Overdue', tasks: open.filter((t) => t.dueDate < today), alert: true },
    { label: 'Due today', tasks: open.filter((t) => t.dueDate === today) },
    { label: 'Next 7 days', tasks: open.filter((t) => t.dueDate > today && daysFromToday(t.dueDate) <= 7) },
    { label: 'Later', tasks: open.filter((t) => daysFromToday(t.dueDate) > 7) },
    { label: 'Completed', tasks: done },
  ].filter((g) => g.tasks.length > 0);
}

export function FollowUpsPage() {
  const { tasks, companies, companyById, contactById } = useData();
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.some((v) => v.id === params.get('view')) ? params.get('view') : 'open') as View;
  const [query, setQuery] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [adding, setAdding] = useState(false);
  const today = todayDateString();

  const counts = useMemo(() => {
    const result = {} as Record<View, number>;
    for (const v of VIEWS) result[v.id] = tasks.filter((t) => inView(t, v.id, today)).length;
    return result;
  }, [tasks, today]);

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (!inView(t, view, today)) return false;
        if (companyId && t.companyId !== companyId) return false;
        const company = t.companyId ? companyById.get(t.companyId) : undefined;
        const contact = t.contactId ? contactById.get(t.contactId) : undefined;
        return matchesQuery(query, t.title, t.notes, company?.name, contact && fullName(contact));
      }),
    [tasks, view, today, companyId, query, companyById, contactById],
  );

  const groups = group(filtered, today);
  const narrowed = query || companyId;

  function setView(next: View) {
    setParams(next === 'open' ? {} : { view: next }, { replace: true });
  }

  const emptyMessages: Record<View, { title: string; message: string }> = {
    open: { title: 'No open follow-ups', message: 'Create a follow-up to keep track of your next step with a partner.' },
    overdue: { title: 'Nothing overdue', message: "You're caught up." },
    week: { title: 'Nothing due in the next 7 days', message: 'Upcoming follow-ups will appear here.' },
    done: { title: 'No completed follow-ups yet', message: 'Tick a follow-up to mark it complete and it will move here.' },
    all: { title: 'No follow-ups yet', message: 'Create a follow-up to keep track of your next step with a partner.' },
  };

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Next steps with partners. Tick a follow-up to complete it, or click its title to edit."
        actions={<Button icon="plus" onClick={() => setAdding(true)}>Add follow-up</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Show follow-ups">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            aria-pressed={view === v.id}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              view === v.id ? 'border-ivey-700 bg-ivey-700 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {v.label}
            <span
              className={`tabular-nums ${
                view === v.id ? 'text-ivey-100' : v.id === 'overdue' && counts.overdue > 0 ? 'font-semibold text-red-700' : 'text-neutral-500'
              }`}
            >
              {counts[v.id]}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search follow-ups, companies or contacts" label="Search follow-ups" />
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Filter by company" className={`${filterSelectClass} max-w-xs`}>
          <option value="">All companies</option>
          {[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {narrowed && <p className="text-sm text-neutral-600" aria-live="polite">{filtered.length} result{filtered.length === 1 ? '' : 's'}</p>}
      </div>

      <Card>
        {groups.length === 0 ? (
          narrowed ? (
            <EmptyState icon="search" title="No follow-ups match your search"
              action={<Button variant="secondary" onClick={() => { setQuery(''); setCompanyId(''); }}>Clear search</Button>} />
          ) : (
            <EmptyState icon="task" {...emptyMessages[view]}
              action={view === 'open' || view === 'all' ? <Button icon="plus" onClick={() => setAdding(true)}>Add follow-up</Button> : undefined} />
          )
        ) : (
          <div className="space-y-7">
            {groups.map((g) => (
              <section key={g.label}>
                <h2 className={`mb-3 text-xs font-semibold tracking-wide uppercase ${g.alert ? 'text-red-700' : 'text-neutral-500'}`}>
                  {g.label} <span className="font-normal">({g.tasks.length})</span>
                </h2>
                <FollowUpList tasks={g.tasks} />
              </section>
            ))}
          </div>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add follow-up" size="lg">
        <TaskForm defaultCompanyId={companyId || undefined} onSaved={() => setAdding(false)} onCancel={() => setAdding(false)} />
      </Modal>
    </>
  );
}
