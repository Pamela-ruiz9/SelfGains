import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type QueueOperationType =
  | 'createWorkout'
  | 'addSet'
  | 'addSession'
  | 'updateSet'
  | 'deleteSet'
  | 'updateSession'
  | 'deleteSession'
  | 'deleteWorkout';

export interface QueueItem {
  id?: number;
  type: QueueOperationType;
  payload: Record<string, unknown>;
  tempId?: string;
  dependsOnTempId?: string;
  snapshotUpdatedAt?: string;
  createdAt: string;
}

export interface ConflictItem {
  id?: number;
  queueItem: QueueItem;
  serverSnapshot: Record<string, unknown> | null;
  detectedAt: string;
}

interface SelfGainsOfflineDB extends DBSchema {
  cache: {
    key: string;
    value: unknown;
  };
  queue: {
    key: number;
    value: QueueItem;
  };
  conflicts: {
    key: number;
    value: ConflictItem;
  };
}

let dbPromise: Promise<IDBPDatabase<SelfGainsOfflineDB>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<SelfGainsOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SelfGainsOfflineDB>('selfgains-offline', 1, {
      upgrade(db) {
        db.createObjectStore('cache');
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('conflicts', { keyPath: 'id', autoIncrement: true });
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}
