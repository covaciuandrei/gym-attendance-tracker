import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { Profile } from '../models';
import { DEFAULT_PROFILE } from '../utils/profile';
import { NutritionDataService } from './nutrition-data.service';
import { NutritionProfileService } from './nutrition-profile.service';

const CACHE_KEY = 'nt.profile.u1';
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('NutritionProfileService', () => {
  let data: { loadProfile: jasmine.Spy; saveProfile: jasmine.Spy };
  let user: BehaviorSubject<{ uid: string } | null>;

  beforeEach(() => {
    localStorage.removeItem(CACHE_KEY);
    spyOn(console, 'warn');
    data = {
      loadProfile: jasmine.createSpy('loadProfile').and.resolveTo(null),
      saveProfile: jasmine.createSpy('saveProfile').and.resolveTo(),
    };
    user = new BehaviorSubject<{ uid: string } | null>({ uid: 'u1' });
    TestBed.configureTestingModule({
      providers: [
        { provide: NutritionDataService, useValue: data },
        { provide: AuthService, useValue: { currentUser$: user } },
      ],
    });
  });

  afterEach(() => localStorage.removeItem(CACHE_KEY));

  it('takes the profile from the account once it arrives', async () => {
    data.loadProfile.and.resolveTo({ age: 40 });
    const service = TestBed.inject(NutritionProfileService);
    expect(service.loaded()).toBeFalse();

    await nextTask();

    expect(service.profile().age).toBe(40);
    expect(service.loaded()).toBeTrue();
  });

  describe('save', () => {
    it('writes the cleaned-up profile, then makes it the one the app uses', async () => {
      const service = TestBed.inject(NutritionProfileService);
      await nextTask();

      const saved = await service.save({ ...DEFAULT_PROFILE, age: 31, weightKg: 72.04 });

      expect(saved).toBeTrue();
      expect(data.saveProfile).toHaveBeenCalledOnceWith(jasmine.objectContaining({ age: 31, weightKg: 72 }));
      expect(service.profile().age).toBe(31);
      expect(service.profile().weightKg).toBe(72);
      expect(JSON.parse(localStorage.getItem(CACHE_KEY)!).age).toBe(31);
    });

    it('keeps the profile as it was when the write fails', async () => {
      data.saveProfile.and.rejectWith(new Error('permission-denied'));
      const service = TestBed.inject(NutritionProfileService);
      await nextTask();

      const saved = await service.save({ ...DEFAULT_PROFILE, age: 31 });

      expect(saved).toBeFalse();
      expect(service.profile().age).toBeNull();
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    });

    it('writes nothing when nobody is signed in', async () => {
      user.next(null);
      const service = TestBed.inject(NutritionProfileService);

      expect(await service.save({ ...DEFAULT_PROFILE, age: 31 })).toBeFalse();
      expect(data.saveProfile).not.toHaveBeenCalled();
    });

    it('is not undone by a slow read that started before it', async () => {
      let answer!: (remote: Partial<Profile> | null) => void;
      data.loadProfile.and.returnValue(new Promise((resolve) => (answer = resolve)));
      const service = TestBed.inject(NutritionProfileService);

      await service.save({ ...DEFAULT_PROFILE, age: 31 });
      answer({ age: 25 });
      await nextTask();

      expect(service.profile().age).toBe(31);
      expect(service.loaded()).toBeTrue();
    });
  });
});
