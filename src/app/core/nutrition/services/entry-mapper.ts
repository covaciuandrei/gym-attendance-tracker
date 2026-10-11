import { Confidence, DiaryEntry, FoodItem, MEAL_TYPES, MealType } from '../models';
import { isDateKey, mealForTime } from '../utils/date';
import { itemsTotals } from '../utils/nutrition';

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const amount = (value: unknown, max: number): number => {
  const n = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n * 10) / 10)) : 0;
};

const timestamp = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

export function cleanItem(raw: unknown): FoodItem {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    name: text(r['name'], 80),
    grams: amount(r['grams'], 5000),
    kcal: Math.round(amount(r['kcal'], 5000)),
    protein: amount(r['protein'], 500),
    carbs: amount(r['carbs'], 800),
    fat: amount(r['fat'], 500),
    fiber: amount(r['fiber'], 200),
    sugar: amount(r['sugar'], 800),
  };
}

/**
 * Builds a clean entry from stored or imported data. Never trusts the stored totals: they are recomputed from
 * the items, so they can't drift. Throws when the data can't be a valid entry at all.
 */
export function normalizeEntry(id: string, data: unknown, now = Date.now()): DiaryEntry {
  if (!data || typeof data !== 'object') throw new Error('invalid entry');
  const r = data as Record<string, unknown>;

  if (typeof id !== 'string' || !id || id.length > 100) throw new Error('invalid id');
  const date = r['date'];
  if (typeof date !== 'string' || !isDateKey(date)) throw new Error('invalid date');
  const rawItems = r['items'];
  if (!Array.isArray(rawItems) || rawItems.length > 100) throw new Error('invalid items');

  const rawTime = r['time'];
  const time = typeof rawTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : '12:00';
  const meal = MEAL_TYPES.includes(r['meal'] as MealType) ? (r['meal'] as MealType) : mealForTime(time);
  const confidence = ['low', 'medium', 'high'].includes(r['confidence'] as string) ? (r['confidence'] as Confidence) : undefined;
  const items = rawItems.map(cleanItem);

  return {
    id,
    date,
    time,
    meal,
    name: text(r['name'], 80),
    note: text(r['note'], 600),
    items,
    totals: itemsTotals(items),
    hasPhoto: r['hasPhoto'] === true,
    source: r['source'] === 'ai' ? 'ai' : 'manual',
    confidence,
    aiComment: text(r['aiComment'], 300) || undefined,
    model: text(r['model'], 60) || undefined,
    createdAt: timestamp(r['createdAt'], now),
    updatedAt: timestamp(r['updatedAt'], now),
  };
}

/** The document written to Firestore: no `id` (it is the document key) and no undefined values (Firestore rejects them). */
export function toEntryDoc(entry: DiaryEntry): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    date: entry.date,
    time: entry.time,
    meal: entry.meal,
    name: entry.name,
    note: entry.note,
    items: entry.items.map(cleanItem),
    totals: entry.totals,
    hasPhoto: entry.hasPhoto,
    source: entry.source,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
  if (entry.confidence) doc['confidence'] = entry.confidence;
  if (entry.aiComment) doc['aiComment'] = entry.aiComment;
  if (entry.model) doc['model'] = entry.model;
  return doc;
}
