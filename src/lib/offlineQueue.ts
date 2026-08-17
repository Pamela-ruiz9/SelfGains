import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { getOfflineDb, type ConflictItem, type QueueItem } from './offlineDb';

// Un fallo de red en una llamada Postgrest vuelve como
// { error: { code: '', message: 'TypeError: ...' } } (confirmado en
// @supabase/postgrest-js/src/PostgrestBuilder.ts). Un fallo de red en una
// llamada de auth (supabase.auth.getUser(), que sí pega a la red) lanza
// AuthRetryableFetchError. Cualquier otro error (validación, permisos,
// fila no encontrada) NO debe tratarse como "estoy offline".
export function isNetworkError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; message?: unknown };
    return e.code === '' && typeof e.message === 'string' && e.message.startsWith('TypeError:');
  }
  return false;
}

export function newTempId(): string {
  return crypto.randomUUID();
}

export async function readCache<T>(key: string): Promise<T | null> {
  const db = await getOfflineDb();
  const value = await db.get('cache', key);
  return (value as T) ?? null;
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  const db = await getOfflineDb();
  await db.put('cache', value, key);
}

export async function patchCacheArray<T>(key: string, updater: (items: T[]) => T[]): Promise<void> {
  const current = (await readCache<T[]>(key)) ?? [];
  await writeCache(key, updater(current));
}

export async function enqueue(item: Omit<QueueItem, 'id' | 'createdAt'>): Promise<QueueItem> {
  const db = await getOfflineDb();
  const full: Omit<QueueItem, 'id'> = { ...item, createdAt: new Date().toISOString() };
  const id = await db.add('queue', full as QueueItem);
  return { ...full, id: id as number };
}

export async function updateQueueItem(id: number, updates: Partial<QueueItem>): Promise<void> {
  const db = await getOfflineDb();
  const existing = await db.get('queue', id);
  if (!existing) return;
  await db.put('queue', { ...existing, ...updates });
}

export async function getQueueItems(): Promise<QueueItem[]> {
  const db = await getOfflineDb();
  return db.getAll('queue');
}

export async function getQueueCount(): Promise<number> {
  const db = await getOfflineDb();
  return db.count('queue');
}

export async function removeQueueItem(id: number): Promise<void> {
  const db = await getOfflineDb();
  await db.delete('queue', id);
}

export async function findQueuedCreateByTempId(tempId: string): Promise<QueueItem | undefined> {
  const items = await getQueueItems();
  return items.find((item) => item.tempId === tempId);
}

export async function indexSetWorkout(setId: string, workoutId: string): Promise<void> {
  const index = (await readCache<Record<string, string>>('setWorkoutIndex')) ?? {};
  index[setId] = workoutId;
  await writeCache('setWorkoutIndex', index);
}

export async function lookupSetWorkout(setId: string): Promise<string | undefined> {
  const index = await readCache<Record<string, string>>('setWorkoutIndex');
  return index?.[setId];
}

export async function indexSessionWorkout(sessionId: string, workoutId: string): Promise<void> {
  const index = (await readCache<Record<string, string>>('sessionWorkoutIndex')) ?? {};
  index[sessionId] = workoutId;
  await writeCache('sessionWorkoutIndex', index);
}

export async function lookupSessionWorkout(sessionId: string): Promise<string | undefined> {
  const index = await readCache<Record<string, string>>('sessionWorkoutIndex');
  return index?.[sessionId];
}

export async function addConflict(
  queueItem: QueueItem,
  serverSnapshot: Record<string, unknown> | null
): Promise<void> {
  const db = await getOfflineDb();
  const conflict: Omit<ConflictItem, 'id'> = {
    queueItem,
    serverSnapshot,
    detectedAt: new Date().toISOString(),
  };
  await db.add('conflicts', conflict as ConflictItem);
}

export async function getConflicts(): Promise<ConflictItem[]> {
  const db = await getOfflineDb();
  return db.getAll('conflicts');
}

export async function getConflictCount(): Promise<number> {
  const db = await getOfflineDb();
  return db.count('conflicts');
}

export async function removeConflict(id: number): Promise<void> {
  const db = await getOfflineDb();
  await db.delete('conflicts', id);
}
