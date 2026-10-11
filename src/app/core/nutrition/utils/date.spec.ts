import { addDays, daysBetween, isDateKey, mealForTime, mondayIndex, monthKeyRange, parseDateKey, toDateKey } from './date';

describe('date helpers', () => {
  it('formats and parses local day keys', () => {
    expect(toDateKey(new Date(2026, 9, 5))).toBe('2026-10-05');
    expect(toDateKey(parseDateKey('2026-02-28'))).toBe('2026-02-28');
  });

  it('validates day keys, including impossible dates', () => {
    expect(isDateKey('2026-10-11')).toBeTrue();
    expect(isDateKey('2026-02-30')).toBeFalse();
    expect(isDateKey('2026-13-01')).toBeFalse();
    expect(isDateKey('11-10-2026')).toBeFalse();
    expect(isDateKey(null)).toBeFalse();
    expect(isDateKey('')).toBeFalse();
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
  });

  it('lists inclusive day ranges', () => {
    expect(daysBetween('2026-10-09', '2026-10-11')).toEqual(['2026-10-09', '2026-10-10', '2026-10-11']);
    expect(daysBetween('2026-10-11', '2026-10-11')).toEqual(['2026-10-11']);
  });

  it('computes month ranges', () => {
    expect(monthKeyRange(2026, 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthKeyRange(2028, 1).end).toBe('2028-02-29');
  });

  it('uses Monday as the first weekday', () => {
    expect(mondayIndex(new Date(2026, 9, 5))).toBe(0); // Monday
    expect(mondayIndex(new Date(2026, 9, 11))).toBe(6); // Sunday
  });

  it('suggests a meal from the time of day', () => {
    expect(mealForTime('07:30')).toBe('breakfast');
    expect(mealForTime('12:00')).toBe('lunch');
    expect(mealForTime('19:45')).toBe('dinner');
    expect(mealForTime('15:30')).toBe('snack');
    expect(mealForTime('02:10')).toBe('snack');
  });
});
