import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createSampleDatabase } from '../data/seed';
import { emptyDatabase, type DataRepository } from '../data/repository';
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

type LoadStatus = 'loading' | 'ready' | 'error';

interface DataContextValue extends Database {
  status: LoadStatus;
  loadError: string | null;
  companyById: Map<string, Company>;
  contactById: Map<string, Contact>;

  createCompany(input: CompanyInput): Promise<Company>;
  updateCompany(id: string, changes: Partial<CompanyInput>): Promise<Company>;
  deleteCompany(id: string): Promise<void>;

  createContact(input: ContactInput): Promise<Contact>;
  updateContact(id: string, changes: Partial<ContactInput>): Promise<Contact>;
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

  useEffect(() => {
    repository
      .loadAll()
      .then((data) => {
        setDb(data);
        setStatus('ready');
      })
      .catch((err: unknown) => {
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
      companyById,
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
      async updateContact(id, changes) {
        const contact = await repository.update('contacts', id, changes);
        // Keep the contact's activities and follow-ups attached to their (new) company.
        if (changes.companyId !== undefined) {
          for (const a of db.activities.filter((a) => a.contactId === id)) {
            await repository.update('activities', a.id, { companyId: changes.companyId });
          }
          for (const t of db.tasks.filter((t) => t.contactId === id)) {
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
  }, [db, status, loadError, repository, refresh]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
