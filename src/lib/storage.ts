import { RecentItem } from '../types';

const DB_NAME = 'bgremoved_db';
const STORE_NAME = 'recents';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecentItem(item: RecentItem): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save to IndexedDB, fallback to localStorage', err);
    try {
      const existing = getStoredRecentsFallback();
      const updated = [item, ...existing.filter((x) => x.id !== item.id)].slice(0, 15);
      localStorage.setItem('recents_backup', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage limit reached', e);
    }
  }
}

export async function getAllRecents(): Promise<RecentItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items: RecentItem[] = req.result || [];
        items.sort((a, b) => b.timestamp - a.timestamp);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to get from IndexedDB', err);
    return getStoredRecentsFallback();
  }
}

export async function deleteRecentItem(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to delete from IndexedDB', err);
  }
  try {
    const existing = getStoredRecentsFallback();
    const updated = existing.filter((x) => x.id !== id);
    localStorage.setItem('recents_backup', JSON.stringify(updated));
  } catch {}
}

function getStoredRecentsFallback(): RecentItem[] {
  try {
    const data = localStorage.getItem('recents_backup');
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}
