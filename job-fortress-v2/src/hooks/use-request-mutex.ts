import { useRef, useCallback } from 'react';

/**
 * Week 1 #5: Request deduplication mutex.
 * Prevents double-submit on scan triggers and any async action.
 * Returns a wrapper that skips execution if a previous call is still in-flight.
 */
export function useRequestMutex() {
  const inflightRef = useRef<Map<string, boolean>>(new Map());

  const withMutex = useCallback(
    <T>(key: string, fn: () => Promise<T>): Promise<T | null> => {
      if (inflightRef.current.get(key)) {
        console.debug(`[mutex] Skipped duplicate call: ${key}`);
        return Promise.resolve(null);
      }
      inflightRef.current.set(key, true);
      return fn().finally(() => {
        inflightRef.current.delete(key);
      });
    },
    []
  );

  const isLocked = useCallback((key: string) => !!inflightRef.current.get(key), []);

  return { withMutex, isLocked };
}
