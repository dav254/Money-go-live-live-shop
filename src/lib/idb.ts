'use client';

// A simple key-value store using IndexedDB
function openDB(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Check if running in a browser environment
    if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB is not supported in this environment.'));
    }
    const request = indexedDB.open(dbName, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
  });
}

export async function set(dbName: string, storeName: string, key: IDBValidKey, value: any): Promise<void> {
  const db = await openDB(dbName, storeName);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore(storeName).put(value, key);
    transaction.onabort = () => reject(new DOMException('Transaction aborted'));
  });
}

export async function get<T>(dbName: string, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB(dbName, storeName);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(new DOMException('Transaction aborted'));
  });
}
