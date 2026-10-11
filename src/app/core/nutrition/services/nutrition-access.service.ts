import { Injectable, computed, inject, signal } from '@angular/core';
import { getApp } from 'firebase/app';
import { Unsubscribe, doc, getFirestore, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { filter, firstValueFrom } from 'rxjs';
import { AuthService, AuthUser } from '../../services/auth.service';

/** One entry per account; the admin switches `enabled` from Settings. */
export const ACCESS_COLLECTION = 'nutritionAccess';

export interface AccessEntry {
  uid: string;
  email: string;
  displayName: string;
  enabled: boolean;
}

/** Reads an access entry defensively: anything but a real `enabled: true` means switched off. */
export function parseAccessEntry(uid: string, data: Record<string, unknown> | undefined): AccessEntry | null {
  if (!data || typeof data['email'] !== 'string') return null;
  return {
    uid,
    email: data['email'],
    displayName: typeof data['displayName'] === 'string' ? data['displayName'] : '',
    enabled: data['enabled'] === true,
  };
}

const CACHE_KEY = (uid: string) => `nt.access.${uid}`;
const READY_TIMEOUT_MS = 4000;

/**
 * Who may use the food tracker. The answer comes from the signed-in account's own entry in Firestore, followed live,
 * so switching someone off takes effect without a reload. The admin (a signed custom claim) always has access.
 *
 * This decides what the app shows; the API and Firestore rules are what actually protect the AI and the entries.
 */
@Injectable({ providedIn: 'root' })
export class NutritionAccessService {
  private auth = inject(AuthService);

  private entryEnabled = signal(false);
  /** True for the admin account: it sees the access settings and never needs to be switched on. */
  readonly isAdmin = signal(false);
  /** The answer for the signed-in account is known (or could not be fetched in time). */
  readonly ready = signal(false);
  /** The signed-in account may use the food tracker. */
  readonly canUse = computed(() => this.isAdmin() || this.entryEnabled());

  private uid: string | null = null;
  private stopListening: Unsubscribe | null = null;
  private claimsRefreshed = false;
  private readyPromise: Promise<void> = Promise.resolve();
  private finishReady: (() => void) | null = null;

  constructor() {
    this.auth.currentUser$.subscribe((user) => (user?.emailVerified ? this.start(user) : this.stop()));
  }

  private start(user: AuthUser): void {
    if (this.uid === user.uid) return;
    this.stop();
    this.uid = user.uid;
    this.entryEnabled.set(this.cached(user.uid));
    this.readyPromise = new Promise((resolve) => (this.finishReady = resolve));

    // The admin needs no entry, so once the claim is known there is nothing more to wait for.
    void this.refreshClaims(false).then((admin) => admin && this.markReady());

    try {
      const ref = doc(getFirestore(getApp()), ACCESS_COLLECTION, user.uid);
      this.stopListening = onSnapshot(
        ref,
        (snap) => {
          // Offline, Firestore answers from an empty cache; that says nothing about the account, so keep what we knew.
          if (snap.metadata.fromCache && !snap.exists()) return;
          if (!snap.exists()) {
            this.entryEnabled.set(false);
            this.remember(user.uid, false);
            void this.register(user);
          } else {
            const enabled = snap.get('enabled') === true;
            this.entryEnabled.set(enabled);
            this.remember(user.uid, enabled);
          }
          this.markReady();
        },
        (error) => {
          console.warn('Could not read the food tracker access', error.code);
          this.markReady();
        },
      );
    } catch (error) {
      console.warn('Could not start following the food tracker access', error);
      this.markReady();
    }
  }

  private stop(): void {
    this.stopListening?.();
    this.stopListening = null;
    this.uid = null;
    this.claimsRefreshed = false;
    this.entryEnabled.set(false);
    this.isAdmin.set(false);
    this.ready.set(false);
    this.releaseWaiters();
  }

  private markReady(): void {
    this.ready.set(true);
    this.releaseWaiters();
  }

  private releaseWaiters(): void {
    this.finishReady?.();
    this.finishReady = null;
  }

  /** A new account asks for access once, switched off. Firestore rules refuse anything else. */
  private async register(user: AuthUser): Promise<void> {
    if (!user.email) return;
    try {
      await setDoc(doc(getFirestore(getApp()), ACCESS_COLLECTION, user.uid), {
        email: user.email,
        displayName: user.displayName ?? '',
        enabled: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      // Another tab (or the admin) created it first: nothing to do.
      console.debug('Access entry not created', (error as { code?: string }).code);
    }
  }

  /**
   * Reads the admin claim from the account's ID token. The first call of a session asks Firebase for a fresh token, so
   * a claim granted while the app was already open shows up without signing out.
   */
  async refreshClaims(force = true): Promise<boolean> {
    await firstValueFrom(this.auth.authReady$.pipe(filter(Boolean)));
    const user = this.auth.getFirebaseAuth()?.currentUser;
    if (!user) return false;
    try {
      const result = await user.getIdTokenResult(force && !this.claimsRefreshed);
      if (force) this.claimsRefreshed = true;
      const admin = result.claims['admin'] === true;
      // The account may have changed while the token was being fetched.
      if (this.uid === user.uid) this.isAdmin.set(admin);
      return admin;
    } catch {
      return this.isAdmin();
    }
  }

  /** Resolves with whether the account may use the food tracker, waiting briefly for the first answer. */
  async whenReady(timeoutMs = READY_TIMEOUT_MS): Promise<boolean> {
    await firstValueFrom(this.auth.authReady$.pipe(filter(Boolean)));
    if (!this.auth.currentUser) return false;
    await Promise.race([this.readyPromise, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
    return this.canUse();
  }

  private cached(uid: string): boolean {
    try {
      return localStorage.getItem(CACHE_KEY(uid)) === '1';
    } catch {
      return false;
    }
  }

  private remember(uid: string, enabled: boolean): void {
    try {
      localStorage.setItem(CACHE_KEY(uid), enabled ? '1' : '0');
    } catch {
      // storage may be unavailable; the cache is only a hint to avoid a flicker
    }
  }
}
