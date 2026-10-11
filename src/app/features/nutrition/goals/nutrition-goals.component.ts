import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivityLevel, Profile, Sex } from '../../../core/nutrition/models';
import { LegacyImportService } from '../../../core/nutrition/services/legacy-import.service';
import { NutritionBackupService } from '../../../core/nutrition/services/nutrition-backup.service';
import { NutritionProfileService } from '../../../core/nutrition/services/nutrition-profile.service';
import { ToastService } from '../../../core/nutrition/services/toast.service';
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
export class NutritionGoalsComponent implements OnInit, OnDestroy {
  private profileService = inject(NutritionProfileService);
  private backup = inject(NutritionBackupService);
  private legacy = inject(LegacyImportService);
  private language = inject(LanguageService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

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
  includePhotos = false;
  readonly busy = signal(false);
  readonly legacyCount = signal(0);
  /** Once the user types, a profile arriving from the server must not overwrite what they are editing. */
  private edited = false;

  constructor() {
    effect(() => {
      const profile = this.profileService.profile();
      if (!this.edited) this.form = this.toForm(profile);
    });
  }

  ngOnInit(): void {
    void this.legacy.pendingCount().then((count) => this.legacyCount.set(count));
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

  // Data

  async exportBackup(): Promise<void> {
    this.busy.set(true);
    try {
      const { blob, filename } = await this.backup.export(this.includePhotos);
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          return;
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      this.toast.show(`✓ ${this.translate.instant('NUTRITION.GOALS.EXPORTED')}`);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      this.busy.set(false);
    }
  }

  async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy.set(true);
    try {
      const result = await this.backup.import(await file.text());
      this.edited = false;
      this.form = this.toForm(this.profileService.profile());
      this.toast.show(`✓ ${this.translate.instant('NUTRITION.GOALS.IMPORT_OK', { count: result.entries })}`);
    } catch {
      this.toast.show(this.translate.instant('NUTRITION.GOALS.IMPORT_ERR'));
    } finally {
      this.busy.set(false);
    }
  }

  async importLegacy(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.legacy.importAll();
      this.legacyCount.set(0);
      this.edited = false;
      this.form = this.toForm(this.profileService.profile());
      this.toast.show(`✓ ${this.translate.instant('NUTRITION.GOALS.IMPORT_OK', { count: result.entries })}`);
    } catch (err) {
      console.error('Legacy import failed', err);
      this.toast.show(this.translate.instant('NUTRITION.GOALS.IMPORT_ERR'));
    } finally {
      this.busy.set(false);
    }
  }

  async clearAll(): Promise<void> {
    if (!confirm(this.translate.instant('NUTRITION.GOALS.CLEAR_CONFIRM'))) return;
    this.busy.set(true);
    try {
      await this.backup.clearAll();
      this.edited = false;
      this.form = this.toForm(this.profileService.profile());
      this.toast.show(this.translate.instant('NUTRITION.GOALS.CLEARED'));
    } catch (err) {
      console.error('Clearing the nutrition data failed', err);
      this.toast.show(this.translate.instant('NUTRITION.GOALS.CLEAR_FAILED'));
    } finally {
      this.busy.set(false);
    }
  }
}
