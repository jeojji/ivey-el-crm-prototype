import { createId } from '../lib/id';
import { SCHEMA_VERSION, type CollectionName, type Database, type EntityInput, type EntityMap } from '../types';
import { isV1Database, migrateV1, previewV1Migration, type MigrationPreview } from './migrations';
import type { DataRepository } from './repository';
import { createSampleDatabase } from './seed';

export const STORAGE_KEY = 'el-relationship-workspace:v2';
/** Schema-1 data. Never written or deleted by this version, so it doubles as the pre-upgrade backup. */
export const LEGACY_STORAGE_KEY = 'el-relationship-workspace:v1';

function isDatabase(value: unknown): value is Database {
  if (!value || typeof value !== 'object') return false;
  const db = value as Record<string, unknown>;
  return (
    db.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(db.companies) &&
    Array.isArray(db.contacts) &&
    Array.isArray(db.activities) &&
    Array.isArray(db.tasks)
  );
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

  private legacyData() {
    if (getItem(STORAGE_KEY)) return null;
    const parsed = parse(getItem(LEGACY_STORAGE_KEY));
    return isV1Database(parsed) ? parsed : null;
  }

  async getPendingMigration(): Promise<MigrationPreview | null> {
    const legacy = this.legacyData();
    return legacy ? previewV1Migration(legacy) : null;
  }

  async runMigration(): Promise<void> {
    const legacy = this.legacyData();
    if (!legacy) return;
    this.write(migrateV1(legacy));
  }

  async getBackup(kind: 'current' | 'pre-upgrade'): Promise<string | null> {
    if (kind === 'pre-upgrade') return getItem(LEGACY_STORAGE_KEY);
    return JSON.stringify(this.read(), null, 2);
  }

  private read(): Database {
    if (this.cache) return this.cache;
    if (this.legacyData()) throw new Error('Saved data needs upgrading before it can be opened.');

    const raw = getItem(STORAGE_KEY);
    const parsed = parse(raw);
    if (isDatabase(parsed)) {
      this.cache = parsed;
      return parsed;
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
