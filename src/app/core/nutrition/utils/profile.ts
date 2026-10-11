import { ActivityLevel, Profile } from '../models';
import { validBodyFat } from './nutrition';

export const DEFAULT_PROFILE: Profile = {
  sex: null,
  age: null,
  heightCm: null,
  weightKg: null,
  bodyFatPct: null,
  activity: 'light',
  weeklyChangeKg: 0,
  customTargetKcal: null,
};

const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

function inRange(value: unknown, min: number, max: number, decimals = 0): number | null {
  const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Turns whatever was stored or typed into a profile with only plausible values. */
export function sanitizeProfile(raw: Partial<Profile> | null | undefined): Profile {
  const p = raw ?? {};
  const rate = typeof p.weeklyChangeKg === 'number' && Number.isFinite(p.weeklyChangeKg) ? p.weeklyChangeKg : 0;
  const bodyFat = inRange(p.bodyFatPct, 3, 60, 1);
  return {
    sex: p.sex === 'male' || p.sex === 'female' ? p.sex : null,
    age: inRange(p.age, 10, 100),
    heightCm: inRange(p.heightCm, 100, 250),
    weightKg: inRange(p.weightKg, 30, 300, 1),
    bodyFatPct: validBodyFat(bodyFat) ? bodyFat : null,
    activity: ACTIVITIES.includes(p.activity as ActivityLevel) ? (p.activity as ActivityLevel) : 'light',
    weeklyChangeKg: Math.min(1, Math.max(-1, Math.round(rate * 100) / 100)),
    customTargetKcal: inRange(p.customTargetKcal, 800, 8000),
  };
}

/** True when both profiles hold exactly the same values. */
export function sameProfile(a: Profile, b: Profile): boolean {
  return (Object.keys(a) as (keyof Profile)[]).every((key) => a[key] === b[key]);
}
