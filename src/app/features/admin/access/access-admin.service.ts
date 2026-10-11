import { Injectable, inject } from '@angular/core';
import { getApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ACCESS_COLLECTION, AccessEntry, parseAccessEntry } from '../../../core/nutrition/services/nutrition-access.service';
import { AuthService } from '../../../core/services/auth.service';

/** The admin's own entry first, then everybody else by email. */
export function sortEntries(entries: AccessEntry[], ownUid: string | null): AccessEntry[] {
  return [...entries].sort((a, b) => {
    if (a.uid === ownUid) return -1;
    if (b.uid === ownUid) return 1;
    return a.email.localeCompare(b.email, undefined, { sensitivity: 'base' });
  });
}

/** Lists the accounts and switches the food tracker on or off for them. Firestore rules only let the admin do this. */
@Injectable({ providedIn: 'root' })
export class AccessAdminService {
  private auth = inject(AuthService);

  private get db() {
    return getFirestore(getApp());
  }

  async list(): Promise<AccessEntry[]> {
    const snap = await getDocs(collection(this.db, ACCESS_COLLECTION));
    const entries = snap.docs.map((d) => parseAccessEntry(d.id, d.data())).filter((e): e is AccessEntry => e !== null);
    return sortEntries(entries, this.auth.currentUser?.uid ?? null);
  }

  async setEnabled(uid: string, enabled: boolean): Promise<void> {
    await updateDoc(doc(this.db, ACCESS_COLLECTION, uid), {
      enabled,
      updatedAt: serverTimestamp(),
      updatedBy: this.auth.currentUser?.uid ?? null,
    });
  }
}
