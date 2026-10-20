import { createId } from '../lib/id';
import type { CollectionName, Database, EntityInput, EntityMap } from '../types';
import type { DataRepository } from './repository';
import { createSampleDatabase } from './seed';

export const STORAGE_KEY = 'el-relationship-workspace:v1';

function isDatabase(value: unknown): value is Database {
  if (!value || typeof value !== 'object') return false;
  const db = value as Record<string, unknown>;
  return (
    db.schemaVersion === 1 &&
    Array.isArray(db.companies) &&
    Array.isArray(db.contacts) &&
    Array.isArray(db.activities) &&
    Array.isArray(db.tasks)
  );
}

/**
 * Prototype persistence in the browser's localStorage.
 * Not secure, not shared between people or devices, and erased if browser data is cleared.
 */
export class LocalStorageRepository implements DataRepository {
  private cache: Database | null = null;

  private read(): Database {
    if (this.cache) return this.cache;

    let raw: string | null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      throw new Error(
        'This browser is blocking local storage, so the prototype cannot save data. Try a normal (non-private) window.',
      );
    }

    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isDatabase(parsed)) {
          this.cache = parsed;
          return parsed;
        }
      } catch {
        // fall through to reseed
      }
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
    const list = db[collection] as unknown as EntityMap[K][];
    this.write({ ...db, [collection]: [...list, entity] });
    return entity;
  }

  async update<K extends CollectionName>(
    collection: K,
    id: string,
    changes: Partial<EntityInput<K>>,
  ): Promise<EntityMap[K]> {
    const db = this.read();
    const list = db[collection] as unknown as EntityMap[K][];
    const existing = list.find((item) => item.id === id);
    if (!existing) throw new Error('That record no longer exists. It may have been deleted.');
    const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() } as EntityMap[K];
    this.write({ ...db, [collection]: list.map((item) => (item.id === id ? updated : item)) });
    return updated;
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    const db = this.read();
    const list = db[collection] as { id: string }[];
    this.write({ ...db, [collection]: list.filter((item) => item.id !== id) });
  }

  async replaceAll(db: Database): Promise<void> {
    this.write(db);
  }
}
