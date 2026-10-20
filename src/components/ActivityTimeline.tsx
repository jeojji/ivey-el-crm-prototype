import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { formatDateTime, relativeFromIso } from '../lib/dates';
import { ACTIVITY_LABELS, byOccurredAsc, byOccurredDesc, fullName, isFuture } from '../lib/selectors';
import type { Activity, ActivityType } from '../types';
import { Icon, type IconName } from './Icon';
import { Badge } from './ui';
import { ConfirmDialog, Modal } from './Modal';
import { ActivityForm } from './ActivityForm';

const typeIcon: Record<ActivityType, IconName> = { email: 'mail', call: 'phone', meeting: 'calendar', note: 'note' };
const typeTone: Record<ActivityType, string> = {
  email: 'bg-sky-50 text-sky-800',
  call: 'bg-violet-50 text-violet-800',
  meeting: 'bg-ivey-50 text-ivey-800',
  note: 'bg-amber-50 text-amber-800',
};

export function ActivityTypeIcon({ type, bare = false }: { type: ActivityType; bare?: boolean }) {
  if (bare) return <Icon name={typeIcon[type]} className="h-4 w-4" />;
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${typeTone[type]}`}>
      <Icon name={typeIcon[type]} className="h-4 w-4" />
    </span>
  );
}

interface TimelineProps {
  activities: Activity[];
  /** Hide the link to the company when the timeline is already on that company's page. */
  hideCompany?: boolean;
  hideContact?: boolean;
  hideApplication?: boolean;
  emptyState: ReactNode;
}

export function ActivityTimeline({ activities, hideCompany, hideContact, hideApplication, emptyState }: TimelineProps) {
  const now = Date.now();
  const upcoming = activities.filter((a) => isFuture(a, now)).sort(byOccurredAsc);
  const past = activities.filter((a) => !isFuture(a, now)).sort(byOccurredDesc);

  if (!activities.length) return <>{emptyState}</>;

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <TimelineGroup label="Upcoming" items={upcoming} hideCompany={hideCompany} hideContact={hideContact} hideApplication={hideApplication} upcoming />
      )}
      {past.length > 0 && (
        <TimelineGroup label={upcoming.length ? 'History' : undefined} items={past} hideCompany={hideCompany} hideContact={hideContact} hideApplication={hideApplication} />
      )}
    </div>
  );
}

function TimelineGroup({ label, items, hideCompany, hideContact, hideApplication, upcoming }: {
  label?: string;
  items: Activity[];
  hideCompany?: boolean;
  hideContact?: boolean;
  hideApplication?: boolean;
  upcoming?: boolean;
}) {
  return (
    <div>
      {label && <h3 className="mb-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{label}</h3>}
      <ol className="relative space-y-1">
        {items.map((a, i) => (
          <ActivityItem key={a.id} activity={a} hideCompany={hideCompany} hideContact={hideContact} hideApplication={hideApplication} upcoming={upcoming} last={i === items.length - 1} />
        ))}
      </ol>
    </div>
  );
}

function ActivityItem({ activity, hideCompany, hideContact, hideApplication, upcoming, last }: {
  activity: Activity;
  hideCompany?: boolean;
  hideContact?: boolean;
  hideApplication?: boolean;
  upcoming?: boolean;
  last: boolean;
}) {
  const { companyById, contactById, applicationById, campaigns, deleteActivity } = useData();
  const campaign = activity.campaignId ? campaigns.find((c) => c.id === activity.campaignId) : undefined;
  const navigate = useNavigate();
  const { notify } = useToast();
  const [editing, setEditing] = useState<false | 'edit' | 'notes'>(false);
  // A meeting that's scheduled, or happened without notes, offers "Add meeting notes" directly.
  const offerNotes = activity.type === 'meeting' && !activity.email && (upcoming || !activity.details.trim());
  const [confirming, setConfirming] = useState(false);
  const company = activity.companyId ? companyById.get(activity.companyId) : undefined;
  const contact = activity.contactId ? contactById.get(activity.contactId) : undefined;
  const application = activity.applicationId ? applicationById.get(activity.applicationId) : undefined;
  const showApplication = application && !hideApplication;

  async function handleDelete() {
    setConfirming(false);
    try {
      await deleteActivity(activity.id);
      notify('Activity deleted.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete the activity.', 'error');
    }
  }

  return (
    <li className="group relative flex gap-4 pb-4">
      {!last && <span className="absolute top-9 bottom-0 left-4 w-px bg-neutral-200" aria-hidden="true" />}
      <ActivityTypeIcon type={activity.type} />
      <div className="min-w-0 flex-1 rounded-lg border border-transparent px-1 group-hover:border-neutral-100">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">
              {activity.email ? (
                <Link to={`/emails/${activity.id}`} className="hover:text-ivey-700 hover:underline">{activity.subject || '(no subject)'}</Link>
              ) : (
                activity.subject || '(no subject)'
              )}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-600">
              <span>{ACTIVITY_LABELS[activity.type]}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={activity.occurredAt} title={formatDateTime(activity.occurredAt)}>
                {formatDateTime(activity.occurredAt)}
              </time>
              <span className="text-neutral-500">({relativeFromIso(activity.occurredAt)})</span>
              {upcoming && <Badge className="bg-ivey-50 text-ivey-800 ring-ivey-200">Scheduled</Badge>}
            </p>
          </div>
          <div className="flex gap-1 opacity-70 group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" onClick={() => (activity.email ? navigate(`/emails/${activity.id}`) : setEditing('edit'))} className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" aria-label={`Edit "${activity.subject}"`}>
              <Icon name="pencil" className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setConfirming(true)} className="rounded p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-700" aria-label={`Delete "${activity.subject}"`}>
              <Icon name="trash" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {((!hideCompany && company) || (!hideContact && contact) || showApplication || campaign) && (
          <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs">
            {!hideCompany && company && (
              <Link to={`/companies/${company.id}`} className="inline-flex items-center gap-1 font-medium text-ivey-700 hover:underline">
                <Icon name="building" className="h-3.5 w-3.5" />
                {company.name}
              </Link>
            )}
            {!hideContact && contact && (
              <Link to={`/contacts/${contact.id}`} className="inline-flex items-center gap-1 font-medium text-ivey-700 hover:underline">
                <Icon name="users" className="h-3.5 w-3.5" />
                {fullName(contact)}
              </Link>
            )}
            {showApplication && (
              <Link to={`/applications/${application.id}`} className="inline-flex items-center gap-1 font-medium text-ivey-700 hover:underline">
                <Icon name="briefcase" className="h-3.5 w-3.5" />
                {application.title}
              </Link>
            )}
            {campaign && (
              <Link to={`/campaigns/${campaign.id}`} className="inline-flex items-center gap-1 font-medium text-ivey-700 hover:underline">
                <Icon name="megaphone" className="h-3.5 w-3.5" />
                {campaign.name}
              </Link>
            )}
          </p>
        )}

        {activity.email && (
          <p className="mt-1.5 text-xs text-neutral-600">
            {activity.email.direction === 'received' ? 'From ' : 'To '}
            {activity.email.direction === 'received'
              ? (activity.email.originalSender?.name || activity.email.originalSender?.email || activity.email.from.name || activity.email.from.email || 'unknown sender')
              : activity.email.to || 'unknown recipient'}
            {activity.email.forwarded && ' (forwarded)'}
            {!activity.email.dateKnown && ' · date unknown'}
            {' · '}
            <Link to={`/emails/${activity.id}`} className="font-medium text-ivey-700 hover:underline">Open email</Link>
          </p>
        )}
        {activity.details && <p className="mt-2 text-sm whitespace-pre-line text-neutral-700">{activity.details}</p>}
        {offerNotes && (
          <button type="button" onClick={() => setEditing('notes')} className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 shadow-xs hover:bg-neutral-50">
            <Icon name="note" className="h-3.5 w-3.5" />
            Add meeting notes
          </button>
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(false)}
        title={editing === 'notes' ? 'Add meeting notes' : `Edit ${ACTIVITY_LABELS[activity.type].toLowerCase()}`}
        description={editing === 'notes' && upcoming ? 'Still dated in the future. If it has happened, change the date to when it took place.' : undefined}
        size="lg"
      >
        <ActivityForm activity={activity} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </Modal>
      <ConfirmDialog
        open={confirming}
        title="Delete this activity?"
        message={
          <div className="space-y-2">
            <p>“{activity.subject || '(no subject)'}” will be permanently removed from every history{activity.email ? ', including the original email text' : ''}.</p>
            <p className="text-neutral-600">Companies, contacts, applications and follow-ups aren't affected. Any relationship brief that used it will show as possibly outdated.</p>
          </div>
        }
        confirmLabel="Delete activity"
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </li>
  );
}
