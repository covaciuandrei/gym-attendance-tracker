import { WritableSignal, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Profile } from '../../../core/nutrition/models';
import { NutritionProfileService } from '../../../core/nutrition/services/nutrition-profile.service';
import { computePlan } from '../../../core/nutrition/utils/nutrition';
import { DEFAULT_PROFILE } from '../../../core/nutrition/utils/profile';
import { LanguageService } from '../../../core/services/language.service';
import { NutritionGoalsComponent } from './nutrition-goals.component';

describe('NutritionGoalsComponent', () => {
  let fixture: ComponentFixture<NutritionGoalsComponent>;
  let root: HTMLElement;
  let profile: WritableSignal<Profile>;
  let update: jasmine.Spy;
  let flush: jasmine.Spy;

  beforeEach(async () => {
    profile = signal<Profile>({ ...DEFAULT_PROFILE, sex: 'male', age: 30, heightCm: 180, weightKg: 80 });
    update = jasmine.createSpy('update');
    flush = jasmine.createSpy('flush').and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [NutritionGoalsComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: NutritionProfileService, useValue: { profile, plan: computed(() => computePlan(profile())), update, flush } },
        { provide: LanguageService, useValue: { currentLang: signal('en') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NutritionGoalsComponent);
    root = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('shows the profile form and the calculated plan', () => {
    expect(root.querySelector('#age')).not.toBeNull();
    expect(root.querySelector('.plan-card')).not.toBeNull();
  });

  it('offers no way to export, import or delete the nutrition data', () => {
    expect(root.querySelector('input[type="file"]')).toBeNull();
    expect(root.querySelector('input[type="checkbox"]')).toBeNull();
    // The only buttons left are the two sex toggles.
    const labels = Array.from(root.querySelectorAll('button')).map((button) => button.textContent?.trim());
    expect(labels).toEqual(['NUTRITION.GOALS.MALE', 'NUTRITION.GOALS.FEMALE']);
  });

  it('passes what the user types on to the profile service', () => {
    const age = root.querySelector<HTMLInputElement>('#age')!;
    age.value = '31';
    age.dispatchEvent(new Event('input'));

    expect(update).toHaveBeenCalledWith(jasmine.objectContaining({ age: 31 }));
  });

  it('saves a pending profile edit when the user leaves the page', () => {
    fixture.destroy();

    expect(flush).toHaveBeenCalled();
  });
});
