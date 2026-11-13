// A tiny IndexedDB-backed queue for work done while offline. Items are tagged
// with the user who created them and only ever shown to / sent for that user,
// so a shared tablet can't send one technician's report under another's login.
const DB_NAME = "thermatrust-offline";
const STORE = "outbox";

export interface OutboxItem {
  id?: number;
  userId: number;
  kind: "service_report";
  jobId: number;
  label: string;
  payload: unknown;
  createdAt: string;
  // Set when the server permanently rejected it, so it stops retrying and
  // waits for the user to retry or discard it.
  error?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function addItem(item: Omit<OutboxItem, "id">): Promise<void> {
  await run("readwrite", (store) => store.add(item));
}

export async function listItems(userId: number): Promise<OutboxItem[]> {
  const all = await run<OutboxItem[]>("readonly", (store) => store.getAll());
  return all.filter((item) => item.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateItem(item: OutboxItem): Promise<void> {
  await run("readwrite", (store) => store.put(item));
}

export async function removeItem(id: number): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
}
