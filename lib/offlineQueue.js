/**
 * Offline mutation queue — IndexedDB-backed store for CRUD operations
 * performed while offline. Flushed by DashboardContext when back online.
 *
 * Each entry: { id(auto), action, entity, entityId?, tempId?, data, timestamp }
 *   action  : 'add' | 'update' | 'delete' | 'toggle'
 *   entity  : 'site' | 'category' | 'tag' | 'favorite' | 'pinned'
 *   entityId: real DB id (for update/delete/toggle)
 *   tempId  : client-generated id (for add — mapped to real id during sync)
 *   data    : payload to send to API
 */

const DB_NAME = 'site-organizer-offline';
const DB_VERSION = 1;
const STORE = 'mutations';

function openDB() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB not available'));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/** Add a mutation to the queue */
export async function enqueue(mutation) {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ ...mutation, timestamp: Date.now() });
    return new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
    });
}

/** Get all pending mutations (sorted by timestamp) */
export async function getAll() {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => {
            const items = req.result || [];
            items.sort((a, b) => a.timestamp - b.timestamp);
            resolve(items);
        };
        req.onerror = () => resolve([]);
    });
}

/** Count pending mutations */
export async function count() {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(0);
        });
    } catch {
        return 0;
    }
}

/** Clear all pending mutations */
export async function clear() {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    return new Promise((res) => { tx.oncomplete = res; });
}

/** Remove a single mutation by its auto-incremented id */
export async function remove(id) {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    return new Promise((res) => { tx.oncomplete = res; });
}
