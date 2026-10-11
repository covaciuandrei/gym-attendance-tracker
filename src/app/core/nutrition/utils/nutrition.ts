import { ActivityLevel, FoodItem, Macros, Profile } from '../models';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** About 7700 kcal per kg of body weight change. */
const KCAL_PER_KG = 7700;

export const emptyMacros = (): Macros => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 });

const round1 = (n: number) => Math.round(n * 10) / 10;

export function sumMacros(list: Macros[]): Macros {
  const total = list.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
      fiber: acc.fiber + m.fiber,
      sugar: acc.sugar + m.sugar,
    }),
    emptyMacros(),
  );
  return {
    kcal: Math.round(total.kcal),
    protein: round1(total.protein),
    carbs: round1(total.carbs),
    fat: round1(total.fat),
    fiber: round1(total.fiber),
    sugar: round1(total.sugar),
  };
}

export const itemsTotals = (items: FoodItem[]): Macros => sumMacros(items);

/** Changes the portion of an item and scales its nutrients proportionally. */
export function scaleItem(item: FoodItem, grams: number): FoodItem {
  const next = Math.max(0, Number.isFinite(grams) ? grams : 0);
  if (!(item.grams > 0)) return { ...item, grams: next };
  const f = next / item.grams;
  return {
    ...item,
    grams: next,
    kcal: Math.round(item.kcal * f),
    protein: round1(item.protein * f),
    carbs: round1(item.carbs * f),
    fat: round1(item.fat * f),
    fiber: round1(item.fiber * f),
    sugar: round1(item.sugar * f),
  };
}

export function blankItem(): FoodItem {
  return { name: '', grams: 100, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
}

export const leanMassKg = (weightKg: number, bodyFatPct: number) => weightKg * (1 - bodyFatPct / 100);

export function bmrMifflin(sex: 'male' | 'female', weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function bmrKatchMcArdle(leanKg: number): number {
  return 370 + 21.6 * leanKg;
}

export interface EnergyPlan {
  bmr: number;
  bmrMethod: 'katch' | 'mifflin';
  /** BMR by the other formula, when it can be computed too (for comparison). */
  altBmr: number | null;
  /** Maintenance calories (TDEE). */
  maintenance: number;
  /** Daily calorie target (goal-adjusted or custom). */
  target: number;
  deltaKcal: number;
  protein: number;
  carbs: number;
  fat: number;
  belowSafeMinimum: boolean;
}

const hasNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function validBodyFat(v: number | null | undefined): v is number {
  return hasNum(v) && v >= 3 && v <= 60;
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Lowest calculated target; anything below the sex-specific safe minimum is flagged in the UI. */
const MIN_TARGET_KCAL = 800;

export function computePlan(p: Profile): EnergyPlan | null {
  const canKatch = hasNum(p.weightKg) && validBodyFat(p.bodyFatPct);
  const canMifflin = hasNum(p.weightKg) && hasNum(p.heightCm) && hasNum(p.age) && p.sex !== null;
  if (!canKatch && !canMifflin) return null;

  const weight = p.weightKg as number;
  const katch = canKatch ? bmrKatchMcArdle(leanMassKg(weight, p.bodyFatPct as number)) : null;
  const mifflin = canMifflin ? bmrMifflin(p.sex as 'male' | 'female', weight, p.heightCm as number, p.age as number) : null;

  const bmr = (katch ?? mifflin) as number;
  const bmrMethod = katch !== null ? 'katch' : 'mifflin';
  const altBmr = katch !== null ? mifflin : null;

  const maintenance = Math.round(bmr * ACTIVITY_FACTORS[p.activity]);
  const deltaKcal = Math.round((p.weeklyChangeKg * KCAL_PER_KG) / 7);
  const custom = hasNum(p.customTargetKcal) ? Math.round(p.customTargetKcal) : null;
  const target = custom ?? Math.max(MIN_TARGET_KCAL, roundTo(maintenance + deltaKcal, 10));

  // Protein is anchored to lean mass when body fat is known, otherwise to body weight.
  const lean = validBodyFat(p.bodyFatPct) ? leanMassKg(weight, p.bodyFatPct) : null;
  const rawProtein = lean !== null ? lean * 2.4 : weight * 1.8;
  const protein = roundTo(Math.min(Math.max(rawProtein, (target * 0.2) / 4), (target * 0.4) / 4), 5);
  const fat = roundTo((target * 0.27) / 9, 5);
  const carbs = Math.max(0, roundTo((target - protein * 4 - fat * 9) / 4, 5));

  const minimum = p.sex === 'female' ? 1200 : 1500;
  return {
    bmr: Math.round(bmr),
    bmrMethod,
    altBmr: altBmr === null ? null : Math.round(altBmr),
    maintenance,
    target,
    deltaKcal: custom !== null ? custom - maintenance : deltaKcal,
    protein,
    carbs,
    fat,
    belowSafeMinimum: target < minimum,
  };
}

export type Level = 'none' | 'pending' | 'under' | 'ok' | 'over';

/**
 * Classifies a day against the calorie target: under < 85 %, on target up to 110 %, over above.
 * Today is still in progress, so it only turns red once the target is exceeded.
 */
export function dayLevel(kcal: number, target: number | null, hasEntries: boolean, isToday = false): Level {
  if (!hasEntries) return 'none';
  if (target === null || target <= 0) return 'ok';
  const ratio = kcal / target;
  if (ratio > 1.1) return 'over';
  if (isToday) return 'pending';
  return ratio < 0.85 ? 'under' : 'ok';
}
