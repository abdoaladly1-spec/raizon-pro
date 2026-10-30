// تخزين الحالة في IndexedDB (سعة أكبر من localStorage ~5MB)
// يُستخدم كنسخة احتياطية محلية: يُكتب مؤجّلاً بعد كل تغيير ويُقرأ لو مسح localStorage

const DB_NAME = 'procashier';
const STORE = 'kv';
const DB_VERSION = 1;

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('indexedDB blocked'));
  });

/** يحفظ قيمة (تُخزّن كنص JSON) */
export const idbSet = async (key: string, value: unknown): Promise<void> => {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(JSON.stringify(value ?? null), key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('idbSet failed', e);
  } finally {
    db?.close();
  }
};

/** يقرأ قيمة محفوظة أو null */
export const idbGet = async <T,>(key: string): Promise<T | null> => {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const raw = await new Promise<unknown>((resolve, reject) => {
      const tx = db!.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (typeof raw !== 'string') return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  } finally {
    db?.close();
  }
};

/** يحذف قيمة (يُستخدم عند تصفير النظام) */
export const idbRemove = async (key: string): Promise<void> => {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('idbRemove failed', e);
  } finally {
    db?.close();
  }
};
