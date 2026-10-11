import { Injectable, inject } from '@angular/core';
import { blobToDataUrl } from '../utils/image';
import { NutritionBackupService } from './nutrition-backup.service';

const LEGACY_DB = 'calorie-tracker';
const DONE_KEY = 'nt.legacyImported';

/**
 * The standalone calorie tracker kept its meals in this browser (IndexedDB). If the new app is served from the same
 * address, those meals are still here: this moves them into the signed-in account.
 */
@Injectable({ providedIn: 'root' })
export class LegacyImportService {
  private backup = inject(NutritionBackupService);

  /** Meals the old app left in this browser, or 0 when there are none (or they were already imported). */
  async pendingCount(): Promise<number> {
    if (localStorage.getItem(DONE_KEY)) return 0;
    const db = await this.open();
    if (!db) return 0;
    try {
      return await this.request<number>(db, 'entries', (store) => store.count());
    } catch {
      return 0;
    } finally {
      db.close();
    }
  }

  async importAll(): Promise<{ entries: number; weights: number }> {
    const db = await this.open();
    if (!db) throw new Error('nothing to import');
    try {
      const rows = await this.request<Record<string, unknown>[]>(db, 'entries', (store) => store.getAll());
      const weights = await this.request<unknown[]>(db, 'weights', (store) => store.getAll()).catch(() => []);

      const entries: unknown[] = [];
      for (const { photo, ...rest } of rows) {
        entries.push(photo instanceof Blob ? { ...rest, photo: await blobToDataUrl(photo) } : rest);
      }
      const result = await this.backup.importData({ entries, weights, profile: this.legacyProfile() });
      localStorage.setItem(DONE_KEY, '1');
      return result;
    } finally {
      db.close();
    }
  }

  private legacyProfile(): unknown {
    try {
      return JSON.parse(localStorage.getItem('ct.profile') ?? 'null');
    } catch {
      return null;
    }
  }

  private async open(): Promise<IDBDatabase | null> {
    try {
      const databases = await indexedDB.databases?.();
      if (!databases?.some((d) => d.name === LEGACY_DB)) return null;
      return await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(LEGACY_DB);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  private request<T>(db: IDBDatabase, store: string, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!db.objectStoreNames.contains(store)) {
        reject(new Error(`missing store ${store}`));
        return;
      }
      const request = fn(db.transaction(store, 'readonly').objectStore(store));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }
}
