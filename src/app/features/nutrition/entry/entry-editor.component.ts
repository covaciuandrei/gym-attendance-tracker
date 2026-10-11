import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Confidence, DiaryEntry, FoodItem, MEAL_ICONS, MEAL_TYPES, MealType } from '../../../core/nutrition/models';
import { AiError, NutritionAiService } from '../../../core/nutrition/services/nutrition-ai.service';
import { NutritionDataService } from '../../../core/nutrition/services/nutrition-data.service';
import { isDateKey, mealForTime, nowTime, todayKey } from '../../../core/nutrition/utils/date';
import { newId } from '../../../core/nutrition/utils/id';
import { resizeImage } from '../../../core/nutrition/utils/image';
import { blankItem, itemsTotals, scaleItem } from '../../../core/nutrition/utils/nutrition';
import { LanguageService } from '../../../core/services/language.service';
import { NumberInputDirective } from '../shared/number-input/number-input.directive';

/** An item plus the snapshot grams-scaling starts from, so typing "250" never compounds rounding errors. */
interface Row {
  item: FoodItem;
  base: FoodItem;
  open: boolean;
}

type EditableField = 'kcal' | 'protein' | 'carbs' | 'fat';

/** AI failures whose message does not say what went wrong; they also show the technical reason. */
const HINTED_AI_ERRORS: string[] = ['unknown', 'network', 'unavailable'];

const toNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

@Component({
  selector: 'app-nutrition-entry-editor',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslateModule, NumberInputDirective],
  templateUrl: './entry-editor.component.html',
  styleUrls: ['./entry-editor.component.css'],
})
export class EntryEditorComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private data = inject(NutritionDataService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);
  private ai = inject(NutritionAiService);

  readonly mealTypes = MEAL_TYPES;
  readonly mealIcons = MEAL_ICONS;

  date = todayKey();
  id = 'new';
  isNew = true;
  readonly ready = signal(false);
  readonly notFound = signal(false);

  name = '';
  note = '';
  time = nowTime();
  meal: MealType = mealForTime(this.time);
  private mealTouched = false;
  private aiName = '';
  private source: 'ai' | 'manual' = 'manual';
  private original?: DiaryEntry;
  private dirty = false;

  readonly rows = signal<Row[]>([]);
  readonly totals = computed(() => itemsTotals(this.rows().map((r) => r.item)));
  /** The meal photo as a data URL (stored that way in Firestore and sent to the AI). */
  readonly photo = signal<string | null>(null);
  readonly confidence = signal<Confidence | null>(null);
  readonly comment = signal('');
  readonly model = signal<string | undefined>(undefined);
  readonly analyzing = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  private destroyed = false;
  /** Bumped for every photo choice/removal so a slow resize or download can never overwrite a newer choice. */
  private photoSeq = 0;
  private photoDirty = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
    });
  }

  async ngOnInit(): Promise<void> {
    const date = this.route.snapshot.paramMap.get('date');
    if (!isDateKey(date)) {
      await this.router.navigate(['/nutrition'], { replaceUrl: true });
      return;
    }
    this.date = date;
    this.id = this.route.snapshot.paramMap.get('id') ?? 'new';
    this.isNew = this.id === 'new';

    if (this.isNew) {
      this.time = date === todayKey() ? nowTime() : '12:00';
      this.meal = mealForTime(this.time);
    } else {
      let entry: DiaryEntry | undefined;
      try {
        entry = await this.data.getEntry(this.id);
      } catch (err) {
        console.error('Could not load the meal', err);
      }
      if (this.destroyed) return;
      if (!entry) {
        this.notFound.set(true);
      } else {
        this.populate(entry);
      }
    }
    this.ready.set(true);
  }

  private populate(entry: DiaryEntry): void {
    this.original = entry;
    this.date = entry.date;
    this.name = entry.name;
    this.aiName = entry.source === 'ai' ? entry.name : '';
    this.note = entry.note;
    this.time = entry.time;
    this.meal = entry.meal;
    this.mealTouched = true;
    this.source = entry.source;
    this.setItems(entry.items);
    this.confidence.set(entry.confidence ?? null);
    this.comment.set(entry.aiComment ?? '');
    this.model.set(entry.model);
    if (entry.hasPhoto) void this.loadStoredPhoto(entry.id);
  }

  private async loadStoredPhoto(id: string): Promise<void> {
    const seq = ++this.photoSeq;
    try {
      const url = await this.data.getPhoto(id);
      if (url && !this.destroyed && seq === this.photoSeq) this.photo.set(url);
    } catch (err) {
      console.warn('Could not load the photo', err);
    }
  }

  get canEstimate(): boolean {
    return !!this.photo() || this.note.trim().length > 0;
  }

  get title(): string {
    return this.isNew ? 'NUTRITION.ENTRY.NEW_TITLE' : 'NUTRITION.ENTRY.EDIT_TITLE';
  }

  touch(): void {
    this.dirty = true;
  }

  onTimeChange(): void {
    this.touch();
    if (!this.mealTouched) this.meal = mealForTime(this.time);
  }

  chooseMeal(meal: MealType): void {
    this.meal = meal;
    this.mealTouched = true;
    this.touch();
  }

  // Photo

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const seq = ++this.photoSeq;
    try {
      const dataUrl = await resizeImage(file);
      if (this.destroyed || seq !== this.photoSeq) return;
      this.photo.set(dataUrl);
      this.photoDirty = true;
      this.error.set(null);
      this.touch();
    } catch (err) {
      if (this.destroyed || seq !== this.photoSeq) return;
      console.error('Could not read the photo', err);
      this.error.set(this.withReason(this.translate.instant('NUTRITION.ENTRY.PHOTO_FAILED'), err));
    }
  }

  removePhoto(): void {
    this.photoSeq++;
    this.photo.set(null);
    this.photoDirty = true;
    this.touch();
  }

  // Items

  private setItems(items: FoodItem[]): void {
    this.rows.set(items.map((item) => ({ item: { ...item }, base: { ...item }, open: false })));
  }

  private patchRow(index: number, patch: (row: Row) => Row): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? patch(row) : row)));
    this.touch();
  }

  setItemName(index: number, name: string): void {
    this.patchRow(index, (r) => ({ ...r, item: { ...r.item, name }, base: { ...r.base, name } }));
  }

  setGrams(index: number, value: unknown): void {
    this.patchRow(index, (r) => ({ ...r, item: scaleItem(r.base, toNumber(value)) }));
  }

  setField(index: number, field: EditableField, value: unknown): void {
    this.patchRow(index, (r) => {
      const item = { ...r.item, [field]: toNumber(value) };
      return { ...r, item, base: { ...item } };
    });
  }

  toggleRow(index: number): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? { ...row, open: !row.open } : row)));
  }

  removeItem(index: number): void {
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
    this.touch();
  }

  addItem(): void {
    const item = blankItem();
    this.rows.update((rows) => [...rows, { item, base: { ...item }, open: true }]);
    this.touch();
  }

  // AI

  async estimate(): Promise<void> {
    if (!this.canEstimate || this.analyzing()) return;

    this.error.set(null);
    this.analyzing.set(true);
    try {
      const result = await this.ai.analyze({ photo: this.photo(), note: this.note.trim(), lang: this.language.currentLang() });
      if (this.destroyed) return;
      if (!result.isFood || result.items.length === 0) {
        this.error.set(this.translate.instant('NUTRITION.ENTRY.NO_FOOD'));
        return;
      }
      this.setItems(result.items);
      if (!this.name.trim() || this.name === this.aiName) this.name = result.name;
      this.aiName = result.name;
      this.source = 'ai';
      this.confidence.set(result.confidence);
      this.comment.set(result.comment);
      this.model.set(result.model);
      this.touch();
    } catch (err) {
      if (!this.destroyed) this.error.set(this.messageFor(err));
    } finally {
      if (!this.destroyed) this.analyzing.set(false);
    }
  }

  private messageFor(err: unknown): string {
    const code = err instanceof AiError ? err.code : 'unknown';
    if (!(err instanceof AiError)) console.error('The AI estimate failed', err);
    const message = this.translate.instant(`NUTRITION.ERRORS.${code.toUpperCase()}`);
    // The problems the message cannot explain get a short technical hint, so they can be told apart.
    const hint = err instanceof AiError ? err.detail : err instanceof Error ? err.message : undefined;
    return HINTED_AI_ERRORS.includes(code) && hint ? `${message} (${hint.slice(0, 80)})` : message;
  }

  /** Appends the technical reason, such as a Firestore error code, so a failure on someone's phone can be identified. */
  private withReason(message: string, err: unknown): string {
    const code = (err as { code?: unknown } | null)?.code;
    const reason = typeof code === 'string' ? code : err instanceof Error ? err.message : '';
    return reason ? `${message} (${reason.slice(0, 80)})` : message;
  }

  // Save / delete / leave

  async save(): Promise<void> {
    const kept = this.rows()
      .map((r) => r.item)
      .filter((item) => item.name.trim() || item.kcal > 0 || item.protein > 0 || item.carbs > 0 || item.fat > 0);
    if (kept.length === 0) {
      this.error.set(this.translate.instant('NUTRITION.ENTRY.NEED_ITEMS'));
      return;
    }

    const fallbackName = this.name.trim() || kept[0].name.trim() || this.translate.instant(`NUTRITION.MEAL.${this.meal.toUpperCase()}`);
    const items = kept.map((item) => ({ ...item, name: item.name.trim() || fallbackName }));
    const now = Date.now();
    const entry: DiaryEntry = {
      id: this.isNew ? newId() : this.id,
      date: this.date,
      time: this.time || nowTime(),
      meal: this.meal,
      name: fallbackName,
      note: this.note.trim(),
      items,
      totals: itemsTotals(items),
      hasPhoto: this.original?.hasPhoto ?? false,
      source: this.source,
      confidence: this.confidence() ?? undefined,
      aiComment: this.comment() || undefined,
      model: this.model(),
      createdAt: this.original?.createdAt ?? now,
      updatedAt: now,
    };

    this.saving.set(true);
    this.error.set(null);
    try {
      // undefined keeps the stored photo, null removes it, a data URL replaces it.
      await this.data.saveEntry(entry, this.photoDirty ? this.photo() : undefined);
      this.dirty = false;
      await this.router.navigate(['/nutrition', 'day', this.date], { replaceUrl: true });
    } catch (err) {
      console.error('Could not save the meal', err);
      this.error.set(this.withReason(this.translate.instant('NUTRITION.ENTRY.SAVE_FAILED'), err));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    if (this.isNew || !confirm(this.translate.instant('NUTRITION.ENTRY.DELETE_CONFIRM'))) return;
    try {
      await this.data.removeEntry(this.id);
      this.dirty = false;
      await this.router.navigate(['/nutrition', 'day', this.date], { replaceUrl: true });
    } catch (err) {
      console.error('Could not delete the meal', err);
      this.error.set(this.withReason(this.translate.instant('NUTRITION.ENTRY.SAVE_FAILED'), err));
    }
  }

  async goBack(): Promise<void> {
    if (this.dirty && !confirm(this.translate.instant('NUTRITION.ENTRY.DISCARD_CONFIRM'))) return;
    this.dirty = false;
    await this.router.navigate(['/nutrition', 'day', this.date], { replaceUrl: true });
  }

  round(value: number): number {
    return Math.round(value);
  }
}
