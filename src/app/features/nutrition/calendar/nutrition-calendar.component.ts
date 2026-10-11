import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Macros } from '../../../core/nutrition/models';
import { ClockService } from '../../../core/nutrition/services/clock.service';
import { NutritionDataService } from '../../../core/nutrition/services/nutrition-data.service';
import { NutritionProfileService } from '../../../core/nutrition/services/nutrition-profile.service';
import { mondayIndex, toDateKey } from '../../../core/nutrition/utils/date';
import { dayTotals, totalsByDate } from '../../../core/nutrition/utils/diary';
import { Level, dayLevel, emptyMacros } from '../../../core/nutrition/utils/nutrition';
import { LanguageService } from '../../../core/services/language.service';
import { DaySummaryComponent } from '../shared/day-summary/day-summary.component';

interface DayCell {
  date: number;
  fullDate: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  kcal: number;
  level: Level;
}

interface MonthData {
  month: number;
  label: string;
  days: DayCell[];
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

@Component({
  selector: 'app-nutrition-calendar',
  standalone: true,
  imports: [RouterLink, TranslateModule, DaySummaryComponent],
  templateUrl: './nutrition-calendar.component.html',
  styleUrls: ['./nutrition-calendar.component.css'],
})
export class NutritionCalendarComponent implements OnInit {
  private data = inject(NutritionDataService);
  private router = inject(Router);
  private language = inject(LanguageService);
  private profileService = inject(NutritionProfileService);
  private clock = inject(ClockService);
  private destroyRef = inject(DestroyRef);

  readonly today = this.clock.today;
  readonly year = signal(new Date().getFullYear());
  readonly month = signal(new Date().getMonth());
  readonly view = signal<'monthly' | 'yearly'>('monthly');
  readonly loading = signal(true);
  readonly todayTotals = signal<Macros>(emptyMacros());
  private totals = signal<Map<string, Macros>>(new Map());
  private loadSeq = 0;

  readonly target = this.profileService.targetKcal;
  readonly showSetup = computed(() => this.profileService.loaded() && this.profileService.plan() === null);
  readonly macroTargets = computed(() => {
    const plan = this.profileService.plan();
    return plan ? { protein: plan.protein, carbs: plan.carbs, fat: plan.fat } : null;
  });

  private locale = computed(() => (this.language.currentLang() === 'ro' ? 'ro-RO' : 'en-GB'));
  readonly weekdays = computed(() => this.weekdayLabels('short'));
  readonly weekdaysMini = computed(() => this.weekdayLabels('narrow'));
  readonly title = computed(() =>
    this.view() === 'monthly' ? this.format(new Date(this.year(), this.month(), 1), { month: 'long', year: 'numeric' }) : String(this.year()),
  );
  readonly todayLabel = computed(() => {
    this.today();
    return this.format(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
  });
  readonly days = computed(() => this.buildMonth(this.year(), this.month()));
  readonly months = computed(() => this.buildYear(this.year()));

  ngOnInit(): void {
    void this.load();
    void this.loadToday();
    this.clock.refresh();
    // The app can stay open across midnight: re-read everything when the date rolls over.
    this.clock.dayChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.load();
      void this.loadToday();
    });
  }

  private format(date: Date, options: Intl.DateTimeFormatOptions): string {
    return capitalize(date.toLocaleDateString(this.locale(), options));
  }

  private weekdayLabels(width: 'short' | 'narrow'): string[] {
    // 2024-01-01 is a Monday.
    return Array.from({ length: 7 }, (_, i) => capitalize(new Date(2024, 0, 1 + i).toLocaleDateString(this.locale(), { weekday: width })));
  }

  private cell(date: Date, inMonth: boolean): DayCell {
    const key = toDateKey(date);
    const total = this.totals().get(key);
    return {
      date: date.getDate(),
      fullDate: key,
      isCurrentMonth: inMonth,
      isToday: key === this.today(),
      kcal: total ? Math.round(total.kcal) : 0,
      level: dayLevel(total?.kcal ?? 0, this.target(), !!total, key === this.today()),
    };
  }

  private buildMonth(year: number, month: number): DayCell[] {
    const start = new Date(year, month, 1 - mondayIndex(new Date(year, month, 1)));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return this.cell(d, d.getMonth() === month);
    });
  }

  private buildYear(year: number): MonthData[] {
    return Array.from({ length: 12 }, (_, month) => {
      const lead = mondayIndex(new Date(year, month, 1));
      const length = new Date(year, month + 1, 0).getDate();
      const blanks: DayCell[] = Array.from({ length: lead }, () => ({ date: 0, fullDate: '', isCurrentMonth: false, isToday: false, kcal: 0, level: 'none' as Level }));
      const days = Array.from({ length }, (_, i) => this.cell(new Date(year, month, i + 1), true));
      return { month, label: this.format(new Date(year, month, 1), { month: 'long' }), days: [...blanks, ...days] };
    });
  }

  private async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    try {
      const y = this.year();
      let start: string;
      let end: string;
      if (this.view() === 'monthly') {
        const first = new Date(y, this.month(), 1);
        const s = new Date(y, this.month(), 1 - mondayIndex(first));
        start = toDateKey(s);
        end = toDateKey(new Date(s.getFullYear(), s.getMonth(), s.getDate() + 41));
      } else {
        start = `${y}-01-01`;
        end = `${y}-12-31`;
      }
      const entries = await this.data.getRange(start, end);
      if (seq === this.loadSeq) this.totals.set(totalsByDate(entries));
    } catch (err) {
      console.error('Could not load the nutrition calendar', err);
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }

  private async loadToday(): Promise<void> {
    try {
      this.todayTotals.set(dayTotals(await this.data.getDay(this.today())));
    } catch (err) {
      console.error('Could not load today', err);
    }
  }

  previous(): void {
    this.step(-1);
  }

  next(): void {
    this.step(1);
  }

  private step(delta: number): void {
    if (this.view() === 'monthly') {
      const d = new Date(this.year(), this.month() + delta, 1);
      this.year.set(d.getFullYear());
      this.month.set(d.getMonth());
    } else {
      this.year.set(this.year() + delta);
    }
    void this.load();
  }

  setView(view: 'monthly' | 'yearly'): void {
    if (this.view() === view) return;
    this.view.set(view);
    void this.load();
  }

  openDay(key: string): void {
    if (key) void this.router.navigate(['/nutrition', 'day', key]);
  }
}
