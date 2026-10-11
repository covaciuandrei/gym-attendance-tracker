import { Component, OnDestroy, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ActivityLevel, Profile, Sex } from '../../../core/nutrition/models';
import { NutritionProfileService } from '../../../core/nutrition/services/nutrition-profile.service';
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
export class NutritionGoalsComponent implements OnDestroy {
  private profileService = inject(NutritionProfileService);
  private language = inject(LanguageService);

  readonly plan = this.profileService.plan;
  readonly rates = RATES;
  readonly activities: { value: ActivityLevel; key: string }[] = [
    { value: 'sedentary', key: 'NUTRITION.ACTIVITY.SEDENTARY' },
    { value: 'light', key: 'NUTRITION.ACTIVITY.LIGHT' },
    { value: 'moderate', key: 'NUTRITION.ACTIVITY.MODERATE' },
    { value: 'active', key: 'NUTRITION.ACTIVITY.ACTIVE' },
    { value: 'very_active', key: 'NUTRITION.ACTIVITY.VERY_ACTIVE' },
  ];

  form: FormState = this.toForm(this.profileService.profile());
  /** Once the user types, a profile arriving from the server must not overwrite what they are editing. */
  private edited = false;

  constructor() {
    effect(() => {
      const profile = this.profileService.profile();
      if (!this.edited) this.form = this.toForm(profile);
    });
  }

  ngOnDestroy(): void {
    void this.profileService.flush();
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
    this.edited = true;
    const f = this.form;
    this.profileService.update({
      sex: f.sex,
      age: f.age,
      heightCm: f.heightCm,
      weightKg: f.weightKg,
      bodyFatPct: f.bodyFatPct,
      activity: f.activity,
      weeklyChangeKg: Number(f.rate),
      customTargetKcal: f.customTarget,
    });
  }

  goalKey(rate: number): string {
    return rate < 0 ? 'NUTRITION.GOAL.LOSE' : rate > 0 ? 'NUTRITION.GOAL.GAIN' : 'NUTRITION.GOAL.MAINTAIN';
  }

  formatRate(rate: number): string {
    const locale = this.language.currentLang() === 'ro' ? 'ro-RO' : 'en-GB';
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Math.abs(rate));
  }
}
