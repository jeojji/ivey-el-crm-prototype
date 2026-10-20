import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { relativeFromIso } from '../lib/dates';
import { lastActivityAt, matchesQuery } from '../lib/selectors';
import { RELATIONSHIP_STATUSES } from '../types';
import { Button, Card, EmptyState, PageHeader, SearchInput, StatusBadge, inputClass } from '../components/ui';
import { Modal } from '../components/Modal';
import { CompanyForm } from '../components/CompanyForm';

export function CompaniesPage() {
  const { companies, contacts, activities } = useData();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    return companies
      .filter((c) => (!status || c.status === status) && matchesQuery(query, c.name, c.industry, c.city))
      .map((c) => ({
        company: c,
        contactCount: contacts.filter((p) => p.companyId === c.id).length,
        lastActivity: lastActivityAt(activities.filter((a) => a.companyId === c.id)),
      }))
      .sort((a, b) => a.company.name.localeCompare(b.company.name));
  }, [companies, contacts, activities, query, status]);

  const filtered = query || status;

  return (
    <>
      <PageHeader
        title="Companies"
        description={`${companies.length} organization${companies.length === 1 ? '' : 's'} in the workspace`}
        actions={<Button icon="plus" onClick={() => setAdding(true)}>Add company</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name, industry or city" label="Search companies" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by relationship status" className={`${inputClass} w-auto`}>
          <option value="">All statuses</option>
          {RELATIONSHIP_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {filtered && (
          <p className="text-sm text-neutral-600" aria-live="polite">
            {rows.length} result{rows.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <Card padded={false}>
        {companies.length === 0 ? (
          <EmptyState
            icon="building"
            title="No companies yet"
            message="Add the first organization you work with to start building its relationship history."
            action={<Button icon="plus" onClick={() => setAdding(true)}>Add company</Button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="search"
            title="No companies match your search"
            message="Try a different name or clear the filters."
            action={<Button variant="secondary" onClick={() => { setQuery(''); setStatus(''); }}>Clear filters</Button>}
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold tracking-wide text-neutral-600 uppercase">
              <tr>
                <th scope="col" className="px-5 py-3">Company</th>
                <th scope="col" className="px-5 py-3">Status</th>
                <th scope="col" className="px-5 py-3">Industry</th>
                <th scope="col" className="px-5 py-3">City</th>
                <th scope="col" className="px-5 py-3 text-right">Contacts</th>
                <th scope="col" className="px-5 py-3">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map(({ company, contactCount, lastActivity }) => (
                <tr key={company.id} onClick={() => navigate(`/companies/${company.id}`)} className="cursor-pointer hover:bg-neutral-50">
                  <td className="px-5 py-3.5">
                    <Link to={`/companies/${company.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-neutral-900 hover:text-ivey-700 hover:underline">
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={company.status} /></td>
                  <td className="px-5 py-3.5 text-neutral-700">{company.industry || '—'}</td>
                  <td className="px-5 py-3.5 text-neutral-700">{company.city || '—'}</td>
                  <td className="px-5 py-3.5 text-right text-neutral-700 tabular-nums">{contactCount}</td>
                  <td className="px-5 py-3.5 text-neutral-600">{lastActivity ? relativeFromIso(lastActivity) : 'None yet'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add company" description="Fictional data only in this prototype." size="lg">
        <CompanyForm onSaved={(c) => { setAdding(false); navigate(`/companies/${c.id}`); }} onCancel={() => setAdding(false)} />
      </Modal>
    </>
  );
}
