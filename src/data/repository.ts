import type { CollectionName, Database, EntityInput, EntityMap } from '../types';

/**
 * Storage-agnostic data access. The prototype uses localStorage; a shared database
 * or CRM-backed implementation can replace it by implementing this interface and
 * returning it from createRepository() in ./index.ts.
 */
export interface DataRepository {
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
  return { schemaVersion: 1, companies: [], contacts: [], activities: [], tasks: [] };
}
