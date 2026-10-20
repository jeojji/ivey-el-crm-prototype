import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { relativeFromIso } from '../lib/dates';
import { lastCommunicationAt, matchesQuery } from '../lib/selectors';
import { PARTNER_STATUSES, PRIORITIES, PROJECT_TYPES, shortLabel } from '../lib/options';
import { companyReviewIssues } from '../lib/review';
import { Badge, Button, Card, EmptyState, PageHeader, PriorityBadge, SearchInput, StatusBadges, filterSelectClass } from '../components/ui';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { CompanyForm } from '../components/CompanyForm';
import { AddMenu } from '../components/AddMenu';

const REVIEW = '__review';

export function CompaniesPage() {
  const { companies, contacts, activities } = useData();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [project, setProject] = useState('');
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    return companies
      .map((c) => ({ company: c, issues: companyReviewIssues(c) }))
      .filter(({ company: c, issues }) => {
        if (status === REVIEW ? issues.length === 0 : status && !c.statuses.includes(status)) return false;
        if (priority && c.priority !== priority) return false;
        if (project && !c.projectParticipation.includes(project)) return false;
        return matchesQuery(query, c.name, c.industry, c.address.city, c.address.province, c.notes);
      })
      .map((r) => ({
        ...r,
        contactCount: contacts.filter((p) => p.companyId === r.company.id).length,
        lastActivity: lastCommunicationAt(activities.filter((a) => a.companyId === r.company.id)),
      }))
      .sort((a, b) => a.company.name.localeCompare(b.company.name));
  }, [companies, contacts, activities, query, status, priority, project]);

  const reviewCount = useMemo(() => companies.filter((c) => companyReviewIssues(c).length > 0).length, [companies]);
  const filtered = query || status || priority || project;
  const clear = () => {
    setQuery('');
    setStatus('');
    setPriority('');
    setProject('');
  };

  return (
    <>
      <PageHeader
        title="Companies"
        description={`${companies.length} organization${companies.length === 1 ? '' : 's'} in the workspace`}
        actions={<AddMenu />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, industry, city or notes" label="Search companies" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by partner status" className={`${filterSelectClass}`}>
          <option value="">All statuses</option>
          {PARTNER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          {reviewCount > 0 && <option value={REVIEW}>Needs review ({reviewCount})</option>}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter by partnership priority" className={`${filterSelectClass}`}>
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p} priority</option>
          ))}
        </select>
        <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Filter by project participation" className={`${filterSelectClass} max-w-[14rem]`}>
          <option value="">Any project type</option>
          {PROJECT_TYPES.map((p) => (
            <option key={p} value={p}>{p}</option>
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
            action={<Button variant="secondary" onClick={clear}>Clear filters</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold tracking-wide text-neutral-600 uppercase">
              <tr>
                <th scope="col" className="px-5 py-3">Company</th>
                <th scope="col" className="px-5 py-3">Partner status</th>
                <th scope="col" className="px-5 py-3">Priority</th>
                <th scope="col" className="px-5 py-3">City</th>
                <th scope="col" className="px-5 py-3 text-right">Contacts</th>
                <th scope="col" className="px-5 py-3" title="Most recent logged email, call or meeting">Last communication</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map(({ company, issues, contactCount, lastActivity }) => (
                <tr key={company.id} onClick={() => navigate(`/companies/${company.id}`)} className="cursor-pointer hover:bg-neutral-50">
                  <td className="px-5 py-3">
                    <Link to={`/companies/${company.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-neutral-900 hover:text-ivey-700 hover:underline">
                      {company.name}
                    </Link>
                    <p className="flex items-center gap-2 text-xs text-neutral-600">
                      {company.industry ? shortLabel(company.industry) : 'No industry set'}
                      {issues.length > 0 && (
                        <Badge className="bg-amber-50 text-amber-900 ring-amber-300">
                          <Icon name="alert" className="h-3 w-3" />
                          Needs review
                        </Badge>
                      )}
                    </p>
                  </td>
                  <td className="px-5 py-3"><StatusBadges statuses={company.statuses} max={2} /></td>
                  <td className="px-5 py-3"><PriorityBadge priority={company.priority} /></td>
                  <td className="px-5 py-3 text-neutral-700">{company.address.city || '—'}</td>
                  <td className="px-5 py-3 text-right text-neutral-700 tabular-nums">{contactCount}</td>
                  <td className="px-5 py-3 text-neutral-600">{lastActivity ? relativeFromIso(lastActivity) : 'None yet'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add company" description="Fictional data only in this prototype." size="xl">
        <CompanyForm onSaved={(c) => { setAdding(false); navigate(`/companies/${c.id}`); }} onCancel={() => setAdding(false)} />
      </Modal>
    </>
  );
}
