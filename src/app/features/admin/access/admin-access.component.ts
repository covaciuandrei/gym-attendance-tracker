import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AccessEntry } from '../../../core/nutrition/services/nutrition-access.service';
import { AuthService } from '../../../core/services/auth.service';
import { AccessAdminService } from './access-admin.service';

interface Notice {
  kind: 'ok' | 'error';
  key: string;
  params?: Record<string, string>;
}

const SAVE_TIMEOUT_MS = 10_000;
const NOTICE_MS = 4000;

/** Admin only: every account with a switch for the food tracker. */
@Component({
  selector: 'app-admin-access',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TranslateModule],
  templateUrl: './admin-access.component.html',
  styleUrls: ['./admin-access.component.css'],
})
export class AdminAccessComponent implements OnInit, OnDestroy {
  private admin = inject(AccessAdminService);
  private auth = inject(AuthService);

  /** Own account: always on, so it has no switch. */
  readonly ownUid = this.auth.currentUser?.uid ?? null;

  readonly entries = signal<AccessEntry[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal<ReadonlySet<string>>(new Set());
  readonly notice = signal<Notice | null>(null);
  readonly query = signal('');

  readonly others = computed(() => this.entries().filter((e) => e.uid !== this.ownUid));
  readonly enabledCount = computed(() => this.others().filter((e) => e.enabled).length);
  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.entries();
    return this.entries().filter((e) => e.email.toLowerCase().includes(q) || e.displayName.toLowerCase().includes(q));
  });

  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      this.entries.set(await this.admin.list());
    } catch (error) {
      console.warn('Could not load the accounts', (error as { code?: string }).code);
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  initial(entry: AccessEntry): string {
    return (entry.displayName || entry.email).trim().charAt(0).toUpperCase() || '?';
  }

  setQuery(value: string): void {
    this.query.set(value);
  }

  async toggle(entry: AccessEntry): Promise<void> {
    if (entry.uid === this.ownUid || this.saving().has(entry.uid)) return;
    if (!navigator.onLine) {
      this.show({ kind: 'error', key: 'ADMIN.ACCESS.SAVE_FAILED' });
      return;
    }

    const next = !entry.enabled;
    this.patch(entry.uid, next);
    this.markSaving(entry.uid, true);
    try {
      await this.withTimeout(this.admin.setEnabled(entry.uid, next));
      this.show({ kind: 'ok', key: next ? 'ADMIN.ACCESS.SAVED_ON' : 'ADMIN.ACCESS.SAVED_OFF', params: { email: entry.email } });
    } catch (error) {
      console.warn('Could not change the access', (error as { code?: string }).code);
      this.patch(entry.uid, !next);
      this.show({ kind: 'error', key: 'ADMIN.ACCESS.SAVE_FAILED' });
      // A timed-out write may still arrive later, so show what the server really has once we can read it.
      void this.admin.list().then((fresh) => this.entries.set(fresh)).catch(() => undefined);
    } finally {
      this.markSaving(entry.uid, false);
    }
  }

  private patch(uid: string, enabled: boolean): void {
    this.entries.update((list) => list.map((e) => (e.uid === uid ? { ...e, enabled } : e)));
  }

  private markSaving(uid: string, on: boolean): void {
    this.saving.update((set) => {
      const next = new Set(set);
      if (on) next.add(uid);
      else next.delete(uid);
      return next;
    });
  }

  private show(notice: Notice): void {
    this.notice.set(notice);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(null), NOTICE_MS);
  }

  private withTimeout<T>(work: Promise<T>): Promise<T> {
    return Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), SAVE_TIMEOUT_MS))]);
  }
}
