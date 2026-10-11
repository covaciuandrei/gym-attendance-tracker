import { TestBed } from '@angular/core/testing';
import { BackupError, NutritionBackupService } from './nutrition-backup.service';
import { NutritionDataService } from './nutrition-data.service';
import { NutritionProfileService } from './nutrition-profile.service';

describe('NutritionBackupService.import', () => {
  let service: NutritionBackupService;
  let importAll: jasmine.Spy;
  let replace: jasmine.Spy;

  const JPEG = 'data:image/jpeg;base64,AAAA';
  const entry = (patch: Record<string, unknown> = {}) => ({
    id: 'e1',
    date: '2026-10-11',
    time: '08:30',
    meal: 'breakfast',
    name: 'Oats',
    note: '',
    items: [{ name: 'Oats', grams: 80, kcal: 300, protein: 10, carbs: 50, fat: 6, fiber: 8, sugar: 1 }],
    totals: { kcal: 99999 },
    source: 'ai',
    createdAt: 1,
    updatedAt: 2,
    ...patch,
  });
  const file = (entries: unknown[], weights: unknown[] = [], extra: Record<string, unknown> = {}) =>
    JSON.stringify({ format: 'calorie-tracker-backup', version: 1, entries, weights, ...extra });

  beforeEach(() => {
    importAll = jasmine.createSpy('importAll').and.resolveTo();
    replace = jasmine.createSpy('replace').and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        { provide: NutritionDataService, useValue: { importAll } },
        { provide: NutritionProfileService, useValue: { replace, profile: () => ({}) } },
      ],
    });
    service = TestBed.inject(NutritionBackupService);
  });

  it('imports valid entries and weights in one write, recomputing totals', async () => {
    const result = await service.import(file([entry(), entry({ id: 'e2' })], [{ date: '2026-10-10', kg: 80.44 }]));
    expect(result).toEqual({ entries: 2, weights: 1 });
    expect(importAll).toHaveBeenCalledTimes(1);
    const [entries, , weights] = importAll.calls.mostRecent().args;
    expect(entries.length).toBe(2);
    expect(entries[0].totals.kcal).toBe(300);
    expect(weights).toEqual([{ date: '2026-10-10', kg: 80.4 }]);
  });

  it('carries photos along, but only valid and reasonably small ones', async () => {
    await service.import(
      file([entry({ photo: JPEG }), entry({ id: 'e2', photo: 'javascript:alert(1)' }), entry({ id: 'e3', photo: `data:image/jpeg;base64,${'A'.repeat(800_000)}` })]),
    );
    const photos: Map<string, string> = importAll.calls.mostRecent().args[1];
    expect([...photos.keys()]).toEqual(['e1']);
    expect(photos.get('e1')).toBe(JPEG);
  });

  it('rejects the whole file when an entry is invalid and writes nothing', async () => {
    for (const bad of [entry({ date: '2026-02-30' }), entry({ date: '11/10/2026' }), entry({ id: '' }), entry({ items: 'nope' }), null, 'text']) {
      importAll.calls.reset();
      await expectAsync(service.import(file([entry({ id: 'good' }), bad]))).toBeRejectedWithError(BackupError);
      expect(importAll).not.toHaveBeenCalled();
    }
  });

  it('rejects invalid weights, wrong formats and broken JSON', async () => {
    await expectAsync(service.import(file([], [{ date: '2026-10-10', kg: 5 }]))).toBeRejectedWithError(BackupError);
    await expectAsync(service.import(file([], [{ date: 'x', kg: 80 }]))).toBeRejectedWithError(BackupError);
    await expectAsync(service.import(JSON.stringify({ format: 'other', entries: [], weights: [] }))).toBeRejectedWithError(BackupError);
    await expectAsync(service.import('{not json')).toBeRejectedWithError(BackupError);
    expect(importAll).not.toHaveBeenCalled();
  });

  it('restores the profile from the backup after the data was written', async () => {
    await service.import(file([entry()], [], { profile: { sex: 'male', age: 28 } }));
    expect(replace).toHaveBeenCalledOnceWith({ sex: 'male', age: 28 });
    importAll.calls.reset();
    replace.calls.reset();
    await service.import(file([entry()]));
    expect(replace).not.toHaveBeenCalled();
  });
});
