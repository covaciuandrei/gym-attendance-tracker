import { Profile } from '../models';
import { ACTIVITY_FACTORS, blankItem, bmrKatchMcArdle, bmrMifflin, computePlan, dayLevel, itemsTotals, scaleItem, sumMacros } from './nutrition';

const profile = (patch: Partial<Profile> = {}): Profile => ({
  sex: 'male',
  age: 28,
  heightCm: 180,
  weightKg: 80,
  bodyFatPct: null,
  activity: 'moderate',
  weeklyChangeKg: 0,
  customTargetKcal: null,
  ...patch,
});

describe('nutrition', () => {
  describe('BMR formulas', () => {
    it('matches Mifflin-St Jeor for men and women', () => {
      expect(bmrMifflin('male', 80, 180, 28)).toBe(1790);
      expect(bmrMifflin('female', 60, 165, 30)).toBeCloseTo(1320.25, 2);
    });

    it('matches Katch-McArdle for 65.6 kg of lean mass', () => {
      expect(bmrKatchMcArdle(65.6)).toBeCloseTo(1786.96, 2);
    });
  });

  describe('computePlan', () => {
    it('needs enough data', () => {
      expect(computePlan(profile({ weightKg: null }))).toBeNull();
      expect(computePlan(profile({ sex: null }))).toBeNull();
      expect(computePlan(profile({ age: null, bodyFatPct: null }))).toBeNull();
    });

    it('uses Mifflin-St Jeor without body fat', () => {
      const plan = computePlan(profile())!;
      expect(plan.bmrMethod).toBe('mifflin');
      expect(plan.bmr).toBe(1790);
      expect(plan.maintenance).toBe(Math.round(1790 * ACTIVITY_FACTORS.moderate));
      expect(plan.altBmr).toBeNull();
      expect(plan.target).toBe(2780);
    });

    it('prefers Katch-McArdle when body fat is known and keeps the other BMR for comparison', () => {
      const plan = computePlan(profile({ bodyFatPct: 18 }))!;
      expect(plan.bmrMethod).toBe('katch');
      expect(plan.bmr).toBe(1787);
      expect(plan.altBmr).toBe(1790);
      expect(plan.maintenance).toBe(2770);
    });

    it('works with only weight and body fat', () => {
      const plan = computePlan(profile({ sex: null, age: null, heightCm: null, bodyFatPct: 20 }))!;
      expect(plan.bmrMethod).toBe('katch');
      expect(plan.altBmr).toBeNull();
    });

    it('ignores implausible body fat values', () => {
      expect(computePlan(profile({ bodyFatPct: 1 }))!.bmrMethod).toBe('mifflin');
      expect(computePlan(profile({ bodyFatPct: 80 }))!.bmrMethod).toBe('mifflin');
    });

    it('turns the weekly goal into a calorie delta (7700 kcal per kg)', () => {
      const cut = computePlan(profile({ bodyFatPct: 18, weeklyChangeKg: -0.5 }))!;
      expect(cut.deltaKcal).toBe(-550);
      expect(cut.target).toBe(2220);
      const bulk = computePlan(profile({ bodyFatPct: 18, weeklyChangeKg: 0.25 }))!;
      expect(bulk.deltaKcal).toBe(275);
      expect(bulk.target).toBe(3050);
    });

    it('lets a custom target override the goal', () => {
      const plan = computePlan(profile({ weeklyChangeKg: -1, customTargetKcal: 2000 }))!;
      expect(plan.target).toBe(2000);
      expect(plan.deltaKcal).toBe(2000 - plan.maintenance);
    });

    it('splits macros so they add up to the target', () => {
      const plan = computePlan(profile({ bodyFatPct: 18, weeklyChangeKg: -0.5 }))!;
      const kcal = plan.protein * 4 + plan.carbs * 4 + plan.fat * 9;
      expect(Math.abs(kcal - plan.target)).toBeLessThan(60);
      expect(plan.protein).toBe(155);
      expect(plan.fat).toBe(65);
    });

    it('anchors protein to body weight when body fat is unknown', () => {
      expect(computePlan(profile({ weeklyChangeKg: 0 }))!.protein).toBe(145);
    });

    it('flags targets below a safe minimum', () => {
      expect(computePlan(profile({ customTargetKcal: 1100 }))!.belowSafeMinimum).toBeTrue();
      expect(computePlan(profile({ sex: 'female', customTargetKcal: 1300 }))!.belowSafeMinimum).toBeFalse();
      expect(computePlan(profile({ sex: 'female', customTargetKcal: 1100 }))!.belowSafeMinimum).toBeTrue();
    });

    it('never produces a zero target for extreme profiles and flags it as unsafe', () => {
      const plan = computePlan(profile({ sex: 'female', age: 100, heightCm: 100, weightKg: 30, activity: 'sedentary', weeklyChangeKg: -1 }))!;
      expect(plan.target).toBe(800);
      expect(plan.belowSafeMinimum).toBeTrue();
      expect(plan.carbs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('items', () => {
    const rice = { name: 'Rice', grams: 200, kcal: 260, protein: 5.4, carbs: 57, fat: 0.6, fiber: 0.8, sugar: 0 };

    it('scales every nutrient with the portion', () => {
      const half = scaleItem(rice, 100);
      expect(half.kcal).toBe(130);
      expect(half.protein).toBe(2.7);
      expect(half.carbs).toBe(28.5);
      expect(half.grams).toBe(100);
    });

    it('does not compound rounding when scaling from the same base', () => {
      const viaSteps = scaleItem(scaleItem(rice, 2), 200);
      const direct = scaleItem(rice, 200);
      expect(direct).toEqual(rice);
      expect(viaSteps.kcal).not.toBe(direct.kcal);
    });

    it('handles zero and invalid portions', () => {
      expect(scaleItem(rice, 0).kcal).toBe(0);
      expect(scaleItem(rice, NaN).grams).toBe(0);
      expect(scaleItem(rice, -5).grams).toBe(0);
      expect(scaleItem(blankItem(), 150).grams).toBe(150);
    });

    it('sums macros', () => {
      const total = itemsTotals([rice, { ...rice, kcal: 100, protein: 10 }]);
      expect(total.kcal).toBe(360);
      expect(total.protein).toBe(15.4);
      expect(sumMacros([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 });
    });
  });

  describe('dayLevel', () => {
    it('classifies against the target', () => {
      expect(dayLevel(0, 2000, false)).toBe('none');
      expect(dayLevel(1600, 2000, true)).toBe('under');
      expect(dayLevel(1700, 2000, true)).toBe('ok');
      expect(dayLevel(2200, 2000, true)).toBe('ok');
      expect(dayLevel(2201, 2000, true)).toBe('over');
      expect(dayLevel(500, null, true)).toBe('ok');
    });

    it('keeps today pending until the target is exceeded', () => {
      expect(dayLevel(500, 2000, true, true)).toBe('pending');
      expect(dayLevel(2300, 2000, true, true)).toBe('over');
    });
  });
});
