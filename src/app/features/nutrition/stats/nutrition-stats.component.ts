import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DiaryEntry, WeightLog } from '../../../core/nutrition/models';
import { ClockService } from '../../../core/nutrition/services/clock.service';
import { NutritionDataService } from '../../../core/nutrition/services/nutrition-data.service';
import { NutritionProfileService } from '../../../core/nutrition/services/nutrition-profile.service';
import { ToastService } from '../../../core/nutrition/services/toast.service';
import { addDays, daysBetween, parseDateKey } from '../../../core/nutrition/utils/date';
import { totalsByDate } from '../../../core/nutrition/utils/diary';
import { Level, dayLevel, sumMacros } from '../../../core/nutrition/utils/nutrition';
import { LanguageService } from '../../../core/services/language.service';
import { NumberInputDirective } from '../shared/number-input/number-input.directive';
import { NutritionToastComponent } from '../shared/nutrition-toast.component';

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
  imports: [TranslateModule, NumberInputDirective, NutritionToastComponent],
  templateUrl: './nutrition-stats.component.html',
  styleUrls: ['./nutrition-stats.component.css'],
})
export class NutritionStatsComponent implements OnInit {
  private data = inject(NutritionDataService);
  private profileService = inject(NutritionProfileService);
  private language = inject(LanguageService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private clock = inject(ClockService);
  private destroyRef = inject(DestroyRef);

  readonly range = signal<7 | 30>(7);
  readonly loading = signal(true);
  private entries = signal<DiaryEntry[]>([]);
  readonly weights = signal<WeightLog[]>([]);
  weightInput: number | null = null;
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

  // Weight

  readonly weightChart = computed(() => {
    const logs = this.weights().slice(-30);
    if (logs.length === 0) return null;
    const W = 300;
    const H = 100;
    const P = 12;
    const kgs = logs.map((l) => l.kg);
    const min = Math.min(...kgs) - 0.5;
    const max = Math.max(...kgs) + 0.5;
    const t0 = parseDateKey(logs[0].date).getTime();
    const t1 = parseDateKey(logs[logs.length - 1].date).getTime();
    const points = logs.map((l) => ({
      x: logs.length === 1 || t1 === t0 ? W / 2 : P + ((parseDateKey(l.date).getTime() - t0) / (t1 - t0)) * (W - 2 * P),
      y: H - P - ((l.kg - min) / (max - min)) * (H - 2 * P),
    }));
    return { points, path: points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), width: W, height: H };
  });

  readonly currentWeight = computed(() => this.weights().at(-1)?.kg ?? null);

  readonly weightChange = computed(() => {
    const logs = this.weights();
    if (logs.length < 2) return null;
    return round1(logs[logs.length - 1].kg - logs[0].kg);
  });

  readonly recentWeights = computed(() => this.weights().slice(-5).reverse());

  ngOnInit(): void {
    void this.load();
    void this.loadWeights();
    this.clock.refresh();
    this.clock.dayChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => void this.load());
  }

  setRange(range: 7 | 30): void {
    if (this.range() === range) return;
    this.range.set(range);
    void this.load();
  }

  signed(value: number): string {
    return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}`;
  }

  formatDate(key: string): string {
    return parseDateKey(key).toLocaleDateString(this.locale(), { day: 'numeric', month: 'short', year: 'numeric' });
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

  private async loadWeights(): Promise<void> {
    try {
      this.weights.set(await this.data.weights());
    } catch (err) {
      console.error('Could not load weights', err);
    }
  }

  async logWeight(): Promise<void> {
    const kg = Number(this.weightInput);
    if (!Number.isFinite(kg) || kg < 30 || kg > 300) {
      this.toast.show(this.translate.instant('NUTRITION.STATS.WEIGHT_INVALID'));
      return;
    }
    try {
      await this.data.logWeight(kg, this.clock.today());
      this.profileService.update({ weightKg: kg });
      this.weightInput = null;
      await this.loadWeights();
      this.toast.show(`✓ ${this.translate.instant('NUTRITION.STATS.WEIGHT_SAVED')}`);
    } catch (err) {
      console.error('Could not save the weight', err);
      this.toast.show(this.translate.instant('NUTRITION.ENTRY.SAVE_FAILED'));
    }
  }

  async deleteWeight(date: string): Promise<void> {
    try {
      await this.data.removeWeight(date);
      await this.loadWeights();
      const latest = this.weights().at(-1);
      if (latest) this.profileService.update({ weightKg: latest.kg });
    } catch (err) {
      console.error('Could not delete the weight', err);
    }
  }
}
