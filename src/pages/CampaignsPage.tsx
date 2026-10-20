import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { campaignTerm } from '../lib/campaigns';
import { CAMPAIGN_PURPOSES, CAMPAIGN_STATES } from '../lib/options';
import { matchesQuery } from '../lib/selectors';
import { Badge, Button, Card, EmptyState, PageHeader, SearchInput, filterSelectClass } from '../components/ui';
import { Modal } from '../components/Modal';
import { CampaignForm, CampaignStateBadge } from '../components/campaigns';

export function CampaignsPage() {
  const { campaigns } = useData();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [purpose, setPurpose] = useState('');
  const [state, setState] = useState('');
  const [adding, setAdding] = useState(false);

  const rows = useMemo(
    () =>
      campaigns
        .filter((c) => (!purpose || c.purpose === purpose) && (!state || c.state === state) && matchesQuery(query, c.name, c.description, c.projectTypes.join(' ')))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [campaigns, purpose, state, query],
  );

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Track outreach for project invitations, partner renewals and surveys. Each person's campaign status is separate from their company's status and any application stage. Emails are sent from your own email program; this app only records them."
        actions={<Button icon="plus" onClick={() => setAdding(true)}>New campaign</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search campaigns" label="Search campaigns" />
        <select value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-label="Filter by purpose" className={filterSelectClass}>
          <option value="">All purposes</option>
          {CAMPAIGN_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)} aria-label="Filter by state" className={filterSelectClass}>
          <option value="">Any state</option>
          {CAMPAIGN_STATES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <Card padded={false}>
        {campaigns.length === 0 ? (
          <EmptyState icon="mail" title="No campaigns yet" message="Create a campaign to track invitations, renewals or surveys person by person." action={<Button icon="plus" onClick={() => setAdding(true)}>New campaign</Button>} />
        ) : rows.length === 0 ? (
          <EmptyState icon="search" title="No campaigns match" action={<Button variant="secondary" onClick={() => { setQuery(''); setPurpose(''); setState(''); }}>Clear filters</Button>} />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold tracking-wide text-neutral-600 uppercase">
              <tr>
                <th scope="col" className="px-5 py-3">Campaign</th>
                <th scope="col" className="px-5 py-3">Purpose</th>
                <th scope="col" className="px-5 py-3">Term</th>
                <th scope="col" className="px-5 py-3">State</th>
                <th scope="col" className="px-5 py-3">Participants by status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((c) => {
                const counts = c.participants.reduce<Record<string, number>>((m, p) => ((m[p.status] = (m[p.status] ?? 0) + 1), m), {});
                return (
                  <tr key={c.id} onClick={() => navigate(`/campaigns/${c.id}`)} className="cursor-pointer hover:bg-neutral-50">
                    <td className="px-5 py-3">
                      <Link to={`/campaigns/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-neutral-900 hover:text-ivey-700 hover:underline">{c.name}</Link>
                      {c.projectTypes.length > 0 && <p className="text-xs text-neutral-600">{c.projectTypes.join(', ')}</p>}
                    </td>
                    <td className="px-5 py-3 text-neutral-700">{c.purpose}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-neutral-700">{campaignTerm(c) || '—'}</td>
                    <td className="px-5 py-3"><CampaignStateBadge state={c.state} /></td>
                    <td className="px-5 py-3">
                      {c.participants.length === 0 ? <span className="text-neutral-500">None yet</span> : (
                        <span className="flex flex-wrap gap-1">{Object.entries(counts).map(([s, n]) => <Badge key={s}>{s}: {n}</Badge>)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="New campaign" description="Fictional data only in this prototype." size="xl">
        <CampaignForm onSaved={(c) => { setAdding(false); if (c) navigate(`/campaigns/${c.id}`); }} onCancel={() => setAdding(false)} />
      </Modal>
    </>
  );
}
