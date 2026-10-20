import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { daysFromToday, formatDateTime, formatLongToday, relativeFromIso, todayDateString } from '../lib/dates';
import { ACTIVITY_LABELS, byDueAsc, byOccurredAsc, byOccurredDesc, fullName, isFuture } from '../lib/selectors';
import { Button, Card, EmptyState, PageHeader } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { Modal } from '../components/Modal';
import { CompanyForm } from '../components/CompanyForm';
import { ActivityForm } from '../components/ActivityForm';
import { ActivityTypeIcon } from '../components/ActivityTimeline';
import { FollowUpList } from '../components/FollowUpList';
import { TaskForm } from '../components/TaskForm';

function Stat({ label, value, sub, icon, to, alert }: { label: string; value: number; sub?: string; icon: IconName; to?: string; alert?: boolean }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-600">{label}</p>
        <Icon name={icon} className={`h-5 w-5 ${alert ? 'text-red-700' : 'text-ivey-700'}`} />
      </div>
      <p className={`mt-3 text-3xl font-semibold tracking-tight tabular-nums ${alert ? 'text-red-700' : 'text-neutral-950'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-500">{sub}</p>}
    </>
  );
  const cls = 'block rounded-xl border border-neutral-200 bg-white p-5 shadow-xs';
  return to ? <Link to={to} className={`${cls} transition-colors hover:border-ivey-300`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function DashboardPage() {
  const { companies, contacts, activities, tasks, companyById, contactById } = useData();
  const [modal, setModal] = useState<'company' | 'activity' | 'task' | null>(null);
  const close = () => setModal(null);

  const now = Date.now();
  const today = todayDateString();
  const openTasks = tasks.filter((t) => t.status === 'open');
  const overdue = openTasks.filter((t) => t.dueDate < today).sort(byDueAsc);
  const dueSoon = openTasks.filter((t) => t.dueDate >= today && daysFromToday(t.dueDate) <= 7).sort(byDueAsc);
  const upcoming = activities
    .filter((a) => a.type === 'meeting' && isFuture(a, now))
    .sort(byOccurredAsc)
    .slice(0, 5);
  const recent = activities.filter((a) => !isFuture(a, now)).sort(byOccurredDesc).slice(0, 6);
  const activePartners = companies.filter((c) => c.status === 'Active partner').length;
  const last30 = activities.filter((a) => !isFuture(a, now) && now - new Date(a.occurredAt).getTime() <= 30 * 86_400_000).length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={formatLongToday()}
        actions={
          <>
            <Button variant="secondary" icon="plus" onClick={() => setModal('company')}>Add company</Button>
            <Button variant="secondary" icon="plus" onClick={() => setModal('task')}>Add follow-up</Button>
            <Button icon="plus" onClick={() => setModal('activity')}>Log activity</Button>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Companies" value={companies.length} sub={`${activePartners} active partner${activePartners === 1 ? '' : 's'}`} icon="building" to="/companies" />
        <Stat label="Contacts" value={contacts.length} icon="users" to="/contacts" />
        <Stat label="Activities, last 30 days" value={last30} icon="activity" to="/activity" />
        <Stat label="Overdue follow-ups" value={overdue.length} sub={`${dueSoon.length} more due in the next 7 days`} icon="alert" alert={overdue.length > 0} to="/follow-ups?view=overdue" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card
          title={<span className="flex items-center gap-2">Overdue follow-ups{overdue.length > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{overdue.length}</span>}</span>}
          action={<Link to="/follow-ups" className="text-sm font-medium text-ivey-700 hover:underline">View all</Link>}
        >
          {overdue.length === 0 ? (
            <EmptyState compact icon="check" title="Nothing overdue" message="You're caught up on follow-ups." />
          ) : (
            <FollowUpList tasks={overdue} />
          )}
          {dueSoon.length > 0 && (
            <>
              <h3 className="mt-6 mb-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Due in the next 7 days</h3>
              <FollowUpList tasks={dueSoon} />
            </>
          )}
          {overdue.length === 0 && dueSoon.length === 0 && (
            <div className="mt-2 text-center">
              <Button size="sm" variant="secondary" icon="plus" onClick={() => setModal('task')}>Add follow-up</Button>
            </div>
          )}
        </Card>

        <Card title="Upcoming meetings">
          {upcoming.length === 0 ? (
            <EmptyState compact icon="calendar" title="No upcoming meetings" message="Log a meeting with a future date and it will appear here."
              action={<Button size="sm" variant="secondary" onClick={() => setModal('activity')}>Log a meeting</Button>} />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {upcoming.map((a) => {
                const company = a.companyId ? companyById.get(a.companyId) : undefined;
                const contact = a.contactId ? contactById.get(a.contactId) : undefined;
                const d = new Date(a.occurredAt);
                return (
                  <li key={a.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-ivey-50 text-ivey-800">
                      <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString('en-CA', { month: 'short' })}</span>
                      <span className="text-lg leading-none font-semibold">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">{a.subject}</p>
                      <p className="text-xs text-neutral-600">
                        {formatDateTime(a.occurredAt)}
                        {company && <> · <Link to={`/companies/${company.id}`} className="font-medium text-ivey-700 hover:underline">{company.name}</Link></>}
                        {contact && <> · <Link to={`/contacts/${contact.id}`} className="font-medium text-ivey-700 hover:underline">{fullName(contact)}</Link></>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Recent activity" action={<Link to="/activity" className="text-sm font-medium text-ivey-700 hover:underline">View all</Link>} className="xl:col-span-2">
          {recent.length === 0 ? (
            <EmptyState compact icon="activity" title="No activity yet" message="Logged emails, calls, meetings and notes will appear here." />
          ) : (
            <ul className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
              {recent.map((a) => {
                const company = a.companyId ? companyById.get(a.companyId) : undefined;
                const contact = a.contactId ? contactById.get(a.contactId) : undefined;
                return (
                  <li key={a.id} className="flex gap-3 border-b border-neutral-100 py-3">
                    <ActivityTypeIcon type={a.type} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">{a.subject}</p>
                      <p className="text-xs text-neutral-600">
                        {ACTIVITY_LABELS[a.type]} · {relativeFromIso(a.occurredAt)}
                        {company && <> · <Link to={`/companies/${company.id}`} className="font-medium text-ivey-700 hover:underline">{company.name}</Link></>}
                        {contact && <> · {fullName(contact)}</>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Modal open={modal === 'company'} onClose={close} title="Add company" description="Fictional data only in this prototype." size="lg">
        <CompanyForm onSaved={close} onCancel={close} />
      </Modal>
      <Modal open={modal === 'task'} onClose={close} title="Add follow-up" size="lg">
        <TaskForm onSaved={close} onCancel={close} />
      </Modal>
      <Modal open={modal === 'activity'} onClose={close} title="Log activity" size="lg">
        <ActivityForm onSaved={close} onCancel={close} />
      </Modal>
    </>
  );
}
