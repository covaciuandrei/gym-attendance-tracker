import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Profile } from '../models';
import { computePlan } from '../utils/nutrition';
import { DEFAULT_PROFILE, sanitizeProfile } from '../utils/profile';
import { NutritionDataService } from './nutrition-data.service';

const CACHE_PREFIX = 'nt.profile.';

/**
 * Body stats and goals of the signed-in user. They are kept in Firestore, mirrored in localStorage so the numbers
 * show up instantly (and offline) on this device, and never leak to the next person who signs in on it.
 * They only change when the user saves them on the goals page.
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
  /** Counts saves, so a slow read that started earlier can't overwrite what was just saved. */
  private saves = 0;

  constructor() {
    this.auth.currentUser$.subscribe((user) => this.onUser(user?.uid ?? null));
  }

  private onUser(uid: string | null): void {
    if (uid === this.uid) return;
    this.uid = uid;
    this.loaded.set(false);
    this.profile.set({ ...DEFAULT_PROFILE });
    if (!uid) return;

    this.profile.set(this.readCache(uid));
    void this.refresh(uid);
  }

  private async refresh(uid: string): Promise<void> {
    const savesBefore = this.saves;
    try {
      const remote = await this.data.loadProfile();
      // Ignore the answer if the user changed meanwhile, or saved something newer than what was read.
      if (this.uid !== uid || this.saves !== savesBefore || !remote) return;
      const clean = sanitizeProfile(remote);
      this.profile.set(clean);
      this.writeCache(uid, clean);
    } catch (error) {
      console.warn('Could not load the nutrition profile', error);
    } finally {
      if (this.uid === uid) this.loaded.set(true);
    }
  }

  /**
   * Writes the profile to the account and, once the write is accepted, makes it the one the whole app uses.
   * Resolves false, with nothing changed, when it could not be written.
   */
  async save(next: Partial<Profile>): Promise<boolean> {
    const uid = this.uid;
    if (!uid) return false;
    const clean = sanitizeProfile(next);
    try {
      await this.data.saveProfile(clean);
    } catch (error) {
      console.warn('Could not save the nutrition profile', error);
      return false;
    }
    if (this.uid === uid) {
      this.saves++;
      this.profile.set(clean);
      this.writeCache(uid, clean);
    }
    return true;
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
