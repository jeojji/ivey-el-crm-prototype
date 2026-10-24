import { createContext, useCallback, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

/**
 * Keeps an import that is in progress (file, column mapping, pending edits and choices) while the
 * user visits other pages, so leaving Import & export doesn't lose work. It lives in memory only:
 * nothing is saved to the workspace until Import is confirmed, and reloading the page clears it.
 */
type Store = Record<string, unknown>;
const DraftContext = createContext<{ store: Store; setStore: Dispatch<SetStateAction<Store>> } | null>(null);

export function ImportDraftProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>({});
  return <DraftContext.Provider value={{ store, setStore }}>{children}</DraftContext.Provider>;
}

/** Like useState, but the value survives navigating away from the page and back. */
export function useDraft<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraft must be used inside ImportDraftProvider');
  const { store, setStore } = ctx;
  const value = (key in store ? store[key] : initial) as T;
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) =>
      setStore((s) => {
        const prev = (key in s ? s[key] : initial) as T;
        return { ...s, [key]: typeof next === 'function' ? (next as (p: T) => T)(prev) : next };
      }),
    // `initial` is only a fallback for a missing key, so it doesn't need to be a dependency.
    [key, setStore],
  );
  return [value, set];
}

/** Clears the whole import in progress (after an import, or when the user discards it). */
export function useClearDraft(): () => void {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useClearDraft must be used inside ImportDraftProvider');
  const { setStore } = ctx;
  return useCallback(() => setStore({}), [setStore]);
}
