/**
 * Client-side robust storage using the browser's native IndexedDB API.
 * 
 * Unlike localStorage (which is limited to ~5MB and throws QuotaExceededError
 * when storing large Excel datasets or thousands of consolidated rows),
 * IndexedDB provides virtually unlimited offline persistent storage (GBs)
 * that permanently survives browser restarts, tab closes, and computer reboots.
 */

const DB_NAME = 'telecomstat_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'key_value_store';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }

  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Database open blocked. Close other tabs of this app if open.');
      };
    });
  }

  return dbPromise;
}

/**
 * Retrieve an item from IndexedDB by key
 */
export async function getIdbItem<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    return new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result !== undefined ? (result as T) : null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error reading key "${key}":`, err);
    return null;
  }
}

/**
 * Store an item in IndexedDB by key
 */
export async function setIdbItem<T>(key: string, value: T): Promise<boolean> {
  try {
    const db = await getDb();
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error saving key "${key}":`, err);
    return false;
  }
}

/**
 * Delete an item from IndexedDB by key
 */
export async function deleteIdbItem(key: string): Promise<boolean> {
  try {
    const db = await getDb();
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error deleting key "${key}":`, err);
    return false;
  }
}
