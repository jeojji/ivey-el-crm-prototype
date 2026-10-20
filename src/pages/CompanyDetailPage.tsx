import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useToast } from '../state/ToastContext';
import { formatDate, relativeFromIso } from '../lib/dates';
import { ACTIVITY_LABELS, byDueAsc, byOccurredDesc, fullName, isFuture, lastCommunicationAt } from '../lib/selectors';
import { Avatar, Button, Card, Chips, EmptyState, PageHeader, PriorityBadge, ReviewNotice, StatusBadges, TabPanel, Tabs, inputClass } from '../components/ui';
import { DO_NOT_CONTACT } from '../lib/options';
import { PROJECT_TYPES, shortLabel } from '../lib/options';
import { companyReviewIssues, formatAddress } from '../lib/review';
import { Icon, type IconName } from '../components/Icon';
import { ConfirmDialog, Modal } from '../components/Modal';
import { CompanyForm } from '../components/CompanyForm';
import { ActivityTimeline, ActivityTypeIcon } from '../components/ActivityTimeline';
import { FollowUpList } from '../components/FollowUpList';
import { ApplicationMiniList, StageBadge } from '../components/applications';
import { CompanyFlags } from '../components/feedback';
import { isClosed, termSortKey } from '../lib/applications';
import { AddMenu } from '../components/AddMenu';
import { MoreActions } from '../components/Menu';
import { LatestBriefCard, latestBriefFor } from '../components/LatestBrief';
import type { Contact } from '../types';

const TABS = ['overview', 'applications', 'history', 'details'] as const;
type Tab = (typeof TABS)[number];

/** One of the four answers at the top of a company profile. */
function Answer({ question, children, more }: { question: string; children: ReactNode; more?: ReactNode }) {
  return (
    <section aria-label={question} className="flex min-w-0 flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{question}</h2>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {more && <div className="mt-3 text-xs">{more}</div>}
    </section>
  );
}

const linkButton = 'font-medium text-ivey-700 hover:underline';

function Detail({ label, icon, children }: { label: string; icon?: IconName; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      {icon && <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />}
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-neutral-500">{label}</dt>
        <dd className="mt-0.5 text-sm break-words whitespace-pre-line text-neutral-900">{children}</dd>
      </div>
    </div>
  );
}

const notRecorded = <span className="text-neutral-500">Not recorded</span>;

export function CompanyDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { companyById, contactById, contacts, activities, tasks, applications, briefs, feedback, updateCompany, deleteCompany } = useData();
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'overview';
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });
  /** Opens Overview and brings one of its lists into view, with keyboard focus on it. */
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const showOnOverview = (sectionId: string) => {
    setTab('overview');
    setFocusTarget(sectionId);
  };
  // Runs after the Overview tab has rendered, so the list exists before it is scrolled to and focused.
  useEffect(() => {
    if (!focusTarget || tab !== 'overview') return;
    const el = document.getElementById(focusTarget);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
    setFocusTarget(null);
  }, [focusTarget, tab]);
  const [modal, setModal] = useState<'edit' | 'delete' | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  const company = companyById.get(id);
  if (!company) {
    return (
      <Card>
        <EmptyState icon="building" title="Company not found" message="It may have been deleted." action={<Link to="/companies" className="text-sm font-medium text-ivey-700 hover:underline">Back to companies</Link>} />
      </Card>
    );
  }

  const people = contacts.filter((c) => c.companyId === id).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const history = activities.filter((a) => a.companyId === id);
  const lastComm = lastCommunicationAt(history);
  const feedbackCount = feedback.filter((f) => f.companyId === id && f.flags.length > 0).length;
  // Amber only when a flag is a caution; positive feedback alone stays neutral.
  const seriousFlags = feedback.some((f) => f.companyId === id && f.flags.some((fl) => fl.flag !== 'Positive feedback'));
  const latestBrief = latestBriefFor(briefs, (b) => b.companyId === id);
  const openTasks = tasks.filter((t) => t.companyId === id && t.status === 'open').sort(byDueAsc);
  const companyApps = applications.filter((a) => a.companyId === id).sort((a, b) => termSortKey(b) - termSortKey(a) || a.title.localeCompare(b.title));
  const openApps = companyApps.filter((a) => !isClosed(a));
  const doneCount = tasks.filter((t) => t.companyId === id && t.status === 'done').length;
  const now = Date.now();
  const past = history.filter((a) => !isFuture(a, now)).sort(byOccurredDesc);
  const latest = past[0];
  const latestContact = latest?.contactId ? contactById.get(latest.contactId) : undefined;
  const nextMeeting = history.filter((a) => a.type === 'meeting' && isFuture(a, now)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];

  // "Who is the contact?": the person in the most recent exchange, else the primary contact on an
  // open application, else the first contact. Only people currently at this company count.
  const atCompany = (cid?: string | null) => (cid ? people.find((p) => p.id === cid) : undefined);
  const recentPerson = past.map((a) => atCompany(a.contactId)).find(Boolean);
  const appPerson = openApps.map((a) => atCompany(a.primaryContactId)).find(Boolean);
  const keyContact: Contact | undefined = recentPerson ?? appPerson ?? people[0];
  const keyReason = recentPerson ? 'Most recent person in the history' : appPerson ? 'Primary contact on an open application' : people.length > 1 ? 'First of the contacts listed' : '';
  const prepLink = `/prep?company=${id}`;
  const close = () => setModal(null);

  async function saveNotes() {
    try {
      await updateCompany(id, { notes: notesDraft.trim() });
      setEditingNotes(false);
      notify('Relationship notes saved.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save notes.', 'error');
    }
  }

  async function handleDelete() {
    close();
    try {
      await deleteCompany(id);
      notify(`${company!.name} deleted.`);
      navigate('/companies');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete the company.', 'error');
    }
  }

  const hasLinks = people.length > 0 || history.length > 0 || tasks.some((t) => t.companyId === id) || companyApps.length > 0 || feedback.some((f) => f.companyId === id);

  return (
    <>
      <PageHeader
        back={{ to: '/companies', label: 'Companies' }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {company.name}
            <StatusBadges statuses={company.statuses} />
            {company.priority && <PriorityBadge priority={company.priority} />}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {company.industry && <span title={company.industry}>{shortLabel(company.industry)}</span>}
            {company.address.city && <span className="inline-flex items-center gap-1"><Icon name="mapPin" className="h-3.5 w-3.5" />{company.address.city}</span>}
            {company.website && <span className="inline-flex items-center gap-1"><Icon name="globe" className="h-3.5 w-3.5" />{company.website}</span>}
            {company.phone && <span className="inline-flex items-center gap-1"><Icon name="phone" className="h-3.5 w-3.5" />{company.phone}</span>}
          </span>
        }
        actions={
          <>
            <Link to={prepLink} className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-800 shadow-xs hover:bg-neutral-50">Prepare for conversation</Link>
            <Button variant="secondary" icon="pencil" onClick={() => setModal('edit')}>Edit</Button>
            <MoreActions items={[{ label: 'Delete company…', icon: 'trash', danger: true, onSelect: () => setModal('delete') }]} />
            <AddMenu companyId={id} />
          </>
        }
      />

      <ReviewNotice issues={companyReviewIssues(company)} />

      {feedbackCount > 0 && (
        <section aria-label="Feedback flags" className={`mb-6 rounded-xl border px-5 py-4 ${seriousFlags ? 'border-amber-200 bg-amber-50/40' : 'border-neutral-200 bg-white'}`}>
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">Feedback flags</h2>
          <CompanyFlags companyId={id} context="profile" />
        </section>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Answer
          question="Who is the contact?"
          more={people.length > 1 && <button type="button" className={linkButton} onClick={() => showOnOverview('company-contacts')}>All {people.length} contacts</button>}
        >
          {keyContact ? (
            <>
              <Link to={`/contacts/${keyContact.id}`} className="font-semibold text-neutral-950 hover:text-ivey-700 hover:underline">{fullName(keyContact)}</Link>
              {keyContact.priority === DO_NOT_CONTACT && <span className="ml-2 align-middle"><PriorityBadge priority={DO_NOT_CONTACT} /></span>}
              {keyContact.jobTitle && <p className="text-neutral-700">{keyContact.jobTitle}</p>}
              <p className="mt-1 break-words text-xs text-neutral-600">{[keyContact.email, keyContact.workPhone || keyContact.mobilePhone].filter(Boolean).join(' · ') || 'No email or phone recorded'}</p>
              {keyReason && <p className="mt-1 text-xs text-neutral-500">{keyReason}</p>}
            </>
          ) : (
            <p className="text-neutral-600">No contacts yet. Use Add → Contact.</p>
          )}
        </Answer>

        <Answer
          question="What happened most recently?"
          more={past.length > 0 && <button type="button" className={linkButton} onClick={() => setTab('history')}>Full history ({history.length})</button>}
        >
          {latest ? (
            <div className="flex gap-2.5">
              <ActivityTypeIcon type={latest.type} />
              <div className="min-w-0">
                <p className="font-semibold text-neutral-950">
                  {latest.email ? <Link to={`/emails/${latest.id}`} className="hover:text-ivey-700 hover:underline">{latest.subject || '(no subject)'}</Link> : latest.subject || '(no subject)'}
                </p>
                <p className="text-xs text-neutral-600">
                  {ACTIVITY_LABELS[latest.type]} · {latest.email && !latest.email.dateKnown ? 'date unknown' : relativeFromIso(latest.occurredAt)}
                  {latestContact && ` · ${fullName(latestContact)}`}
                </p>
                {latest.details && <p className="mt-1 line-clamp-2 text-xs text-neutral-700">{latest.details}</p>}
              </div>
            </div>
          ) : (
            <p className="text-neutral-600">Nothing recorded yet.</p>
          )}
          {nextMeeting && <p className="mt-2 text-xs text-neutral-700"><span className="font-medium">Next meeting:</span> {nextMeeting.subject}, {formatDate(nextMeeting.occurredAt)}</p>}
        </Answer>

        <Answer
          question="Which applications are open?"
          more={companyApps.length > 0 && <button type="button" className={linkButton} onClick={() => setTab('applications')}>All applications ({companyApps.length})</button>}
        >
          {openApps.length ? (
            <ul className="space-y-2">
              {openApps.slice(0, 3).map((a) => (
                <li key={a.id} className="min-w-0">
                  <Link to={`/applications/${a.id}`} className="block truncate font-medium text-neutral-950 hover:text-ivey-700 hover:underline" title={a.title}>{a.title}</Link>
                  <StageBadge stage={a.stage} />
                </li>
              ))}
              {openApps.length > 3 && <li className="text-xs text-neutral-600">+{openApps.length - 3} more open</li>}
            </ul>
          ) : (
            <p className="text-neutral-600">{companyApps.length ? 'None open. Past applications are under Applications.' : 'No applications yet.'}</p>
          )}
        </Answer>

        <Answer
          question="What is the next follow-up?"
          more={openTasks.length > 1 && <button type="button" className={linkButton} onClick={() => showOnOverview('company-follow-ups')}>All {openTasks.length} open follow-ups</button>}
        >
          {openTasks[0] ? <FollowUpList tasks={[openTasks[0]]} showCompany={false} /> : <p className="text-neutral-600">No open follow-ups.</p>}
        </Answer>
      </div>

      <Tabs
        label={`${company.name} sections`}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'applications', label: 'Applications', count: companyApps.length },
          { id: 'history', label: 'History', count: history.length },
          { id: 'details', label: 'Details' },
        ]}
      />

      {tab === 'overview' && (
        <TabPanel id="overview">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <LatestBriefCard brief={latestBrief} prepLink={prepLink} />
              <Card
                title="Relationship notes"
                action={!editingNotes && (
                  <Button size="sm" variant="ghost" icon="pencil" onClick={() => { setNotesDraft(company.notes); setEditingNotes(true); }}>Edit notes</Button>
                )}
              >
                {editingNotes ? (
                  <div>
                    <label htmlFor="company-notes" className="sr-only">Relationship notes</label>
                    <textarea id="company-notes" rows={6} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} className={inputClass} autoFocus />
                    <div className="mt-3 flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditingNotes(false)}>Cancel</Button>
                      <Button size="sm" onClick={saveNotes}>Save notes</Button>
                    </div>
                  </div>
                ) : company.notes ? (
                  <p className="text-sm whitespace-pre-line text-neutral-700">{company.notes}</p>
                ) : (
                  <p className="text-sm text-neutral-600">No notes yet. Use notes for lasting context such as preferences, timing and who decides.</p>
                )}
              </Card>
            </div>
            <div className="space-y-6">
              <div id="company-contacts" tabIndex={-1} className="scroll-mt-6 rounded-xl focus-visible:outline-2 focus-visible:outline-ivey-600">
              <Card title={`Contacts (${people.length})`}>
                {people.length === 0 ? (
                  <EmptyState compact icon="users" title="No contacts yet" message="Use Add → Contact to add the people you work with here." />
                ) : (
                  <ul className="-my-1 divide-y divide-neutral-100">
                    {people.map((p) => (
                      <li key={p.id}>
                        <Link to={`/contacts/${p.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-neutral-50">
                          <Avatar name={fullName(p)} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-neutral-900">{fullName(p)}{p.priority === DO_NOT_CONTACT && <span className="ml-1.5 text-xs font-semibold text-red-800">Do Not Contact</span>}</span>
                            <span className="block truncate text-xs text-neutral-600">{p.jobTitle || p.email || 'No title'}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              </div>
              <div id="company-follow-ups" tabIndex={-1} className="scroll-mt-6 rounded-xl focus-visible:outline-2 focus-visible:outline-ivey-600">
              <Card title={`Open follow-ups (${openTasks.length})`}>
                {openTasks.length === 0 ? (
                  <p className="text-sm text-neutral-600">No open follow-ups. Use Add → Follow-up.</p>
                ) : (
                  <FollowUpList tasks={openTasks} showCompany={false} />
                )}
                {doneCount > 0 && <p className="mt-4 text-xs text-neutral-500">{doneCount} completed follow-up{doneCount === 1 ? '' : 's'} not shown. <Link to={`/follow-ups?view=done`} className={linkButton}>See completed</Link></p>}
              </Card>
              </div>
            </div>
          </div>
        </TabPanel>
      )}

      {tab === 'applications' && (
        <TabPanel id="applications">
          <Card title={`Applications (${companyApps.length})`}>
            {companyApps.length ? (
              <ApplicationMiniList applications={companyApps} />
            ) : (
              <EmptyState compact icon="briefcase" title="No applications yet" message="Use Add → Application to track an engagement opportunity through its stages." />
            )}
            <p className="mt-3 text-xs text-neutral-500">Each application has its own stage, separate from the partner status.</p>
          </Card>
        </TabPanel>
      )}

      {tab === 'history' && (
        <TabPanel id="history">
          <Card title={`History (${history.length})`}>
            <ActivityTimeline
              activities={history}
              hideCompany
              emptyState={<EmptyState compact icon="activity" title="Nothing recorded yet" message="Use Add to record an email, call, meeting or note with this company." />}
            />
          </Card>
        </TabPanel>
      )}

      {tab === 'details' && (
        <TabPanel id="details">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card title="Partnership" action={<Button size="sm" variant="ghost" icon="pencil" onClick={() => setModal('edit')}>Edit</Button>}>
              <dl className="-my-2.5 divide-y divide-neutral-100">
                <Detail label="Partnership priority">{company.priority ? <PriorityBadge priority={company.priority} /> : notRecorded}</Detail>
                <Detail label="Partner status">{company.statuses.length ? <StatusBadges statuses={company.statuses} /> : notRecorded}</Detail>
                <Detail label="Project participation"><Chips values={company.projectParticipation} known={PROJECT_TYPES} /></Detail>
                <Detail label="Last project participated">{company.lastProjectDate ? formatDate(company.lastProjectDate) : notRecorded}</Detail>
                <Detail label="Last communication (from history)">
                  {lastComm ? `${formatDate(lastComm)} (${relativeFromIso(lastComm).toLowerCase()})` : <span className="text-neutral-500">No emails, calls or meetings recorded</span>}
                </Detail>
              </dl>
            </Card>
            <div className="space-y-6">
              <Card title="Company details" action={<Button size="sm" variant="ghost" icon="pencil" onClick={() => setModal('edit')}>Edit</Button>}>
                <dl className="-my-2.5 divide-y divide-neutral-100">
                  <Detail label="Industry" icon="building">{company.industry || notRecorded}</Detail>
                  <Detail label="Company phone" icon="phone">{company.phone || notRecorded}</Detail>
                  <Detail label="Website" icon="globe">{company.website || notRecorded}</Detail>
                  <Detail label="Address" icon="mapPin">{formatAddress(company.address, true) || notRecorded}</Detail>
                  <Detail label="About the company" icon="info">{company.description || notRecorded}</Detail>
                </dl>
                {company.legacy && Object.keys(company.legacy).length > 0 && (
                  <p className="mt-4 text-xs text-neutral-500">
                    Before the data upgrade:{' '}
                    {Object.entries(company.legacy).map(([k, v]) => `${k === 'status' ? 'status' : k} “${v}”`).join(', ')}.
                  </p>
                )}
              </Card>
              {feedbackCount === 0 && (
                <Card title="Feedback flags">
                  <CompanyFlags companyId={id} context="profile" />
                </Card>
              )}
              <p className="px-1 text-xs text-neutral-500">Added {formatDate(company.createdAt)} · Last updated {formatDate(company.updatedAt)}</p>
            </div>
          </div>
        </TabPanel>
      )}

      <Modal open={modal === 'edit'} onClose={close} title={`Edit ${company.name}`} size="xl">
        <CompanyForm company={company} onSaved={close} onCancel={close} />
      </Modal>
      {hasLinks ? (
        <Modal open={modal === 'delete'} onClose={close} title="This company can't be deleted yet">
          <p className="text-sm text-neutral-700">
            {company.name} still has linked records, so it can't be deleted without losing relationship history:
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-neutral-700">
            {[
              [people.length, 'contact', 'contacts'],
              [history.length, 'activity', 'activities'],
              [tasks.filter((t) => t.companyId === id).length, 'follow-up', 'follow-ups'],
              [companyApps.length, 'application', 'applications'],
              [feedback.filter((f) => f.companyId === id).length, 'feedback record', 'feedback records'],
            ].filter(([n]) => (n as number) > 0).map(([n, one, many]) => <li key={one as string}>{n as number} {n === 1 ? one : many}</li>)}
          </ul>
          <p className="mt-2 text-sm text-neutral-600">Move or delete those first. If the company is simply no longer active, change its partner status instead.</p>
          <div className="-mx-6 mt-6 -mb-5 flex justify-end border-t border-neutral-100 bg-neutral-50 px-6 py-4">
            <Button variant="secondary" onClick={close}>OK</Button>
          </div>
        </Modal>
      ) : (
        <ConfirmDialog open={modal === 'delete'} title={`Delete ${company.name}?`} message="This permanently removes the company and its notes." confirmLabel="Delete company" onConfirm={handleDelete} onCancel={close} />
      )}
    </>
  );
}
