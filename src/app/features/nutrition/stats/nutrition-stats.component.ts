import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { DiaryEntry } from '../../../core/nutrition/models';
import { ClockService } from '../../../core/nutrition/services/clock.service';
import { NutritionDataService } from '../../../core/nutrition/services/nutrition-data.service';
import { NutritionProfileService } from '../../../core/nutrition/services/nutrition-profile.service';
import { addDays, daysBetween, parseDateKey } from '../../../core/nutrition/utils/date';
import { totalsByDate } from '../../../core/nutrition/utils/diary';
import { Level, dayLevel, sumMacros } from '../../../core/nutrition/utils/nutrition';
import { LanguageService } from '../../../core/services/language.service';

interface Bar {
  key: string;
  label: string;
  showLabel: boolean;
  kcal: number;
  height: number;
  level: Level;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The "Nutrition" tab of the Stats page. */
@Component({
  selector: 'app-nutrition-stats',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './nutrition-stats.component.html',
  styleUrls: ['./nutrition-stats.component.css'],
})
export class NutritionStatsComponent implements OnInit {
  private data = inject(NutritionDataService);
  private profileService = inject(NutritionProfileService);
  private language = inject(LanguageService);
  private clock = inject(ClockService);
  private destroyRef = inject(DestroyRef);

  readonly range = signal<7 | 30>(7);
  readonly loading = signal(true);
  private entries = signal<DiaryEntry[]>([]);
  readonly target = this.profileService.targetKcal;
  private loadSeq = 0;

  private locale = computed(() => (this.language.currentLang() === 'ro' ? 'ro-RO' : 'en-GB'));
  private dayKeys = computed(() => {
    const end = this.clock.today();
    return daysBetween(addDays(end, -(this.range() - 1)), end);
  });
  private totalsMap = computed(() => totalsByDate(this.entries()));
  private loggedKeys = computed(() => this.dayKeys().filter((k) => this.totalsMap().has(k)));

  readonly loggedDays = computed(() => this.loggedKeys().length);

  readonly avg = computed(() => {
    const keys = this.loggedKeys();
    if (keys.length === 0) return null;
    const sum = sumMacros(keys.map((k) => this.totalsMap().get(k)!));
    const n = keys.length;
    return { kcal: Math.round(sum.kcal / n), protein: round1(sum.protein / n), carbs: round1(sum.carbs / n), fat: round1(sum.fat / n) };
  });

  /** Share of calories coming from each macro (4/4/9 kcal per gram). */
  readonly split = computed(() => {
    const a = this.avg();
    if (!a) return null;
    const protein = a.protein * 4;
    const carbs = a.carbs * 4;
    const fat = a.fat * 9;
    const total = protein + carbs + fat || 1;
    const p = Math.round((protein / total) * 100);
    const c = Math.round((carbs / total) * 100);
    return { p, c, f: Math.max(0, 100 - p - c) };
  });

  private chartMax = computed(() => Math.max(this.target() ?? 0, ...this.dayKeys().map((k) => this.totalsMap().get(k)?.kcal ?? 0), 1) * 1.1);

  readonly bars = computed<Bar[]>(() => {
    const keys = this.dayKeys();
    const max = this.chartMax();
    const compact = this.range() > 7;
    return keys.map((key, i) => {
      const total = this.totalsMap().get(key);
      const date = parseDateKey(key);
      const label = compact ? String(date.getDate()) : date.toLocaleDateString(this.locale(), { weekday: 'short' });
      return {
        key,
        label,
        showLabel: !compact || i % 5 === 0 || i === keys.length - 1,
        kcal: total ? Math.round(total.kcal) : 0,
        height: total ? Math.max(3, (total.kcal / max) * 100) : 0,
        level: dayLevel(total?.kcal ?? 0, this.target(), !!total, key === this.clock.today()),
      };
    });
  });

  readonly targetLine = computed(() => (this.target() ? (this.target()! / this.chartMax()) * 100 : null));

  ngOnInit(): void {
    void this.load();
    this.clock.refresh();
    this.clock.dayChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => void this.load());
  }

  setRange(range: 7 | 30): void {
    if (this.range() === range) return;
    this.range.set(range);
    void this.load();
  }

  private async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    try {
      const keys = this.dayKeys();
      const entries = await this.data.getRange(keys[0], keys[keys.length - 1]);
      // A newer range may have been requested while this one was loading.
      if (seq === this.loadSeq) this.entries.set(entries);
    } catch (err) {
      console.error('Could not load nutrition stats', err);
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }
}
