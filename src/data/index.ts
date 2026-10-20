import { LocalStorageRepository } from './localStorageRepository';
import type { DataRepository } from './repository';

/** The single place to switch storage backends (e.g. to a shared database API). */
export function createRepository(): DataRepository {
  return new LocalStorageRepository();
}
