import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { todayKey } from '../utils/date';

/**
 * Keeps "today" correct in an installed PWA that stays open, or suspended in the background, across midnight.
 * iOS resumes such an app without reloading it, so the date is re-checked on resume and at midnight.
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  readonly today = signal(todayKey());
  /** Emits the new day key whenever the local date changes. */
  readonly dayChange = new Subject<string>();

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.refresh();
    });
    window.addEventListener('focus', () => this.refresh());
    window.addEventListener('pageshow', () => this.refresh());
    this.scheduleMidnight();
  }

  refresh(): void {
    const now = todayKey();
    if (now === this.today()) return;
    this.today.set(now);
    this.dayChange.next(now);
  }

  private scheduleMidnight(): void {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    setTimeout(() => {
      this.refresh();
      this.scheduleMidnight();
    }, Math.max(1000, next.getTime() - now.getTime()));
  }
}
