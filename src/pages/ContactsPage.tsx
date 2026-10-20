import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { relativeFromIso } from '../lib/dates';
import { fullName, lastActivityAt, matchesQuery } from '../lib/selectors';
import { Avatar, Button, Card, EmptyState, PageHeader, SearchInput, inputClass } from '../components/ui';
import { Modal } from '../components/Modal';
import { ContactForm } from '../components/ContactForm';

export function ContactsPage() {
  const { contacts, companies, companyById, activities } = useData();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    return contacts
      .filter((c) => {
        if (companyFilter === 'none' ? c.companyId !== null : companyFilter && c.companyId !== companyFilter) return false;
        const company = c.companyId ? companyById.get(c.companyId) : undefined;
        return matchesQuery(query, fullName(c), c.email, c.jobTitle, company?.name);
      })
      .map((c) => ({
        contact: c,
        company: c.companyId ? companyById.get(c.companyId) : undefined,
        lastActivity: lastActivityAt(activities.filter((a) => a.contactId === c.id)),
      }))
      .sort((a, b) => a.contact.lastName.localeCompare(b.contact.lastName) || a.contact.firstName.localeCompare(b.contact.firstName));
  }, [contacts, companyById, activities, query, companyFilter]);

  return (
    <>
      <PageHeader
        title="Contacts"
        description={`${contacts.length} ${contacts.length === 1 ? 'person' : 'people'} across ${companies.length} organization${companies.length === 1 ? '' : 's'}`}
        actions={<Button icon="plus" onClick={() => setAdding(true)}>Add contact</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name, email, title or company" label="Search contacts" />
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} aria-label="Filter by company" className={`${inputClass} w-auto max-w-xs`}>
          <option value="">All companies</option>
          <option value="none">No company</option>
          {[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {(query || companyFilter) && (
          <p className="text-sm text-neutral-600" aria-live="polite">{rows.length} result{rows.length === 1 ? '' : 's'}</p>
        )}
      </div>

      <Card padded={false}>
        {contacts.length === 0 ? (
          <EmptyState icon="users" title="No contacts yet" message="Add the people you work with and link them to their organization."
            action={<Button icon="plus" onClick={() => setAdding(true)}>Add contact</Button>} />
        ) : rows.length === 0 ? (
          <EmptyState icon="search" title="No contacts match your search" message="Try a different search or clear the filters."
            action={<Button variant="secondary" onClick={() => { setQuery(''); setCompanyFilter(''); }}>Clear filters</Button>} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold tracking-wide text-neutral-600 uppercase">
              <tr>
                <th scope="col" className="px-5 py-3">Name</th>
                <th scope="col" className="px-5 py-3">Company</th>
                <th scope="col" className="px-5 py-3">Email</th>
                <th scope="col" className="px-5 py-3">Phone</th>
                <th scope="col" className="px-5 py-3">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map(({ contact, company, lastActivity }) => (
                <tr key={contact.id} onClick={() => navigate(`/contacts/${contact.id}`)} className="cursor-pointer hover:bg-neutral-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={fullName(contact)} size="sm" />
                      <div className="min-w-0">
                        <Link to={`/contacts/${contact.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-neutral-900 hover:text-ivey-700 hover:underline">
                          {fullName(contact)}
                        </Link>
                        {contact.jobTitle && <p className="text-xs text-neutral-600">{contact.jobTitle}</p>}
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
                  <td className="px-5 py-3 text-neutral-700">{contact.email || '—'}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-neutral-700">{contact.phone || '—'}</td>
                  <td className="px-5 py-3 text-neutral-600">{lastActivity ? relativeFromIso(lastActivity) : 'None yet'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add contact" description="Fictional data only in this prototype." size="lg">
        <ContactForm
          defaultCompanyId={companyFilter && companyFilter !== 'none' ? companyFilter : undefined}
          onSaved={(c) => { setAdding(false); navigate(`/contacts/${c.id}`); }}
          onCancel={() => setAdding(false)}
        />
      </Modal>
    </>
  );
}
