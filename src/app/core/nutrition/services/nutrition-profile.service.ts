import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Profile } from '../models';
import { computePlan } from '../utils/nutrition';
import { DEFAULT_PROFILE, sanitizeProfile } from '../utils/profile';
import { NutritionDataService } from './nutrition-data.service';

const CACHE_PREFIX = 'nt.profile.';
const SAVE_DELAY_MS = 700;

/**
 * Body stats and goals of the signed-in user. They are kept in Firestore, mirrored in localStorage so the numbers
 * show up instantly (and offline) on this device, and never leak to the next person who signs in on it.
 */
@Injectable({ providedIn: 'root' })
export class NutritionProfileService {
  private data = inject(NutritionDataService);
  private auth = inject(AuthService);

  readonly profile = signal<Profile>({ ...DEFAULT_PROFILE });
  /** False until the first read for the current user finished, so screens don't flash "set up your profile". */
  readonly loaded = signal(false);
  readonly plan = computed(() => computePlan(this.profile()));
  readonly targetKcal = computed(() => this.plan()?.target ?? null);

  private uid: string | null = null;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.auth.currentUser$.subscribe((user) => this.onUser(user?.uid ?? null));
    window.addEventListener('pagehide', () => void this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.flush();
    });
  }

  private onUser(uid: string | null): void {
    if (uid === this.uid) return;
    this.uid = uid;
    this.dirty = false;
    this.clearTimer();
    this.loaded.set(false);
    this.profile.set({ ...DEFAULT_PROFILE });
    if (!uid) return;

    this.profile.set(this.readCache(uid));
    void this.refresh(uid);
  }

  private async refresh(uid: string): Promise<void> {
    try {
      const remote = await this.data.loadProfile();
      // Ignore the answer if the user changed meanwhile, or already started editing.
      if (this.uid !== uid || this.dirty || !remote) return;
      const clean = sanitizeProfile(remote);
      this.profile.set(clean);
      this.writeCache(uid, clean);
    } catch (error) {
      console.warn('Could not load the nutrition profile', error);
    } finally {
      if (this.uid === uid) this.loaded.set(true);
    }
  }

  update(patch: Partial<Profile>): void {
    const uid = this.uid;
    if (!uid) return;
    const next = sanitizeProfile({ ...this.profile(), ...patch });
    this.profile.set(next);
    this.writeCache(uid, next);
    this.dirty = true;
    this.clearTimer();
    this.timer = setTimeout(() => void this.flush(), SAVE_DELAY_MS);
  }

  /** Replaces the profile (import, reset) and saves it right away. */
  async replace(next: Partial<Profile>): Promise<void> {
    const uid = this.uid;
    if (!uid) return;
    const clean = sanitizeProfile(next);
    this.profile.set(clean);
    this.writeCache(uid, clean);
    this.dirty = true;
    await this.flush();
  }

  /** Forgets the local copy; the Firestore document is deleted together with the rest of the data. */
  resetLocal(): void {
    if (this.uid) localStorage.removeItem(CACHE_PREFIX + this.uid);
    this.dirty = false;
    this.clearTimer();
    this.profile.set({ ...DEFAULT_PROFILE });
  }

  async flush(): Promise<void> {
    this.clearTimer();
    if (!this.dirty || !this.uid) return;
    this.dirty = false;
    try {
      await this.data.saveProfile(this.profile());
    } catch (error) {
      this.dirty = true;
      console.warn('Could not save the nutrition profile', error);
    }
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private readCache(uid: string): Profile {
    try {
      return sanitizeProfile(JSON.parse(localStorage.getItem(CACHE_PREFIX + uid) ?? 'null'));
    } catch {
      return { ...DEFAULT_PROFILE };
    }
  }

  private writeCache(uid: string, profile: Profile): void {
    try {
      localStorage.setItem(CACHE_PREFIX + uid, JSON.stringify(profile));
    } catch {
      // storage full or unavailable: the Firestore copy still holds the data
    }
  }
}
