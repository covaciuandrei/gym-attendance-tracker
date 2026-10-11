import { DiaryEntry } from '../models';
import { dayTotals, totalsByDate } from './diary';

describe('diary helpers', () => {
  const meal = (date: string, kcal: number, protein: number): DiaryEntry =>
    ({ date, totals: { kcal, protein, carbs: 0, fat: 0, fiber: 0, sugar: 0 } }) as DiaryEntry;

  it('sums a day', () => {
    expect(dayTotals([meal('2026-10-11', 300, 10), meal('2026-10-11', 450.4, 22.5)])).toEqual({ kcal: 750, protein: 32.5, carbs: 0, fat: 0, fiber: 0, sugar: 0 });
    expect(dayTotals([]).kcal).toBe(0);
  });

  it('groups entries by date', () => {
    const totals = totalsByDate([meal('2026-10-11', 300, 10), meal('2026-10-12', 100, 1), meal('2026-10-11', 200, 5)]);
    expect([...totals.keys()]).toEqual(['2026-10-11', '2026-10-12']);
    expect(totals.get('2026-10-11')!.kcal).toBe(500);
    expect(totals.get('2026-10-12')!.protein).toBe(1);
  });
});
