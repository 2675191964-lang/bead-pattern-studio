import type { AppSettings, BeadProject } from '../types';

const DB_NAME = 'bead-pattern-studio';
const DB_VERSION = 1;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 操作失败'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB 事务失败'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB 事务已中止'));
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains('projects')) database.createObjectStore('projects', { keyPath: 'id' });
    if (!database.objectStoreNames.contains('assets')) database.createObjectStore('assets', { keyPath: 'id' });
    if (!database.objectStoreNames.contains('settings')) database.createObjectStore('settings');
    if (!database.objectStoreNames.contains('recovery')) database.createObjectStore('recovery', { keyPath: 'id' });
  };
  return requestResult(request);
}

export async function saveProject(project: BeadProject): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(['projects'], 'readwrite');
  transaction.objectStore('projects').put(project);
  await transactionDone(transaction);
  database.close();
}

export async function loadProject(id: string): Promise<BeadProject | undefined> {
  const database = await openDatabase();
  const result = await requestResult(database.transaction('projects').objectStore('projects').get(id)) as BeadProject | undefined;
  database.close();
  return result;
}

export async function listProjects(): Promise<BeadProject[]> {
  const database = await openDatabase();
  const result = await requestResult(database.transaction('projects').objectStore('projects').getAll()) as BeadProject[];
  database.close();
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteProject(id: string): Promise<void> {
  const database = await openDatabase();
  const project = await requestResult(database.transaction('projects').objectStore('projects').get(id)) as BeadProject | undefined;
  const transaction = database.transaction(['projects', 'assets', 'recovery'], 'readwrite');
  transaction.objectStore('projects').delete(id);
  transaction.objectStore('recovery').delete(id);
  if (project?.sourceImage?.assetId) transaction.objectStore('assets').delete(project.sourceImage.assetId);
  await transactionDone(transaction);
  database.close();
}

export async function saveAsset(id: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction('assets', 'readwrite');
  transaction.objectStore('assets').put({ id, blob });
  await transactionDone(transaction);
  database.close();
}

export async function loadAsset(id: string): Promise<Blob | undefined> {
  const database = await openDatabase();
  const result = await requestResult(database.transaction('assets').objectStore('assets').get(id)) as { id: string; blob: Blob } | undefined;
  database.close();
  return result?.blob;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction('settings', 'readwrite');
  transaction.objectStore('settings').put(settings, 'app');
  await transactionDone(transaction);
  database.close();
}

export async function loadSettings(): Promise<AppSettings | undefined> {
  const database = await openDatabase();
  const result = await requestResult(database.transaction('settings').objectStore('settings').get('app')) as AppSettings | undefined;
  database.close();
  return result;
}
