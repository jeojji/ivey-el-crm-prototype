import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { formatDate, formatDateTime } from '../lib/dates';
import { byDueAsc, fullName } from '../lib/selectors';
import { stageIndex, termLabel } from '../lib/applications';
import { APPLICATION_STAGES, STAGE_MEANINGS } from '../lib/options';
import { Button, Card, EmptyState, PageHeader } from '../components/ui';
import { Icon } from '../components/Icon';
import { ConfirmDialog, Modal } from '../components/Modal';
import { AddMenu } from '../components/AddMenu';
import { MoreActions } from '../components/Menu';
import { LatestBriefCard, latestBriefFor } from '../components/LatestBrief';
import { ApplicationForm, DeadlineText, StageBadge, StageSelect } from '../components/applications';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { FollowUpList } from '../components/FollowUpList';
import { FeedbackForm, FeedbackList } from '../components/feedback';
import { LinkedImpact, plural } from '../components/LinkedImpact';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-2.5">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-900">{children}</dd>
    </div>
  );
}

/** The 10 stages in order, with the current one highlighted. Declined/Deferred are off-path outcomes. */
function StageTrack({ stage }: { stage: string }) {
  const current = stageIndex(stage);
  const offPath = stage === 'Declined' || stage === 'Deferred';
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Pipeline stages">
      {APPLICATION_STAGES.map((s, i) => {
        const isCurrent = s === stage;
        const done = !offPath && i < current && i < 8;
        return (
          <li
            key={s}
            title={STAGE_MEANINGS[s]}
            aria-current={isCurrent ? 'step' : undefined}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
              isCurrent
                ? 'bg-ivey-700 text-white ring-ivey-700'
                : done
                  ? 'bg-ivey-50 text-ivey-800 ring-ivey-200'
                  : 'bg-white text-neutral-500 ring-neutral-200'
            } ${i === 8 ? 'ml-2' : ''}`}
          >
            {done && <Icon name="check" className="h-3 w-3" />}
            {s}
          </li>
        );
      })}
    </ol>
  );
}

export function ApplicationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { applicationById, companyById, contactById, activities, tasks, feedback, briefs, updateApplication, deleteApplication } = useData();
  const { notify } = useToast();
  const [modal, setModal] = useState<'edit' | 'feedback' | 'delete' | null>(null);
  const close = () => setModal(null);

  const app = applicationById.get(id);
  if (!app) {
    return (
      <Card>
        <EmptyState icon="briefcase" title="Application not found" message="It may have been deleted."
          action={<Link to="/applications" className="text-sm font-medium text-ivey-700 hover:underline">Back to applications</Link>} />
      </Card>
    );
  }

  const company = companyById.get(app.companyId);
  const contact = app.primaryContactId ? contactById.get(app.primaryContactId) : undefined;
  const prepLink = `/prep?application=${id}&company=${app.companyId}${app.primaryContactId ? `&contact=${app.primaryContactId}` : ''}`;
  const history = activities.filter((a) => a.applicationId === id);
  const openTasks = tasks.filter((t) => t.applicationId === id && t.status === 'open').sort(byDueAsc);
  const doneTasks = tasks.filter((t) => t.applicationId === id && t.status === 'done');
  const idx = stageIndex(app.stage);
  const next = idx >= 0 && idx < 7 ? APPLICATION_STAGES[idx + 1] : null; // Identifying … Active → next step; outcomes have no "next"
  const prev = idx > 0 && idx < 8 ? APPLICATION_STAGES[idx - 1] : null;

  async function move(stage: string) {
    const previous = app!.stage;
    try {
      await updateApplication(id, { stage });
      notify(`Moved to ${stage}.`, 'success', { label: 'Undo', onClick: () => void updateApplication(id, { stage: previous }) });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not change the stage.', 'error');
    }
  }

  async function handleDelete() {
    close();
    try {
      await deleteApplication(id);
      notify(`“${app!.title}” deleted. Its activities and follow-ups were kept.`);
      navigate('/applications');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete the application.', 'error');
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/applications', label: 'Applications' }}
        title={<span className="flex flex-wrap items-center gap-3">{app.title}<StageBadge stage={app.stage} /></span>}
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {company && <Link to={`/companies/${company.id}`} className="inline-flex items-center gap-1 font-medium text-ivey-700 hover:underline"><Icon name="building" className="h-3.5 w-3.5" />{company.name}</Link>}
            {[app.projectType, app.program, termLabel(app)].filter(Boolean).map((x) => <span key={x}>{x}</span>)}
          </span>
        }
        actions={
          <>
            <Link to={prepLink} className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-800 shadow-xs hover:bg-neutral-50">Prepare for conversation</Link>
            <Button variant="secondary" icon="pencil" onClick={() => setModal('edit')}>Edit</Button>
            <MoreActions items={[{ label: 'Delete application…', icon: 'trash', danger: true, onSelect: () => setModal('delete') }]} />
            <AddMenu applicationId={id} />
          </>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Stage</p>
            <StageTrack stage={app.stage} />
            <p className="mt-2 text-sm text-neutral-600">{STAGE_MEANINGS[app.stage as keyof typeof STAGE_MEANINGS] ?? ''}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {prev && <Button variant="secondary" size="sm" onClick={() => move(prev)}>← {prev}</Button>}
            {next && <Button size="sm" onClick={() => move(next)}>Move to {next} →</Button>}
            <div className="w-52"><StageSelect application={app} /></div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <LatestBriefCard brief={latestBriefFor(briefs, (b) => b.applicationId === id)} prepLink={prepLink} />

          <Card title="Scope / description">
            {app.scope ? <p className="text-sm whitespace-pre-line text-neutral-700">{app.scope}</p> : <p className="text-sm text-neutral-600">No scope recorded yet.</p>}
          </Card>

          <Card
            title={`Feedback & outcome (${feedback.filter((f) => f.applicationId === id).length})`}
            action={<Button size="sm" variant="secondary" icon="plus" onClick={() => setModal('feedback')}>Record feedback</Button>}
          >
            <FeedbackList items={feedback.filter((f) => f.applicationId === id)} />
          </Card>

          <Card title={`History (${history.length})`}>
            <ActivityTimeline
              activities={history}
              hideCompany
              hideApplication
              emptyState={<EmptyState compact icon="activity" title="No activity linked yet" message="Use Add to record an email, call, meeting or note about this opportunity, or link an existing one by editing it." />}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Details" action={<Button size="sm" variant="ghost" icon="pencil" onClick={() => setModal('edit')}>Edit</Button>}>
            <dl className="-my-2.5 divide-y divide-neutral-100">
              <Detail label="Company">{company ? <Link to={`/companies/${company.id}`} className="text-ivey-700 hover:underline">{company.name}</Link> : '—'}</Detail>
              <Detail label="Primary contact">{contact ? <Link to={`/contacts/${contact.id}`} className="text-ivey-700 hover:underline">{fullName(contact)}</Link> : <span className="text-neutral-500">Not set</span>}</Detail>
              <Detail label="Project type">{app.projectType || <span className="text-neutral-500">Not set</span>}</Detail>
              <Detail label="Program">{app.program || <span className="text-neutral-500">Not set</span>}</Detail>
              <Detail label="Academic term">{termLabel(app) || <span className="text-neutral-500">Not set</span>}</Detail>
              <Detail label="Participation confirmation deadline"><DeadlineText application={app} /></Detail>
            </dl>
          </Card>

          <Card title={`Open follow-ups (${openTasks.length})`}>
            {openTasks.length ? <FollowUpList tasks={openTasks} showCompany={false} showApplication={false} /> : <p className="text-sm text-neutral-600">No open follow-ups for this application.</p>}
            {doneTasks.length > 0 && <p className="mt-4 text-xs text-neutral-500">{doneTasks.length} completed follow-up{doneTasks.length === 1 ? '' : 's'} not shown.</p>}
          </Card>

          <Card title="Notes">
            {app.notes ? <p className="text-sm whitespace-pre-line text-neutral-700">{app.notes}</p> : <p className="text-sm text-neutral-600">No notes yet.</p>}
          </Card>

          <Card title="Stage history">
            <ol className="space-y-2">
              {[...app.stageHistory].reverse().map((h, i) => (
                <li key={h.changedAt + h.stage + i} className="flex items-center justify-between gap-3 text-sm">
                  <StageBadge stage={h.stage} />
                  <time dateTime={h.changedAt} className="text-xs text-neutral-600">{formatDateTime(h.changedAt)}</time>
                </li>
              ))}
            </ol>
          </Card>
          <p className="px-1 text-xs text-neutral-500">Added {formatDate(app.createdAt)} · Last updated {formatDate(app.updatedAt)}</p>
        </div>
      </div>

      <Modal open={modal === 'edit'} onClose={close} title={`Edit “${app.title}”`} size="xl">
        <ApplicationForm application={app} onSaved={close} onCancel={close} />
      </Modal>
      <Modal open={modal === 'feedback'} onClose={close} title="Record feedback" description={`${app.title}${company ? ` · ${company.name}` : ''}`} size="lg">
        <FeedbackForm applicationId={id} companyId={app.companyId} applicationLabel={`${app.title}${termLabel(app) ? ` (${termLabel(app)})` : ''}`} onDone={close} />
      </Modal>
      <ConfirmDialog
        open={modal === 'delete'}
        title={`Delete “${app.title}”?`}
        message={
          <LinkedImpact
            intro={`The application “${app.title}” and its stage history will be deleted.`}
            items={[
              [history.length, `${plural(history.length, 'activity stays', 'activities stay')} on the company and contact, no longer linked to this application.`],
              [openTasks.length + doneTasks.length, `${plural(openTasks.length + doneTasks.length, 'follow-up stays', 'follow-ups stay')}, no longer linked to it.`],
              [feedback.filter((f) => f.applicationId === id).length, `${plural(feedback.filter((f) => f.applicationId === id).length, 'feedback record stays', 'feedback records stay')} on the company, with the project's name and any flags.`],
            ]}
          />
        }
        confirmLabel="Delete application"
        onConfirm={handleDelete}
        onCancel={close}
      />
    </>
  );
}
