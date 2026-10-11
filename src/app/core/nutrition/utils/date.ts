/** Local-calendar helpers. Days are identified by `YYYY-MM-DD` strings in the user's timezone. */

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function nowTime(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isDateKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseDateKey(value);
  return toDateKey(d) === value;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Inclusive list of day keys between two keys. */
export function daysBetween(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  for (let k = startKey; k <= endKey; k = addDays(k, 1)) out.push(k);
  return out;
}

export function monthKeyRange(year: number, month0: number): { start: string; end: string } {
  return { start: toDateKey(new Date(year, month0, 1)), end: toDateKey(new Date(year, month0 + 1, 0)) };
}

/** Monday-first weekday index (0 = Monday). */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Suggests a meal type from the clock. */
export function mealForTime(time: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const hour = Number(time.split(':')[0]);
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 17 && hour < 22) return 'dinner';
  return 'snack';
}
