import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createSampleDatabase } from '../data/seed';
import { emptyDatabase, type DataRepository } from '../data/repository';
import type { MigrationPreview } from '../data/migrations';
import { downloadTextFile, timestampForFilename } from '../lib/download';
import type {
  Activity,
  ActivityInput,
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
  pendingMigration: MigrationPreview | null;
  runMigration(): Promise<void>;
  /** Saves a JSON backup file. Returns false if there is nothing to back up. */
  downloadBackup(kind: 'current' | 'pre-upgrade'): Promise<boolean>;
  companyById: Map<string, Company>;
  contactById: Map<string, Contact>;

  createCompany(input: CompanyInput): Promise<Company>;
  updateCompany(id: string, changes: Partial<CompanyInput>): Promise<Company>;
  deleteCompany(id: string): Promise<void>;

  createContact(input: ContactInput): Promise<Contact>;
  updateContact(id: string, changes: Partial<ContactInput>, options?: ContactCompanyChangeOptions): Promise<Contact>;
  deleteContact(id: string): Promise<void>;

  createActivity(input: ActivityInput): Promise<Activity>;
  updateActivity(id: string, changes: Partial<ActivityInput>): Promise<Activity>;
  deleteActivity(id: string): Promise<void>;

  createTask(input: TaskInput): Promise<Task>;
  updateTask(id: string, changes: Partial<TaskInput>): Promise<Task>;
  /** Mark a follow-up done (or reopen it), keeping completedAt in step with status. */
  setTaskDone(id: string, done: boolean): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  resetToSampleData(): Promise<void>;
  clearAllData(): Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

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

  const value = useMemo<DataContextValue>(() => {
    const companyById = new Map(db.companies.map((c) => [c.id, c]));
    const contactById = new Map(db.contacts.map((c) => [c.id, c]));

    return {
      ...db,
      status,
      loadError,
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
          db.tasks.some((t) => t.companyId === id);
        if (linked) {
          throw new Error('This company still has linked contacts, activities or follow-ups. Remove or reassign them first.');
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
        await repository.remove('contacts', id);
        await refresh();
      },

      async createActivity(input) {
        const activity = await repository.create('activities', input);
        await refresh();
        return activity;
      },
      async updateActivity(id, changes) {
        const activity = await repository.update('activities', id, changes);
        await refresh();
        return activity;
      },
      async deleteActivity(id) {
        await repository.remove('activities', id);
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
