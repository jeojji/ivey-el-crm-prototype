import { SCHEMA_VERSION, type CollectionName, type Database, type EntityInput, type EntityMap } from '../types';
import type { MigrationPreview } from './migrations';

/**
 * Storage-agnostic data access. The prototype uses localStorage; a shared database
 * or CRM-backed implementation can replace it by implementing this interface and
 * returning it from createRepository() in ./index.ts.
 */
export interface DataRepository {
  /** Saved data in an older format that needs the user's go-ahead to upgrade, or null. */
  getPendingMigration(): Promise<MigrationPreview | null>;
  /** Upgrades older data to the current schema. The original copy is left untouched. */
  runMigration(): Promise<void>;
  /** JSON backups: the current data, or the untouched pre-upgrade original (null if none). */
  getBackup(kind: 'current' | 'pre-upgrade'): Promise<string | null>;

  loadAll(): Promise<Database>;
  create<K extends CollectionName>(collection: K, input: EntityInput<K>): Promise<EntityMap[K]>;
  update<K extends CollectionName>(
    collection: K,
    id: string,
    changes: Partial<EntityInput<K>>,
  ): Promise<EntityMap[K]>;
  remove(collection: CollectionName, id: string): Promise<void>;
  /** Replace everything, used for "reset sample data" and, later, CSV import. */
  replaceAll(db: Database): Promise<void>;
}

export function emptyDatabase(): Database {
  return { schemaVersion: SCHEMA_VERSION, companies: [], contacts: [], activities: [], tasks: [] };
}
