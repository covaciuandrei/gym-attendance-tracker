import { DiaryEntry, Macros } from '../models';
import { sumMacros } from './nutrition';

export const dayTotals = (entries: DiaryEntry[]): Macros => sumMacros(entries.map((e) => e.totals));

/** Groups entries by day and sums each day. */
export function totalsByDate(entries: DiaryEntry[]): Map<string, Macros> {
  const groups = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.date);
    if (list) list.push(entry);
    else groups.set(entry.date, [entry]);
  }
  return new Map([...groups].map(([date, list]) => [date, dayTotals(list)]));
}
