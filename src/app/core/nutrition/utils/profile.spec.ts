import { sanitizeProfile } from './profile';

describe('sanitizeProfile', () => {
  it('keeps valid values', () => {
    const p = sanitizeProfile({ sex: 'female', age: 31, heightCm: 168, weightKg: 62.46, bodyFatPct: 24, activity: 'active', weeklyChangeKg: -0.5, customTargetKcal: 1900 });
    expect(p).toEqual({ sex: 'female', age: 31, heightCm: 168, weightKg: 62.5, bodyFatPct: 24, activity: 'active', weeklyChangeKg: -0.5, customTargetKcal: 1900 });
  });

  it('drops out-of-range or malformed numbers instead of storing garbage', () => {
    const p = sanitizeProfile({ age: 5, heightCm: 999, weightKg: Number.NaN, bodyFatPct: 90, customTargetKcal: 100 });
    expect(p.age).toBeNull();
    expect(p.heightCm).toBeNull();
    expect(p.weightKg).toBeNull();
    expect(p.bodyFatPct).toBeNull();
    expect(p.customTargetKcal).toBeNull();
  });

  it('accepts decimal commas typed on a phone keyboard', () => {
    expect(sanitizeProfile({ weightKg: '80,5' as unknown as number }).weightKg).toBe(80.5);
  });

  it('falls back to safe defaults', () => {
    const p = sanitizeProfile(null);
    expect(p.sex).toBeNull();
    expect(p.activity).toBe('light');
    expect(p.weeklyChangeKg).toBe(0);
    expect(sanitizeProfile({ activity: 'bogus' as never, sex: 'x' as never }).activity).toBe('light');
  });

  it('limits the weekly change to +-1 kg', () => {
    expect(sanitizeProfile({ weeklyChangeKg: -5 }).weeklyChangeKg).toBe(-1);
    expect(sanitizeProfile({ weeklyChangeKg: 3 }).weeklyChangeKg).toBe(1);
  });
});
