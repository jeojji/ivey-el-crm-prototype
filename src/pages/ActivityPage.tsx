import { useMemo, useState } from 'react';
import { useData } from '../state/DataContext';
import { ACTIVITY_LABELS, fullName, matchesQuery } from '../lib/selectors';
import { ACTIVITY_TYPES, type ActivityType } from '../types';
import { Button, Card, EmptyState, PageHeader, SearchInput, inputClass } from '../components/ui';
import { Modal } from '../components/Modal';
import { ActivityForm } from '../components/ActivityForm';
import { ActivityTimeline, ActivityTypeIcon } from '../components/ActivityTimeline';

export function ActivityPage() {
  const { activities, companies, companyById, contactById } = useData();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<ActivityType | ''>('');
  const [companyId, setCompanyId] = useState('');
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(
    () =>
      activities.filter((a) => {
        if (type && a.type !== type) return false;
        if (companyId && a.companyId !== companyId) return false;
        const company = a.companyId ? companyById.get(a.companyId) : undefined;
        const contact = a.contactId ? contactById.get(a.contactId) : undefined;
        return matchesQuery(query, a.subject, a.details, company?.name, contact && fullName(contact));
      }),
    [activities, type, companyId, query, companyById, contactById],
  );

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const a of activities) result[a.type] = (result[a.type] ?? 0) + 1;
    return result;
  }, [activities]);

  const anyFilter = query || type || companyId;

  return (
    <>
      <PageHeader
        title="Activity history"
        description="Every email, call, meeting and note logged in the workspace, newest first."
        actions={<Button icon="plus" onClick={() => setAdding(true)}>Log activity</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by activity type">
        <TypeChip active={type === ''} onClick={() => setType('')} label="All" count={activities.length} />
        {ACTIVITY_TYPES.map((t) => (
          <TypeChip key={t} active={type === t} onClick={() => setType(t)} label={ACTIVITY_LABELS[t]} count={counts[t] ?? 0} type={t} />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search subject, details, company or contact" label="Search activity" />
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Filter by company" className={`${inputClass} w-auto max-w-xs`}>
          <option value="">All companies</option>
          {[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {anyFilter && <p className="text-sm text-neutral-600" aria-live="polite">{filtered.length} result{filtered.length === 1 ? '' : 's'}</p>}
      </div>

      <Card>
        <ActivityTimeline
          activities={filtered}
          emptyState={
            activities.length === 0 ? (
              <EmptyState icon="activity" title="No activity logged yet" message="Log your first email, call, meeting or note against a company or contact."
                action={<Button icon="plus" onClick={() => setAdding(true)}>Log activity</Button>} />
            ) : (
              <EmptyState icon="search" title="No activity matches these filters"
                action={<Button variant="secondary" onClick={() => { setQuery(''); setType(''); setCompanyId(''); }}>Clear filters</Button>} />
            )
          }
        />
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Log activity" size="lg">
        <ActivityForm defaultCompanyId={companyId || undefined} onSaved={() => setAdding(false)} onCancel={() => setAdding(false)} />
      </Modal>
    </>
  );
}

function TypeChip({ active, onClick, label, count, type }: { active: boolean; onClick: () => void; label: string; count: number; type?: ActivityType }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'border-ivey-700 bg-ivey-700 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      {type && <ActivityTypeIcon type={type} bare />}
      {label}
      <span className={`tabular-nums ${active ? 'text-ivey-100' : 'text-neutral-500'}`}>{count}</span>
    </button>
  );
}
