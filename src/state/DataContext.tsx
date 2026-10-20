import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createSampleDatabase } from '../data/seed';
import { emptyDatabase, type BulkWrite, type DataRepository } from '../data/repository';
import type { MigrationPreview } from '../data/migrations';
import { downloadTextFile, timestampForFilename } from '../lib/download';
import { useToast } from './ToastContext';
import { createId } from '../lib/id';
import { DO_NOT_CONTACT } from '../lib/options';
import { fillTemplate, templateValues } from '../lib/campaigns';
import type {
  Activity,
  ActivityInput,
  Application,
  ApplicationInput,
  Brief,
  Campaign,
  Feedback,
  Company,
  CompanyInput,
  Contact,
  ContactInput,
  Database,
  Task,
  TaskInput,
} from '../types';

type LoadStatus = 'loading' | 'needs-upgrade' | 'ready' | 'error';

export interface ContactCompanyChangeOptions {
  /** Move the contact's OPEN follow-ups at their old company to the new one. */
  moveOpenTasks: boolean;
}

interface DataContextValue extends Database {
  status: LoadStatus;
  loadError: string | null;
  /** The whole data set, e.g. for import planning and exports. */
  database: Database;
  pendingMigration: MigrationPreview | null;
  runMigration(): Promise<void>;
  /** Saves a JSON backup file. Returns false if there is nothing to back up. */
  downloadBackup(kind: 'current' | 'pre-upgrade'): Promise<boolean>;
  companyById: Map<string, Company>;
  contactById: Map<string, Contact>;
  applicationById: Map<string, Application>;

  createCompany(input: CompanyInput): Promise<Company>;
  updateCompany(id: string, changes: Partial<CompanyInput>): Promise<Company>;
  deleteCompany(id: string): Promise<void>;

  createContact(input: ContactInput): Promise<Contact>;
  updateContact(id: string, changes: Partial<ContactInput>, options?: ContactCompanyChangeOptions): Promise<Contact>;
  deleteContact(id: string): Promise<void>;

  createActivity(input: ActivityInput): Promise<Activity>;
  updateActivity(id: string, changes: Partial<ActivityInput>): Promise<Activity>;
  deleteActivity(id: string): Promise<void>;

  createApplication(input: Omit<ApplicationInput, 'stageHistory'>): Promise<Application>;
  /** Edits fields. A stage change is recorded in the application's stage history. */
  updateApplication(id: string, changes: Partial<Omit<ApplicationInput, 'stageHistory'>>): Promise<Application>;
  /** Unlinks (but keeps) the application's activities and follow-ups, then deletes it. */
  deleteApplication(id: string): Promise<void>;

  createBrief(input: Omit<Brief, 'id' | 'createdAt' | 'updatedAt'>): Promise<Brief>;
  /** Saves Lauren's edits to the drafts. Never touches the generated content or the sources. */
  updateBriefEdits(id: string, edits: Brief['edits']): Promise<void>;
  deleteBrief(id: string): Promise<void>;
  /** Creates confirmed follow-ups and records them on the brief, in one all-or-nothing write. */
  createTasksFromBrief(briefId: string, tasks: { title: string; dueDate: string }[]): Promise<string[]>;

  createCampaign(input: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'participants'>): Promise<Campaign>;
  updateCampaign(id: string, changes: Partial<Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'participants'>>): Promise<void>;
  /** Deletes the campaign; outreach activities stay in the history, just unlinked. */
  deleteCampaign(id: string): Promise<void>;
  /** Adds contacts as participants. Do Not Contact contacts are refused. */
  addParticipants(campaignId: string, contactIds: string[]): Promise<number>;
  setParticipantStatus(campaignId: string, participantId: string, status: string): Promise<void>;
  updateParticipantNotes(campaignId: string, participantId: string, notes: string): Promise<void>;
  removeParticipant(campaignId: string, participantId: string): Promise<void>;
  /** Records outreach done outside the app: one activity per participant, optional status change, all or nothing. */
  recordOutreach(campaignId: string, o: { participantIds: string[]; type: Activity['type']; occurredAt: string; subject: string; details: string; newStatus: string | null }): Promise<number>;

  createFeedback(input: Omit<Feedback, 'id' | 'createdAt' | 'updatedAt' | 'editHistory'>): Promise<Feedback>;
  /** Edits everything except the original feedback text; changes are kept in the edit history. */
  updateFeedback(id: string, changes: Partial<Omit<Feedback, 'id' | 'createdAt' | 'updatedAt' | 'editHistory' | 'originalText'>>): Promise<void>;
  deleteFeedback(id: string): Promise<void>;

  createTask(input: TaskInput): Promise<Task>;
  updateTask(id: string, changes: Partial<TaskInput>): Promise<Task>;
  /** Mark a follow-up done (or reopen it), keeping completedAt in step with status. */
  setTaskDone(id: string, done: boolean): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  /** Saves several new/updated records in one all-or-nothing write (CSV import, email intake). */
  saveBatch(batch: BulkWrite): Promise<void>;
  /** Replaces everything with a validated backup. */
  restoreBackup(db: Database): Promise<void>;

  resetToSampleData(): Promise<void>;
  clearAllData(): Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

/** Activity fields whose changes are recorded in the activity's edit history. */
export const TRACKED_ACTIVITY_FIELDS = ['subject', 'type', 'occurredAt', 'companyId', 'contactId', 'applicationId', 'details'] as const;

/**
 * Owns the in-memory copy of the data and the business rules that span records.
 * When a shared backend arrives, these rules move server-side and this becomes a thin client.
 */
export function DataProvider({ repository, children }: { repository: DataRepository; children: ReactNode }) {
  const [db, setDb] = useState<Database>(emptyDatabase);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingMigration, setPendingMigration] = useState<MigrationPreview | null>(null);

  useEffect(() => {
    (async () => {
      const pending = await repository.getPendingMigration();
      if (pending) {
        setPendingMigration(pending);
        setStatus('needs-upgrade');
        return;
      }
      setDb(await repository.loadAll());
      setStatus('ready');
    })().catch((err: unknown) => {
      setLoadError(err instanceof Error ? err.message : 'Could not load data.');
      setStatus('error');
    });
  }, [repository]);

  const refresh = useCallback(async () => {
    setDb(await repository.loadAll());
  }, [repository]);

  const { notify } = useToast();
  useEffect(() => {
    if (!repository.subscribe) return;
    return repository.subscribe(() => {
      repository
        .loadAll()
        .then((data) => {
          setDb(data);
          notify('Updated with changes saved in another tab.', 'info');
        })
        .catch(() => undefined);
    });
  }, [repository, notify]);

  const value = useMemo<DataContextValue>(() => {
    const companyById = new Map(db.companies.map((c) => [c.id, c]));
    const contactById = new Map(db.contacts.map((c) => [c.id, c]));
    const applicationById = new Map(db.applications.map((a) => [a.id, a]));

    return {
      ...db,
      status,
      loadError,
      database: db,
      pendingMigration,
      companyById,

      async runMigration() {
        await repository.runMigration();
        setDb(await repository.loadAll());
        setPendingMigration(null);
        setStatus('ready');
      },
      async downloadBackup(kind) {
        const json = await repository.getBackup(kind);
        if (!json) return false;
        const label = kind === 'pre-upgrade' ? 'original-before-upgrade' : 'current';
        downloadTextFile(`el-workspace-backup-${label}-${timestampForFilename()}.json`, json);
        return true;
      },
      contactById,
      applicationById,

      async createCompany(input) {
        const company = await repository.create('companies', input);
        await refresh();
        return company;
      },
      async updateCompany(id, changes) {
        const company = await repository.update('companies', id, changes);
        await refresh();
        return company;
      },
      async deleteCompany(id) {
        const linked =
          db.contacts.some((c) => c.companyId === id) ||
          db.activities.some((a) => a.companyId === id) ||
          db.tasks.some((t) => t.companyId === id) ||
          db.applications.some((a) => a.companyId === id) ||
          db.feedback.some((f) => f.companyId === id);
        if (linked) {
          throw new Error('This company still has linked contacts, applications, activities or follow-ups. Remove or reassign them first.');
        }
        await repository.remove('companies', id);
        await refresh();
      },

      async createContact(input) {
        const contact = await repository.create('contacts', input);
        await refresh();
        return contact;
      },
      async updateContact(id, changes, options) {
        const before = db.contacts.find((c) => c.id === id);
        const contact = await repository.update('contacts', id, changes);
        // Relationship history belongs to the company it happened with: activities and completed
        // follow-ups never move. Only open follow-ups move, and only when the user asks.
        const oldCompanyId = before?.companyId ?? null;
        const companyChanged = changes.companyId !== undefined && changes.companyId !== oldCompanyId;
        if (companyChanged && options?.moveOpenTasks) {
          for (const t of db.tasks.filter((t) => t.contactId === id && t.status === 'open' && t.companyId === oldCompanyId)) {
            await repository.update('tasks', t.id, { companyId: changes.companyId });
          }
        }
        await refresh();
        return contact;
      },
      async deleteContact(id) {
        // History stays on the company record; only the person link is removed.
        for (const a of db.activities.filter((a) => a.contactId === id)) {
          await repository.update('activities', a.id, { contactId: null });
        }
        for (const t of db.tasks.filter((t) => t.contactId === id)) {
          await repository.update('tasks', t.id, { contactId: null });
        }
        for (const a of db.applications.filter((a) => a.primaryContactId === id)) {
          await repository.update('applications', a.id, { primaryContactId: null });
        }
        for (const c of db.campaigns.filter((c) => c.participants.some((p) => p.contactId === id))) {
          await repository.update('campaigns', c.id, { participants: c.participants.filter((p) => p.contactId !== id) });
        }
        await repository.remove('contacts', id);
        await refresh();
      },

      async createActivity(input) {
        const activity = await repository.create('activities', input);
        await refresh();
        return activity;
      },
      async updateActivity(id, changes) {
        const current = db.activities.find((a) => a.id === id);
        if (!current) throw new Error('That activity no longer exists.');
        // The pasted original message is never edited.
        const safe = { ...changes };
        if (current.email && safe.email) safe.email = { ...safe.email, originalText: current.email.originalText, fingerprint: current.email.fingerprint };
        const edits = TRACKED_ACTIVITY_FIELDS.filter((f) => f in safe && (safe[f] ?? null) !== (current[f] ?? null)).map((f) => ({
          field: f,
          from: String(current[f] ?? ''),
          to: String(safe[f] ?? ''),
        }));
        const activity = await repository.update('activities', id, {
          ...safe,
          ...(edits.length ? { editHistory: [...(current.editHistory ?? []), { at: new Date().toISOString(), changes: edits }] } : {}),
        });
        await refresh();
        return activity;
      },
      async deleteActivity(id) {
        await repository.remove('activities', id);
        await refresh();
      },

      async createApplication(input) {
        const application = await repository.create('applications', {
          ...input,
          stageHistory: [{ stage: input.stage, changedAt: new Date().toISOString() }],
        });
        await refresh();
        return application;
      },
      async updateApplication(id, changes) {
        const current = db.applications.find((a) => a.id === id);
        const stageChanged = current && changes.stage !== undefined && changes.stage !== current.stage;
        const application = await repository.update('applications', id, {
          ...changes,
          ...(stageChanged ? { stageHistory: [...current.stageHistory, { stage: changes.stage!, changedAt: new Date().toISOString() }] } : {}),
        });
        await refresh();
        return application;
      },
      async deleteApplication(id) {
        // Feedback stays with the company (it keeps the project's title in applicationLabel).
        for (const f of db.feedback.filter((f) => f.applicationId === id)) {
          await repository.update('feedback', f.id, { applicationId: null });
        }
        // Activities and follow-ups are relationship history: keep them, just remove the link.
        for (const a of db.activities.filter((a) => a.applicationId === id)) {
          await repository.update('activities', a.id, { applicationId: null });
        }
        for (const t of db.tasks.filter((t) => t.applicationId === id)) {
          await repository.update('tasks', t.id, { applicationId: null });
        }
        await repository.remove('applications', id);
        await refresh();
      },

      async createBrief(input) {
        const brief = await repository.create('briefs', input);
        await refresh();
        return brief;
      },
      async updateBriefEdits(id, edits) {
        await repository.update('briefs', id, { edits });
        await refresh();
      },
      async deleteBrief(id) {
        await repository.remove('briefs', id);
        await refresh();
      },
      async createTasksFromBrief(briefId, items) {
        const brief = db.briefs.find((b) => b.id === briefId);
        if (!brief) throw new Error('That brief no longer exists.');
        const ids = items.map(() => createId());
        await repository.bulkWrite({
          creates: {
            tasks: items.map((t, i) => ({
              id: ids[i],
              input: {
                title: t.title,
                dueDate: t.dueDate,
                status: 'open' as const,
                companyId: brief.companyId,
                contactId: brief.contactId,
                applicationId: brief.applicationId,
                notes: 'From a suggested next step in conversation prep (local AI); wording and due date confirmed by you.',
                completedAt: null,
              },
            })),
          },
          updates: { briefs: [{ id: briefId, changes: { createdTaskIds: [...brief.createdTaskIds, ...ids] } }] },
        });
        await refresh();
        return ids;
      },

      async createCampaign(input) {
        const campaign = await repository.create('campaigns', { ...input, participants: [] });
        await refresh();
        return campaign;
      },
      async updateCampaign(id, changes) {
        await repository.update('campaigns', id, changes);
        await refresh();
      },
      async deleteCampaign(id) {
        for (const a of db.activities.filter((a) => a.campaignId === id)) {
          await repository.update('activities', a.id, { campaignId: null });
        }
        await repository.remove('campaigns', id);
        await refresh();
      },
      async addParticipants(campaignId, contactIds) {
        const campaign = db.campaigns.find((c) => c.id === campaignId);
        if (!campaign) throw new Error('That campaign no longer exists.');
        const blocked = contactIds.filter((cid) => db.contacts.find((c) => c.id === cid)?.priority === DO_NOT_CONTACT);
        if (blocked.length) throw new Error('Do Not Contact contacts can’t be added to outreach.');
        const now = new Date().toISOString();
        const existing = new Set(campaign.participants.map((p) => p.contactId));
        const added = contactIds
          .filter((cid) => !existing.has(cid) && db.contacts.some((c) => c.id === cid))
          .map((cid) => ({
            id: createId(),
            contactId: cid,
            companyId: db.contacts.find((c) => c.id === cid)?.companyId ?? null,
            status: 'Identifying',
            statusHistory: [{ status: 'Identifying', changedAt: now }],
            notes: '',
            addedAt: now,
          }));
        await repository.update('campaigns', campaignId, { participants: [...campaign.participants, ...added] });
        await refresh();
        return added.length;
      },
      async setParticipantStatus(campaignId, participantId, status) {
        const campaign = db.campaigns.find((c) => c.id === campaignId);
        if (!campaign) throw new Error('That campaign no longer exists.');
        const now = new Date().toISOString();
        await repository.update('campaigns', campaignId, {
          participants: campaign.participants.map((p) =>
            p.id === participantId && p.status !== status ? { ...p, status, statusHistory: [...p.statusHistory, { status, changedAt: now }] } : p,
          ),
        });
        await refresh();
      },
      async updateParticipantNotes(campaignId, participantId, notes) {
        const campaign = db.campaigns.find((c) => c.id === campaignId);
        if (!campaign) throw new Error('That campaign no longer exists.');
        await repository.update('campaigns', campaignId, { participants: campaign.participants.map((p) => (p.id === participantId ? { ...p, notes } : p)) });
        await refresh();
      },
      async removeParticipant(campaignId, participantId) {
        const campaign = db.campaigns.find((c) => c.id === campaignId);
        if (!campaign) throw new Error('That campaign no longer exists.');
        await repository.update('campaigns', campaignId, { participants: campaign.participants.filter((p) => p.id !== participantId) });
        await refresh();
      },
      async recordOutreach(campaignId, o) {
        const campaign = db.campaigns.find((c) => c.id === campaignId);
        if (!campaign) throw new Error('That campaign no longer exists.');
        const chosen = campaign.participants.filter((p) => o.participantIds.includes(p.id));
        const contacts = chosen.map((p) => db.contacts.find((c) => c.id === p.contactId));
        if (contacts.some((c) => !c)) throw new Error('A selected contact no longer exists.');
        if (contacts.some((c) => c!.priority === DO_NOT_CONTACT)) throw new Error('Outreach can’t be recorded for Do Not Contact contacts.');
        const now = new Date().toISOString();
        await repository.bulkWrite({
          creates: {
            activities: chosen.map((p, i) => ({
              id: createId(),
              input: {
                type: o.type,
                // Template placeholders ({{firstName}}, {{companyName}}…) are filled for each person.
                subject: fillTemplate(o.subject, templateValues(db, campaign, p.contactId)).trim(),
                details: fillTemplate(o.details, templateValues(db, campaign, p.contactId)).trim(),
                occurredAt: o.occurredAt,
                companyId: contacts[i]!.companyId,
                contactId: p.contactId,
                applicationId: null,
                campaignId,
                source: 'manual' as const,
              },
            })),
          },
          updates: o.newStatus
            ? {
                campaigns: [{
                  id: campaignId,
                  changes: {
                    participants: campaign.participants.map((p) =>
                      o.participantIds.includes(p.id) && p.status !== o.newStatus
                        ? { ...p, status: o.newStatus!, statusHistory: [...p.statusHistory, { status: o.newStatus!, changedAt: now }] }
                        : p,
                    ),
                  },
                }],
              }
            : {},
        });
        await refresh();
        return chosen.length;
      },

      async createFeedback(input) {
        const fb = await repository.create('feedback', { ...input, editHistory: [] });
        await refresh();
        return fb;
      },
      async updateFeedback(id, changes) {
        const current = db.feedback.find((f) => f.id === id);
        if (!current) throw new Error('That feedback no longer exists.');
        const safe = { ...changes } as Record<string, unknown>;
        delete safe.originalText; // the original feedback text is never edited
        const show = (v: unknown) => (Array.isArray(v) ? v.map((x) => (typeof x === 'object' && x ? (x as { flag: string }).flag : String(x))).join('; ') : String(v ?? ''));
        const edits = (['source', 'givenBy', 'receivedOn', 'outcome', 'notes', 'flags', 'applicationId'] as const)
          .filter((k) => k in safe && show(safe[k]) !== show(current[k]))
          .map((k) => ({ field: k, from: show(current[k]), to: show(safe[k]) }));
        await repository.update('feedback', id, {
          ...safe,
          ...(edits.length ? { editHistory: [...current.editHistory, { at: new Date().toISOString(), changes: edits }] } : {}),
        });
        await refresh();
      },
      async deleteFeedback(id) {
        await repository.remove('feedback', id);
        await refresh();
      },

      async createTask(input) {
        const task = await repository.create('tasks', input);
        await refresh();
        return task;
      },
      async updateTask(id, changes) {
        const task = await repository.update('tasks', id, changes);
        await refresh();
        return task;
      },
      async setTaskDone(id, done) {
        const task = await repository.update('tasks', id, {
          status: done ? 'done' : 'open',
          completedAt: done ? new Date().toISOString() : null,
        });
        await refresh();
        return task;
      },
      async deleteTask(id) {
        await repository.remove('tasks', id);
        await refresh();
      },

      async saveBatch(batch) {
        await repository.bulkWrite(batch);
        await refresh();
      },
      async restoreBackup(backup) {
        await repository.replaceAll(backup);
        await refresh();
      },

      async resetToSampleData() {
        await repository.replaceAll(createSampleDatabase());
        await refresh();
      },
      async clearAllData() {
        await repository.replaceAll(emptyDatabase());
        await refresh();
      },
    };
  }, [db, status, loadError, pendingMigration, repository, refresh]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
