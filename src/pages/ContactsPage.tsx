import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { relativeFromIso } from '../lib/dates';
import { fullName, lastActivityAt, matchesQuery } from '../lib/selectors';
import { CONTACT_PRIORITIES, CONTACT_ROLES, PARTNER_STATUSES } from '../lib/options';
import { contactReviewIssues } from '../lib/review';
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, PriorityBadge, SearchInput, inputClass } from '../components/ui';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { ContactForm } from '../components/ContactForm';

const REVIEW = '__review';

export function ContactsPage() {
  const { contacts, companies, companyById, activities } = useData();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [priority, setPriority] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    return contacts
      .map((c) => ({ contact: c, issues: contactReviewIssues(c) }))
      .filter(({ contact: c, issues }) => {
        if (companyFilter === 'none' ? c.companyId !== null : companyFilter && c.companyId !== companyFilter) return false;
        if (priority && c.priority !== priority) return false;
        if (role && !c.roles.includes(role)) return false;
        if (status === REVIEW ? issues.length === 0 : status && !c.statuses.includes(status)) return false;
        const company = c.companyId ? companyById.get(c.companyId) : undefined;
        return matchesQuery(query, fullName(c), c.email, c.jobTitle, company?.name, c.notes);
      })
      .map((r) => ({
        ...r,
        company: r.contact.companyId ? companyById.get(r.contact.companyId) : undefined,
        lastActivity: lastActivityAt(activities.filter((a) => a.contactId === r.contact.id)),
      }))
      .sort((a, b) => a.contact.lastName.localeCompare(b.contact.lastName) || a.contact.firstName.localeCompare(b.contact.firstName));
  }, [contacts, companyById, activities, query, companyFilter, priority, role, status]);

  const reviewCount = useMemo(() => contacts.filter((c) => contactReviewIssues(c).length > 0).length, [contacts]);
  const anyFilter = query || companyFilter || priority || role || status;
  const clear = () => {
    setQuery('');
    setCompanyFilter('');
    setPriority('');
    setRole('');
    setStatus('');
  };

  return (
    <>
      <PageHeader
        title="Contacts"
        description={`${contacts.length} ${contacts.length === 1 ? 'person' : 'people'} across ${companies.length} organization${companies.length === 1 ? '' : 's'}`}
        actions={<Button icon="plus" onClick={() => setAdding(true)}>Add contact</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, title, company or notes" label="Search contacts" />
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} aria-label="Filter by company" className={`${inputClass} w-auto max-w-[14rem]`}>
          <option value="">All companies</option>
          <option value="none">No company</option>
          {[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter by contact priority" className={`${inputClass} w-auto`}>
          <option value="">Any priority</option>
          {CONTACT_PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by contact role" className={`${inputClass} w-auto`}>
          <option value="">Any role</option>
          {CONTACT_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by contact status" className={`${inputClass} w-auto`}>
          <option value="">All statuses</option>
          {PARTNER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          {reviewCount > 0 && <option value={REVIEW}>Needs review ({reviewCount})</option>}
        </select>
        {anyFilter && (
          <p className="text-sm text-neutral-600" aria-live="polite">{rows.length} result{rows.length === 1 ? '' : 's'}</p>
        )}
      </div>

      <Card padded={false}>
        {contacts.length === 0 ? (
          <EmptyState icon="users" title="No contacts yet" message="Add the people you work with and link them to their organization."
            action={<Button icon="plus" onClick={() => setAdding(true)}>Add contact</Button>} />
        ) : rows.length === 0 ? (
          <EmptyState icon="search" title="No contacts match your search" message="Try a different search or clear the filters."
            action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold tracking-wide text-neutral-600 uppercase">
              <tr>
                <th scope="col" className="px-5 py-3">Name</th>
                <th scope="col" className="px-5 py-3">Company</th>
                <th scope="col" className="px-5 py-3">Priority</th>
                <th scope="col" className="px-5 py-3">Role</th>
                <th scope="col" className="px-5 py-3">Email</th>
                <th scope="col" className="px-5 py-3">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map(({ contact, issues, company, lastActivity }) => (
                <tr key={contact.id} onClick={() => navigate(`/contacts/${contact.id}`)} className="cursor-pointer hover:bg-neutral-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={fullName(contact)} size="sm" />
                      <div className="min-w-0">
                        <Link to={`/contacts/${contact.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-neutral-900 hover:text-ivey-700 hover:underline">
                          {fullName(contact)}
                        </Link>
                        <p className="flex items-center gap-2 text-xs text-neutral-600">
                          {contact.jobTitle}
                          {issues.length > 0 && (
                            <Badge className="bg-amber-50 text-amber-900 ring-amber-300">
                              <Icon name="alert" className="h-3 w-3" />
                              Needs review
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-neutral-700">
                    {company ? (
                      <Link to={`/companies/${company.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-ivey-700 hover:underline">{company.name}</Link>
                    ) : (
                      <span className="text-neutral-500">No company</span>
                    )}
                  </td>
                  <td className="px-5 py-3"><PriorityBadge priority={contact.priority} /></td>
                  <td className="px-5 py-3 text-neutral-700">
                    {contact.roles[0] ?? <span className="text-neutral-500">—</span>}
                    {contact.roles.length > 1 && <span className="text-neutral-500"> +{contact.roles.length - 1}</span>}
                  </td>
                  <td className="px-5 py-3 text-neutral-700">{contact.email || '—'}</td>
                  <td className="px-5 py-3 text-neutral-600">{lastActivity ? relativeFromIso(lastActivity) : 'None yet'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add contact" description="Fictional data only in this prototype." size="xl">
        <ContactForm
          defaultCompanyId={companyFilter && companyFilter !== 'none' ? companyFilter : undefined}
          onSaved={(c) => { setAdding(false); navigate(`/contacts/${c.id}`); }}
          onCancel={() => setAdding(false)}
        />
      </Modal>
    </>
  );
}
