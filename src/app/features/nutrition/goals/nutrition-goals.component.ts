import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { ActivityLevel, Profile, Sex } from '../../../core/nutrition/models';
import { NutritionProfileService } from '../../../core/nutrition/services/nutrition-profile.service';
import { ToastService } from '../../../core/nutrition/services/toast.service';
import { computePlan } from '../../../core/nutrition/utils/nutrition';
import { sameProfile, sanitizeProfile } from '../../../core/nutrition/utils/profile';
import { LanguageService } from '../../../core/services/language.service';
import { NumberInputDirective } from '../shared/number-input/number-input.directive';

interface FormState {
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  bodyFatPct: number | null;
  activity: ActivityLevel;
  rate: number;
  customTarget: number | null;
}

type NumericField = 'age' | 'heightCm' | 'weightKg' | 'bodyFatPct' | 'customTarget';

const RATES = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5];

@Component({
  selector: 'app-nutrition-goals',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslateModule, NumberInputDirective],
  templateUrl: './nutrition-goals.component.html',
  styleUrls: ['./nutrition-goals.component.css'],
})
export class NutritionGoalsComponent implements HasUnsavedChanges {
  private profileService = inject(NutritionProfileService);
  private language = inject(LanguageService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  readonly rates = RATES;
  readonly activities: { value: ActivityLevel; key: string }[] = [
    { value: 'sedentary', key: 'NUTRITION.ACTIVITY.SEDENTARY' },
    { value: 'light', key: 'NUTRITION.ACTIVITY.LIGHT' },
    { value: 'moderate', key: 'NUTRITION.ACTIVITY.MODERATE' },
    { value: 'active', key: 'NUTRITION.ACTIVITY.ACTIVE' },
    { value: 'very_active', key: 'NUTRITION.ACTIVITY.VERY_ACTIVE' },
  ];

  form: FormState = this.toForm(this.profileService.profile());
  /** What the user typed, cleaned up the way it is saved. Null until they change something. */
  private readonly typed = signal<Profile | null>(null);
  /** The numbers follow what is typed, so a change can be tried out before it is saved. */
  readonly plan = computed(() => computePlan(this.typed() ?? this.profileService.profile()));
  /** True while the form holds changes that are not saved yet. */
  readonly dirty = computed(() => {
    const typed = this.typed();
    return typed !== null && !sameProfile(typed, this.profileService.profile());
  });
  readonly saving = signal(false);

  constructor() {
    // Until the user changes something the form follows the saved profile, e.g. when it arrives from the server.
    effect(() => {
      const saved = this.profileService.profile();
      if (this.typed() === null) this.form = this.toForm(saved);
    });
  }

  private toForm(p: Profile): FormState {
    return {
      sex: p.sex,
      age: p.age,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      bodyFatPct: p.bodyFatPct,
      activity: p.activity,
      rate: p.weeklyChangeKg,
      customTarget: p.customTargetKcal,
    };
  }

  get formulaKey(): string {
    return this.plan()?.bmrMethod === 'katch' ? 'NUTRITION.GOALS.FORMULA_KATCH' : 'NUTRITION.GOALS.FORMULA_MIFFLIN';
  }

  // Profile

  setSex(sex: Sex): void {
    this.form.sex = sex;
    this.onProfileChange();
  }

  setNumber(field: NumericField, value: number | null): void {
    this.form[field] = value;
    this.onProfileChange();
  }

  onProfileChange(): void {
    const f = this.form;
    this.typed.set(
      sanitizeProfile({
        sex: f.sex,
        age: f.age,
        heightCm: f.heightCm,
        weightKg: f.weightKg,
        bodyFatPct: f.bodyFatPct,
        activity: f.activity,
        weeklyChangeKg: Number(f.rate),
        customTargetKcal: f.customTarget,
      }),
    );
  }

  async save(): Promise<void> {
    const typed = this.typed();
    if (!typed || this.saving()) return;
    this.saving.set(true);
    try {
      if (await this.profileService.save(typed)) {
        this.typed.set(null);
        this.toast.show(`✓ ${this.translate.instant('NUTRITION.GOALS.SAVED')}`);
      } else {
        this.toast.show(this.translate.instant('NUTRITION.ENTRY.SAVE_FAILED'));
      }
    } finally {
      this.saving.set(false);
    }
  }

  /** Leaving with unsaved changes needs the user's yes. */
  canLeave(): boolean {
    return !this.dirty() || confirm(this.translate.instant('NUTRITION.ENTRY.DISCARD_CONFIRM'));
  }

  goalKey(rate: number): string {
    return rate < 0 ? 'NUTRITION.GOAL.LOSE' : rate > 0 ? 'NUTRITION.GOAL.GAIN' : 'NUTRITION.GOAL.MAINTAIN';
  }

  formatRate(rate: number): string {
    const locale = this.language.currentLang() === 'ro' ? 'ro-RO' : 'en-GB';
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Math.abs(rate));
  }
}
