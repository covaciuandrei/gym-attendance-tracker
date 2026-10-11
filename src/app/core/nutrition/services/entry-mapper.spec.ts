import { DiaryEntry } from '../models';
import { cleanItem, normalizeEntry, toEntryDoc } from './entry-mapper';

describe('entry mapper', () => {
  const stored = (patch: Record<string, unknown> = {}) => ({
    date: '2026-10-11',
    time: '08:30',
    meal: 'breakfast',
    name: 'Oats',
    note: '  with  milk ',
    items: [{ name: 'Oats', grams: 80, kcal: 300, protein: 10, carbs: 50, fat: 6, fiber: 8, sugar: 1 }],
    totals: { kcal: 99999 },
    hasPhoto: true,
    source: 'ai',
    confidence: 'high',
    aiComment: 'About a bowl.',
    model: 'gemini-x',
    createdAt: 1,
    updatedAt: 2,
    ...patch,
  });

  it('rebuilds an entry and recomputes the totals from the items', () => {
    const entry = normalizeEntry('e1', stored());
    expect(entry.id).toBe('e1');
    expect(entry.totals.kcal).toBe(300);
    expect(entry.totals.protein).toBe(10);
    expect(entry.note).toBe('with milk');
    expect(entry.hasPhoto).toBeTrue();
    expect(entry.source).toBe('ai');
    expect(entry.confidence).toBe('high');
    expect(entry.createdAt).toBe(1);
    expect(entry.updatedAt).toBe(2);
  });

  it('falls back to safe values for broken optional fields', () => {
    const entry = normalizeEntry('e1', stored({ meal: 'brunch', time: '25:99', source: 'robot', confidence: 'sure', hasPhoto: 'yes', createdAt: 'x' }), 777);
    expect(entry.meal).toBe('lunch');
    expect(entry.time).toBe('12:00');
    expect(entry.source).toBe('manual');
    expect(entry.confidence).toBeUndefined();
    expect(entry.hasPhoto).toBeFalse();
    expect(entry.createdAt).toBe(777);
  });

  it('rejects data that cannot be an entry', () => {
    expect(() => normalizeEntry('e1', null)).toThrow();
    expect(() => normalizeEntry('', stored())).toThrow();
    expect(() => normalizeEntry('x'.repeat(101), stored())).toThrow();
    expect(() => normalizeEntry('e1', stored({ date: '2026-02-30' }))).toThrow();
    expect(() => normalizeEntry('e1', stored({ date: '11/10/2026' }))).toThrow();
    expect(() => normalizeEntry('e1', stored({ items: 'nope' }))).toThrow();
    expect(() => normalizeEntry('e1', stored({ items: new Array(101).fill({}) }))).toThrow();
  });

  it('cleans item numbers and text', () => {
    expect(cleanItem({ name: '  A   B ', grams: -5, kcal: 'x', protein: 1e9, carbs: null, fat: 2.26 })).toEqual({
      name: 'A B',
      grams: 0,
      kcal: 0,
      protein: 500,
      carbs: 0,
      fat: 2.3,
      fiber: 0,
      sugar: 0,
    });
    expect(cleanItem(null).name).toBe('');
  });

  it('writes a document without id and without undefined values', () => {
    const entry: DiaryEntry = normalizeEntry('e1', stored({ confidence: undefined, aiComment: undefined, model: undefined }));
    const doc = toEntryDoc(entry);
    expect(doc['id']).toBeUndefined();
    expect(Object.values(doc).every((v) => v !== undefined)).toBeTrue();
    expect('confidence' in doc).toBeFalse();
    expect('aiComment' in doc).toBeFalse();
    expect(doc['hasPhoto']).toBeTrue();
    expect(doc['date']).toBe('2026-10-11');
  });

  it('round-trips through the document format', () => {
    const entry = normalizeEntry('e1', stored());
    const again = normalizeEntry('e1', toEntryDoc(entry));
    expect(again).toEqual(entry);
  });
});
