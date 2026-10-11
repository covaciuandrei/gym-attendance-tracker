import { Injectable, inject } from '@angular/core';
import { getApp } from 'firebase/app';
import {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Query,
  QueryDocumentSnapshot,
  WriteBatch,
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { AuthService } from '../../services/auth.service';
import { DiaryEntry, Profile, WeightLog } from '../models';
import { isDateKey, mealForTime, todayKey } from '../utils/date';
import { newId } from '../utils/id';
import { isImageDataUrl } from '../utils/image';
import { itemsTotals } from '../utils/nutrition';
import { cleanItem, normalizeEntry, toEntryDoc } from './entry-mapper';

// Everything lives under users/{uid}/..., which the project's existing Firestore rules already restrict to the owner.
const ENTRIES = 'foodEntries';
const PHOTOS = 'foodPhotos';
const WEIGHTS = 'bodyWeights';
const SETTINGS = 'foodSettings';
const PROFILE_DOC = 'profile';

const COMMIT_WAIT_MS = 6000;

const byTime = (a: DiaryEntry, b: DiaryEntry) => a.time.localeCompare(b.time) || a.createdAt - b.createdAt;

/** Reads and writes the food diary in the signed-in user's Firestore space. */
@Injectable({ providedIn: 'root' })
export class NutritionDataService {
  private auth = inject(AuthService);

  private get db(): Firestore {
    return getFirestore(getApp());
  }

  private get uid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    return uid;
  }

  private col(name: string) {
    return collection(this.db, 'users', this.uid, name);
  }

  private ref(name: string, id: string) {
    return doc(this.db, 'users', this.uid, name, id);
  }

  // Offline the server can't answer, and waiting for it to give up would freeze the screen, so read the cache directly.
  private async docs(q: Query<DocumentData>): Promise<QueryDocumentSnapshot<DocumentData>[]> {
    if (!navigator.onLine) {
      try {
        return (await getDocsFromCache(q)).docs;
      } catch {
        return [];
      }
    }
    return (await getDocs(q)).docs;
  }

  private async snapshot(ref: DocumentReference<DocumentData>): Promise<DocumentSnapshot<DocumentData> | null> {
    if (!navigator.onLine) {
      try {
        return await getDocFromCache(ref);
      } catch {
        return null;
      }
    }
    return getDoc(ref);
  }

  private entriesFrom(docs: QueryDocumentSnapshot<DocumentData>[]): DiaryEntry[] {
    const entries: DiaryEntry[] = [];
    for (const d of docs) {
      try {
        entries.push(normalizeEntry(d.id, d.data()));
      } catch (error) {
        console.warn('Skipping an unreadable meal', d.id, error);
      }
    }
    return entries;
  }

  /**
   * Resolves once the server confirmed the write. Offline (or when the server is slow) the write stays queued in the
   * local cache and is synced later, so the screen doesn't wait for it.
   */
  private async commit(batch: WriteBatch): Promise<void> {
    const pending = batch.commit();
    pending.catch((error) => console.error('Nutrition write failed', error));
    if (!navigator.onLine) return;
    await Promise.race([pending, new Promise<void>((resolve) => setTimeout(resolve, COMMIT_WAIT_MS))]);
  }

  // Meals

  async getDay(date: string): Promise<DiaryEntry[]> {
    const docs = await this.docs(query(this.col(ENTRIES), where('date', '==', date)));
    return this.entriesFrom(docs).sort(byTime);
  }

  async getRange(start: string, end: string): Promise<DiaryEntry[]> {
    const docs = await this.docs(query(this.col(ENTRIES), where('date', '>=', start), where('date', '<=', end)));
    return this.entriesFrom(docs);
  }

  async getEntry(id: string): Promise<DiaryEntry | undefined> {
    const snap = await this.snapshot(this.ref(ENTRIES, id));
    return snap?.exists() ? normalizeEntry(snap.id, snap.data()) : undefined;
  }

  async getPhoto(id: string): Promise<string | null> {
    const snap = await this.snapshot(this.ref(PHOTOS, id));
    const data = snap?.exists() ? snap.data()['data'] : null;
    return isImageDataUrl(data) ? data : null;
  }

  /**
   * `photo`: a data URL to set it, `null` to remove it, `undefined` to leave the stored photo untouched.
   * The meal and its photo are written in one batch.
   */
  async saveEntry(entry: DiaryEntry, photo?: string | null): Promise<DiaryEntry> {
    const items = entry.items.map(cleanItem);
    const hasPhoto = photo === undefined ? entry.hasPhoto : photo !== null;
    const saved: DiaryEntry = { ...entry, items, totals: itemsTotals(items), hasPhoto, updatedAt: Date.now() };

    const batch = writeBatch(this.db);
    batch.set(this.ref(ENTRIES, saved.id), toEntryDoc(saved));
    if (photo === null) batch.delete(this.ref(PHOTOS, saved.id));
    else if (photo !== undefined) batch.set(this.ref(PHOTOS, saved.id), { data: photo, updatedAt: saved.updatedAt });
    await this.commit(batch);
    return saved;
  }

  async removeEntry(id: string): Promise<void> {
    const batch = writeBatch(this.db);
    batch.delete(this.ref(ENTRIES, id));
    batch.delete(this.ref(PHOTOS, id));
    await this.commit(batch);
  }

  /** Copies a meal (photo included) onto another day, e.g. to log the same breakfast again. */
  async duplicate(source: DiaryEntry, date: string, time: string): Promise<DiaryEntry> {
    const now = Date.now();
    const photo = source.hasPhoto ? await this.getPhoto(source.id) : null;
    const copy: DiaryEntry = { ...source, id: newId(), date, time, meal: mealForTime(time), createdAt: now, updatedAt: now };
    return this.saveEntry(copy, photo);
  }

  /** The most recent distinct meals, newest first. */
  async recentMeals(max = 8): Promise<DiaryEntry[]> {
    const docs = await this.docs(query(this.col(ENTRIES), orderBy('date', 'desc'), limit(40)));
    const rows = this.entriesFrom(docs).sort(
      (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.createdAt - a.createdAt,
    );
    const seen = new Set<string>();
    const out: DiaryEntry[] = [];
    for (const entry of rows) {
      const key = entry.name.trim().toLowerCase();
      if (!key || seen.has(key) || entry.items.length === 0) continue;
      seen.add(key);
      out.push(entry);
      if (out.length >= max) break;
    }
    return out;
  }

  // Body weight

  async weights(): Promise<WeightLog[]> {
    const docs = await this.docs(query(this.col(WEIGHTS)));
    const logs: WeightLog[] = [];
    for (const d of docs) {
      const kg = d.data()['kg'];
      if (isDateKey(d.id) && typeof kg === 'number' && Number.isFinite(kg)) logs.push({ date: d.id, kg });
    }
    return logs.sort((a, b) => a.date.localeCompare(b.date));
  }

  async logWeight(kg: number, date = todayKey()): Promise<void> {
    const batch = writeBatch(this.db);
    batch.set(this.ref(WEIGHTS, date), { kg: Math.round(kg * 10) / 10, updatedAt: Date.now() });
    await this.commit(batch);
  }

  async removeWeight(date: string): Promise<void> {
    const batch = writeBatch(this.db);
    batch.delete(this.ref(WEIGHTS, date));
    await this.commit(batch);
  }

  // Profile

  async loadProfile(): Promise<Partial<Profile> | null> {
    const snap = await this.snapshot(this.ref(SETTINGS, PROFILE_DOC));
    return snap?.exists() ? (snap.data() as Partial<Profile>) : null;
  }

  async saveProfile(profile: Profile): Promise<void> {
    const batch = writeBatch(this.db);
    batch.set(this.ref(SETTINGS, PROFILE_DOC), { ...profile, updatedAt: Date.now() });
    await this.commit(batch);
  }
}
