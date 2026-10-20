import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { daysFromToday, formatDateTime, formatLongToday, relativeFromIso, todayDateString } from '../lib/dates';
import { ACTIVITY_LABELS, byDueAsc, byOccurredAsc, byOccurredDesc, fullName, isFuture } from '../lib/selectors';
import { Card, EmptyState, PageHeader } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { ActivityTypeIcon } from '../components/ActivityTimeline';
import { FollowUpList } from '../components/FollowUpList';
import { AddMenu } from '../components/AddMenu';
import { DeadlineText, StageBadge } from '../components/applications';
import { DEADLINE_SOON_DAYS, deadlineState, isAwaitingReview, isClosed, termLabel } from '../lib/applications';
import type { Application } from '../types';

/** Items shown per Home section before "View all". */
const LIMIT = 5;

function ViewAll({ to, total, label }: { to: string; total: number; label: string }) {
  return (
    <Link to={to} className="shrink-0 text-sm font-medium text-ivey-700 hover:underline" aria-label={`View all ${total} ${label}`}>
      {total > LIMIT ? `View all ${total}` : 'View all'}
    </Link>
  );
}

const tones = {
  red: { dot: 'bg-red-600', count: 'bg-red-50 text-red-700' },
  neutral: { dot: 'bg-neutral-400', count: 'bg-neutral-100 text-neutral-700' },
  violet: { dot: 'bg-violet-600', count: 'bg-violet-50 text-violet-800' },
  amber: { dot: 'bg-amber-500', count: 'bg-amber-50 text-amber-800' },
};

/** One kind of attention item, with its own colour, count and "View all", so the kinds stay distinct. */
function AttentionGroup({ title, tone, count, to, children, note }: {
  title: string;
  tone: keyof typeof tones;
  count: number;
  to: string;
  children: ReactNode;
  note?: string;
}) {
  return (
    <section className="border-t border-neutral-100 pt-5 first:border-t-0 first:pt-0" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <span className={`h-2 w-2 rounded-full ${tones[tone].dot}`} aria-hidden="true" />
          {title}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tones[tone].count}`}>{count}</span>
        </h3>
        <ViewAll to={to} total={count} label={title.toLowerCase()} />
      </div>
      {children}
      {note && <p className="mt-3 text-xs text-neutral-500">{note}</p>}
    </section>
  );
}

function ApplicationRows({ items, deadline }: { items: Application[]; deadline?: boolean }) {
  const { companyById } = useData();
  return (
    <ul className="divide-y divide-neutral-100">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <Link to={`/applications/${a.id}`} className="text-sm font-medium text-neutral-900 hover:text-ivey-700 hover:underline">{a.title}</Link>
            <p className="text-xs text-neutral-600">
              {deadline ? (
                <>{companyById.get(a.companyId)?.name} · <DeadlineText application={a} /></>
              ) : (
                <>
                  {[companyById.get(a.companyId)?.name, termLabel(a)].filter(Boolean).join(' · ')}
                  {a.confirmationDeadline && <> · Deadline <DeadlineText application={a} short /></>}
                </>
              )}
            </p>
          </div>
          <StageBadge stage={a.stage} />
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value, sub, icon, to }: { label: string; value: number; sub?: string; icon: IconName; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-xs transition-colors hover:border-ivey-300">
      <Icon name={icon} className="h-5 w-5 shrink-0 text-ivey-700" />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-neutral-600">{label}</span>
        <span className="block text-lg leading-tight font-semibold tabular-nums text-neutral-950">{value}</span>
        {sub && <span className="block truncate text-xs text-neutral-500">{sub}</span>}
      </span>
    </Link>
  );
}

export function DashboardPage() {
  const { companies, contacts, activities, tasks, applications, companyById, contactById } = useData();

  const now = Date.now();
  const today = todayDateString();
  const openTasks = tasks.filter((t) => t.status === 'open');
  const overdue = openTasks.filter((t) => t.dueDate < today).sort(byDueAsc);
  const dueSoon = openTasks.filter((t) => t.dueDate >= today && daysFromToday(t.dueDate) <= 7).sort(byDueAsc);
  const upcoming = activities.filter((a) => a.type === 'meeting' && isFuture(a, now)).sort(byOccurredAsc);
  const recent = activities.filter((a) => !isFuture(a, now)).sort(byOccurredDesc);
  const activePartners = companies.filter((c) => c.statuses.includes('Active Partner')).length;
  const openApps = applications.filter((a) => !isClosed(a));
  const awaitingReview = applications.filter(isAwaitingReview).sort((a, b) => (a.confirmationDeadline || '9999').localeCompare(b.confirmationDeadline || '9999'));
  const deadlines = applications
    .filter((a) => ['soon', 'passed'].includes(deadlineState(a)))
    .sort((a, b) => a.confirmationDeadline.localeCompare(b.confirmationDeadline));
  const last30 = activities.filter((a) => !isFuture(a, now) && now - new Date(a.occurredAt).getTime() <= 30 * 86_400_000).length;

  const groups = [
    { key: 'overdue', title: 'Overdue follow-ups', count: overdue.length },
    { key: 'soon', title: 'Follow-ups due in the next 7 days', count: dueSoon.length },
    { key: 'review', title: 'Applications awaiting review', count: awaitingReview.length },
    { key: 'deadlines', title: 'Participation deadlines', count: deadlines.length },
  ];
  const clear = groups.filter((g) => g.count === 0);
  const attentionTotal = overdue.length + dueSoon.length + awaitingReview.length + deadlines.length;

  return (
    <>
      <PageHeader title="Home" description={formatLongToday()} actions={<AddMenu />} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title={<span className="flex items-center gap-2">Needs attention{attentionTotal > 0 && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">{attentionTotal}</span>}</span>}>
          {attentionTotal === 0 ? (
            <EmptyState compact icon="check" title="Nothing needs attention" message="No overdue or upcoming follow-ups, applications awaiting review, or close participation deadlines." />
          ) : (
            <div className="space-y-5">
              {overdue.length > 0 && (
                <AttentionGroup title="Overdue follow-ups" tone="red" count={overdue.length} to="/follow-ups?view=overdue">
                  <FollowUpList tasks={overdue.slice(0, LIMIT)} />
                </AttentionGroup>
              )}
              {dueSoon.length > 0 && (
                <AttentionGroup title="Follow-ups due in the next 7 days" tone="neutral" count={dueSoon.length} to="/follow-ups?view=week">
                  <FollowUpList tasks={dueSoon.slice(0, LIMIT)} />
                </AttentionGroup>
              )}
              {awaitingReview.length > 0 && (
                <AttentionGroup title="Applications awaiting review" tone="violet" count={awaitingReview.length} to="/applications?stage=__review" note="At “Application submitted” or “Meeting completed”.">
                  <ApplicationRows items={awaitingReview.slice(0, LIMIT)} />
                </AttentionGroup>
              )}
              {deadlines.length > 0 && (
                <AttentionGroup title="Participation deadlines" tone="amber" count={deadlines.length} to="/applications?stage=__deadlines" note={`Within ${DEADLINE_SOON_DAYS} days, or passed, for applications not yet at Team Confirmed.`}>
                  <ApplicationRows items={deadlines.slice(0, LIMIT)} deadline />
                </AttentionGroup>
              )}
              {clear.length > 0 && (
                <p className="border-t border-neutral-100 pt-4 text-xs text-neutral-500">
                  <Icon name="check" className="mr-1 inline h-3.5 w-3.5 text-ivey-700" />
                  Nothing for: {clear.map((g) => g.title.toLowerCase()).join(', ')}.
                </p>
              )}
            </div>
          )}
        </Card>

        <Card
          title={<span className="flex items-center gap-2">Upcoming meetings{upcoming.length > 0 && <span className="rounded-full bg-ivey-50 px-2 py-0.5 text-xs font-semibold text-ivey-800">{upcoming.length}</span>}</span>}
          action={upcoming.length > 0 && <ViewAll to="/activity?type=meeting" total={upcoming.length} label="meetings" />}
        >
          {upcoming.length === 0 ? (
            <EmptyState compact icon="calendar" title="No upcoming meetings" message="Use Add → Schedule meeting, from here or from a company, contact or application." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {upcoming.slice(0, LIMIT).map((a) => {
                const company = a.companyId ? companyById.get(a.companyId) : undefined;
                const contact = a.contactId ? contactById.get(a.contactId) : undefined;
                const d = new Date(a.occurredAt);
                return (
                  <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-ivey-50 text-ivey-800" aria-hidden="true">
                      <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString('en-CA', { month: 'short' })}</span>
                      <span className="text-base leading-none font-semibold">{d.getDate()}</span>
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
      </div>

      <h2 className="mt-10 mb-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Workspace</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Companies" value={companies.length} sub={`${activePartners} active partner${activePartners === 1 ? '' : 's'}`} icon="building" to="/companies" />
        <Stat label="Contacts" value={contacts.length} icon="users" to="/contacts" />
        <Stat label="Open applications" value={openApps.length} icon="briefcase" to="/applications?view=pipeline" />
        <Stat label="Activities, last 30 days" value={last30} icon="activity" to="/activity" />
      </div>

      <Card title="Recent activity" action={recent.length > 0 && <ViewAll to="/activity" total={recent.length} label="activities" />}>
        {recent.length === 0 ? (
          <EmptyState compact icon="activity" title="No activity yet" message="Emails, calls, meetings and notes you add will appear here." />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {recent.slice(0, LIMIT).map((a) => {
              const company = a.companyId ? companyById.get(a.companyId) : undefined;
              const contact = a.contactId ? contactById.get(a.contactId) : undefined;
              return (
                <li key={a.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                  <ActivityTypeIcon type={a.type} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {a.email ? <Link to={`/emails/${a.id}`} className="hover:text-ivey-700 hover:underline">{a.subject || '(no subject)'}</Link> : a.subject || '(no subject)'}
                    </p>
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
    </>
  );
}
