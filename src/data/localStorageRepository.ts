import { createId } from '../lib/id';
import { SCHEMA_VERSION, type CollectionName, type Database, type EntityInput, type EntityMap } from '../types';
import { isV1Database, isV2Database, previewMigration, upgradeToCurrent, type MigrationPreview, type V1Database, type V2Database } from './migrations';
import type { BulkWrite, DataRepository } from './repository';
import { createSampleDatabase } from './seed';

export const STORAGE_KEY = 'el-relationship-workspace:v3';
/**
 * Older schemas, newest first. This version never writes or deletes them, so they double as
 * pre-upgrade backups.
 */
export const LEGACY_STORAGE_KEYS = ['el-relationship-workspace:v2', 'el-relationship-workspace:v1'] as const;

function isDatabase(value: unknown): value is Database {
  if (!value || typeof value !== 'object') return false;
  const db = value as Record<string, unknown>;
  return (
    db.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(db.companies) &&
    Array.isArray(db.contacts) &&
    Array.isArray(db.activities) &&
    Array.isArray(db.tasks) &&
    Array.isArray(db.applications) &&
    ['briefs', 'campaigns', 'feedback'].every((k) => db[k] === undefined || Array.isArray(db[k]))
  );
}

/** Lists added after schema 3 shipped: data saved before they existed simply has none yet. */
export function withOptionalLists(db: Database): Database {
  return { ...db, briefs: db.briefs ?? [], campaigns: db.campaigns ?? [], feedback: db.feedback ?? [] };
}

function getItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    throw new Error(
      'This browser is blocking local storage, so the prototype cannot save data. Try a normal (non-private) window.',
    );
  }
}

function parse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Prototype persistence in the browser's localStorage.
 * Not secure, not shared between people or devices, and erased if browser data is cleared.
 */
export class LocalStorageRepository implements DataRepository {
  private cache: Database | null = null;

  /** The newest older-schema data, if the current schema hasn't been saved yet. */
  private legacyData(): V1Database | V2Database | null {
    if (getItem(STORAGE_KEY)) return null;
    for (const key of LEGACY_STORAGE_KEYS) {
      const parsed = parse(getItem(key));
      if (isV2Database(parsed) || isV1Database(parsed)) return parsed;
    }
    return null;
  }

  async getPendingMigration(): Promise<MigrationPreview | null> {
    const legacy = this.legacyData();
    return legacy ? previewMigration(legacy) : null;
  }

  async runMigration(): Promise<void> {
    const legacy = this.legacyData();
    if (!legacy) return;
    this.write(upgradeToCurrent(legacy));
  }

  async getBackup(kind: 'current' | 'pre-upgrade'): Promise<string | null> {
    if (kind === 'pre-upgrade') {
      for (const key of LEGACY_STORAGE_KEYS) {
        const raw = getItem(key);
        if (raw) return raw;
      }
      return null;
    }
    return JSON.stringify(this.read(), null, 2);
  }

  private read(): Database {
    if (this.cache) return this.cache;
    if (this.legacyData()) throw new Error('Saved data needs upgrading before it can be opened.');

    const raw = getItem(STORAGE_KEY);
    const parsed = parse(raw);
    if (isDatabase(parsed)) {
      // Data saved before briefs existed simply has none yet.
      this.cache = withOptionalLists(parsed);
      return this.cache;
    }
    if (raw) {
      // Keep unreadable data instead of silently discarding it.
      try {
        window.localStorage.setItem(`${STORAGE_KEY}:unreadable-backup`, raw);
      } catch {
        // ignore
      }
    }

    const seeded = createSampleDatabase();
    this.write(seeded);
    return seeded;
  }

  private write(db: Database): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      throw new Error('Could not save. Browser storage may be full or blocked.');
    }
    this.cache = db;
  }

  async loadAll(): Promise<Database> {
    return this.read();
  }

  async create<K extends CollectionName>(collection: K, input: EntityInput<K>): Promise<EntityMap[K]> {
    const db = this.read();
    const now = new Date().toISOString();
    const entity = { ...input, id: createId(), createdAt: now, updatedAt: now } as unknown as EntityMap[K];
    const list = (db[collection] ?? []) as unknown as EntityMap[K][];
    this.write({ ...db, [collection]: [...list, entity] });
    return entity;
  }

  async update<K extends CollectionName>(
    collection: K,
    id: string,
    changes: Partial<EntityInput<K>>,
  ): Promise<EntityMap[K]> {
    const db = this.read();
    const list = (db[collection] ?? []) as unknown as EntityMap[K][];
    const existing = list.find((item) => item.id === id);
    if (!existing) throw new Error('That record no longer exists. It may have been deleted.');
    const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() } as EntityMap[K];
    this.write({ ...db, [collection]: list.map((item) => (item.id === id ? updated : item)) });
    return updated;
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    const db = this.read();
    const list = (db[collection] ?? []) as { id: string }[];
    this.write({ ...db, [collection]: list.filter((item) => item.id !== id) });
  }

  async bulkWrite(batch: BulkWrite): Promise<void> {
    const now = new Date().toISOString();
    const next: Database = { ...this.read() };
    for (const collection of ['companies', 'contacts', 'activities', 'tasks', 'applications', 'briefs', 'campaigns', 'feedback'] as const) {
      let list = ((next[collection] as unknown as { id: string }[] | undefined) ?? []);
      const updates = batch.updates[collection] ?? [];
      if (updates.length) {
        const byId = new Map(updates.map((u) => [u.id, u.changes]));
        for (const id of byId.keys()) {
          if (!list.some((item) => item.id === id)) throw new Error('A record being updated no longer exists. Nothing was imported.');
        }
        list = list.map((item) => (byId.has(item.id) ? { ...item, ...byId.get(item.id), updatedAt: now } : item));
      }
      const creates = (batch.creates[collection] ?? []) as { id: string; input: object }[];
      for (const c of creates) {
        if (list.some((item) => item.id === c.id)) throw new Error('Duplicate record id in import. Nothing was imported.');
      }
      list = [...list, ...creates.map((c) => ({ ...c.input, id: c.id, createdAt: now, updatedAt: now }))];
      (next as unknown as Record<string, unknown>)[collection] = list;
    }
    this.write(next); // single write: the whole batch is saved, or nothing is
  }

  /** Another tab saved: drop the cached copy so the next read sees its changes (prevents overwriting them). */
  subscribe(onExternalChange: () => void): () => void {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      this.cache = null;
      onExternalChange();
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  async replaceAll(db: Database): Promise<void> {
    this.write(withOptionalLists(db));
  }
}
