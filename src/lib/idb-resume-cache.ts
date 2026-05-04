/**
 * Tiny IndexedDB cache for the user's resume File blob.
 *
 * Why: `File` objects can't be JSON-serialized into sessionStorage, so
 * after the OAuth redirect we lose the upload and force the user to
 * re-pick the same file. This module persists the blob (+ name + type)
 * for the few seconds between OAuth bounce-out and bounce-back.
 *
 * Single-key store. We only ever cache ONE pending resume at a time.
 * Caller is responsible for clearing after consume.
 */

const DB_NAME = 'jb_resume_cache';
const STORE = 'pending';
const KEY = 'current';
const DB_VERSION = 1;

// Files older than this are considered stale (user abandoned OAuth).
const MAX_AGE_MS = 30 * 60 * 1000; // 30 min

interface CachedResume {
  blob: Blob;
  name: string;
  type: string;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

export async function saveResumeToCache(file: File): Promise<void> {
  try {
    const db = await openDb();
    const payload: CachedResume = {
      blob: file,
      name: file.name,
      type: file.type || 'application/octet-stream',
      savedAt: Date.now(),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(payload, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    // Non-fatal — worst case the user re-uploads.
    console.warn('[idb-resume-cache] save failed:', err);
  }
}

export async function loadResumeFromCache(): Promise<File | null> {
  try {
    const db = await openDb();
    const cached = await new Promise<CachedResume | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as CachedResume | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();

    if (!cached || !cached.blob) return null;
    if (Date.now() - cached.savedAt > MAX_AGE_MS) {
      await clearResumeCache();
      return null;
    }
    return new File([cached.blob], cached.name, { type: cached.type });
  } catch (err) {
    console.warn('[idb-resume-cache] load failed:', err);
    return null;
  }
}

export async function clearResumeCache(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[idb-resume-cache] clear failed:', err);
  }
}
