import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DiaryEntry, MEAL_ICONS, MealType } from '../../../core/nutrition/models';
import { NutritionDataService } from '../../../core/nutrition/services/nutrition-data.service';
import { NutritionProfileService } from '../../../core/nutrition/services/nutrition-profile.service';
import { ToastService } from '../../../core/nutrition/services/toast.service';
import { addDays, isDateKey, nowTime, todayKey } from '../../../core/nutrition/utils/date';
import { dayTotals } from '../../../core/nutrition/utils/diary';
import { LanguageService } from '../../../core/services/language.service';
import { DaySummaryComponent } from '../shared/day-summary/day-summary.component';

@Component({
  selector: 'app-nutrition-day',
  standalone: true,
  imports: [RouterLink, TranslateModule, DaySummaryComponent],
  templateUrl: './nutrition-day.component.html',
  styleUrls: ['./nutrition-day.component.css'],
})
export class NutritionDayComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private data = inject(NutritionDataService);
  private language = inject(LanguageService);
  private profileService = inject(NutritionProfileService);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);

  readonly mealIcons = MEAL_ICONS;
  readonly date = signal(todayKey());
  readonly entries = signal<DiaryEntry[]>([]);
  readonly recents = signal<DiaryEntry[]>([]);
  readonly photos = signal<Record<string, string>>({});
  readonly loading = signal(true);
  /** True when the meals of the day could not be read. Without it a failed read looked like an empty day. */
  readonly loadFailed = signal(false);
  private loadSeq = 0;
  private destroyed = false;

  readonly totals = computed(() => dayTotals(this.entries()));
  readonly target = this.profileService.targetKcal;
  readonly macroTargets = computed(() => {
    const plan = this.profileService.plan();
    return plan ? { protein: plan.protein, carbs: plan.carbs, fat: plan.fat } : null;
  });

  readonly title = computed(() => {
    const [y, m, d] = this.date().split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const sameYear = y === new Date().getFullYear();
    const locale = this.language.currentLang() === 'ro' ? 'ro-RO' : 'en-GB';
    const text = date.toLocaleDateString(
      locale,
      sameYear ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' },
    );
    return text.charAt(0).toUpperCase() + text.slice(1);
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const date = params.get('date');
      if (!isDateKey(date)) {
        void this.router.navigate(['/nutrition'], { replaceUrl: true });
        return;
      }
      this.date.set(date);
      void this.load();
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
    });
  }

  private async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const [entries, recents] = await Promise.all([this.data.getDay(this.date()), this.data.recentMeals(8)]);
      if (this.destroyed || seq !== this.loadSeq) return;
      this.entries.set(entries);
      this.recents.set(recents);
      this.photos.set({});
      void this.loadPhotos(entries, seq);
    } catch (err) {
      console.error('Could not load the day', err);
      if (!this.destroyed && seq === this.loadSeq) {
        // Never leave the meals of another day on screen under this day's title.
        this.entries.set([]);
        this.loadFailed.set(true);
      }
    } finally {
      if (!this.destroyed && seq === this.loadSeq) this.loading.set(false);
    }
  }

  retry(): void {
    void this.load();
  }

  /** Photos live in their own documents, so the list shows first and the thumbnails fill in as they arrive. */
  private async loadPhotos(entries: DiaryEntry[], seq: number): Promise<void> {
    await Promise.all(
      entries
        .filter((entry) => entry.hasPhoto)
        .map(async (entry) => {
          try {
            const url = await this.data.getPhoto(entry.id);
            if (url && !this.destroyed && seq === this.loadSeq) this.photos.update((all) => ({ ...all, [entry.id]: url }));
          } catch (err) {
            console.warn('Could not load a photo', entry.id, err);
          }
        }),
    );
  }

  displayName(entry: DiaryEntry): string {
    return entry.name || entry.items[0]?.name || this.translate.instant(this.mealKey(entry.meal));
  }

  mealKey(meal: MealType): string {
    return `NUTRITION.MEAL.${meal.toUpperCase()}`;
  }

  round(value: number): number {
    return Math.round(value);
  }

  shift(days: number): void {
    void this.router.navigate(['/nutrition', 'day', addDays(this.date(), days)]);
  }

  open(entry: DiaryEntry): void {
    void this.router.navigate(['/nutrition', 'day', this.date(), 'entry', entry.id]);
  }

  async addAgain(source: DiaryEntry): Promise<void> {
    const time = this.date() === todayKey() ? nowTime() : source.time;
    try {
      await this.data.duplicate(source, this.date(), time);
      this.toast.show(`✓ ${this.translate.instant('NUTRITION.DAY.ADDED')}`);
      await this.load();
    } catch (err) {
      console.error('Could not copy the meal', err);
      this.toast.show(this.translate.instant('NUTRITION.ENTRY.SAVE_FAILED'));
    }
  }
}
