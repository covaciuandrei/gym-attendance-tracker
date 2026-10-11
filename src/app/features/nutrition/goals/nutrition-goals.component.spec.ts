import { Component, WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { unsavedChangesGuard } from '../../../core/guards/unsaved-changes.guard';
import { Profile } from '../../../core/nutrition/models';
import { NutritionProfileService } from '../../../core/nutrition/services/nutrition-profile.service';
import { ToastService } from '../../../core/nutrition/services/toast.service';
import { DEFAULT_PROFILE } from '../../../core/nutrition/utils/profile';
import { LanguageService } from '../../../core/services/language.service';
import { NutritionGoalsComponent } from './nutrition-goals.component';

@Component({ standalone: true, template: '' })
class OtherPageComponent {}

describe('NutritionGoalsComponent', () => {
  let harness: RouterTestingHarness;
  let page: HTMLElement;
  let profile: WritableSignal<Profile>;
  let save: jasmine.Spy;

  const settle = async () => {
    await harness.fixture.whenStable();
    harness.detectChanges();
  };
  const type = (id: string, text: string) => {
    const input = page.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
  };
  const saveButton = () => page.querySelector<HTMLButtonElement>('.actions button')!;
  const target = () => page.querySelector('.plan-stat.accent .plan-value')?.textContent?.trim();

  beforeEach(async () => {
    profile = signal<Profile>({ ...DEFAULT_PROFILE, sex: 'male', age: 30, heightCm: 180, weightKg: 80 });
    save = jasmine.createSpy('save').and.callFake(async (next: Profile) => {
      profile.set(next);
      return true;
    });

    await TestBed.configureTestingModule({
      imports: [NutritionGoalsComponent, TranslateModule.forRoot()],
      providers: [
        // The same guard the real route uses.
        provideRouter([
          { path: 'goals', component: NutritionGoalsComponent, canDeactivate: [unsavedChangesGuard] },
          { path: 'calendar', component: OtherPageComponent },
        ]),
        { provide: NutritionProfileService, useValue: { profile, save } },
        { provide: LanguageService, useValue: { currentLang: signal('en') } },
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/goals', NutritionGoalsComponent);
    page = harness.routeNativeElement!;
  });

  it('shows the profile form and the calculated plan', () => {
    expect(page.querySelector('#age')).not.toBeNull();
    expect(page.querySelector('.plan-card')).not.toBeNull();
  });

  it('offers no way to export, import or delete the nutrition data', () => {
    expect(page.querySelector('input[type="file"]')).toBeNull();
    expect(page.querySelector('input[type="checkbox"]')).toBeNull();
    // The only buttons are the two sex toggles and Save.
    const labels = Array.from(page.querySelectorAll('button')).map((button) => button.textContent?.trim());
    expect(labels).toEqual(['NUTRITION.GOALS.MALE', 'NUTRITION.GOALS.FEMALE', 'NUTRITION.COMMON.SAVE']);
  });

  describe('saving', () => {
    it('keeps Save off until something is changed', () => {
      expect(saveButton().disabled).toBeTrue();

      type('age', '31');

      expect(saveButton().disabled).toBeFalse();
    });

    it('turns Save off again when a change is put back', () => {
      type('age', '31');
      type('age', '30');

      expect(saveButton().disabled).toBeTrue();
    });

    it('shows the new numbers while typing but saves nothing until Save is pressed', () => {
      const before = target();

      type('weight', '90');

      expect(target()).not.toBe(before);
      expect(save).not.toHaveBeenCalled();
      expect(profile().weightKg).toBe(80);
    });

    it('saves what was typed when Save is pressed, then confirms', async () => {
      type('age', '31');

      saveButton().click();
      await settle();

      expect(save).toHaveBeenCalledOnceWith(jasmine.objectContaining({ age: 31, weightKg: 80 }));
      expect(TestBed.inject(ToastService).message()).toBe('✓ NUTRITION.GOALS.SAVED');
      expect(saveButton().disabled).toBeTrue();
    });

    it('keeps the changes and lets the user try again when saving fails', async () => {
      save.and.resolveTo(false);
      type('age', '31');

      saveButton().click();
      await settle();

      expect(TestBed.inject(ToastService).message()).toBe('NUTRITION.ENTRY.SAVE_FAILED');
      expect(saveButton().disabled).toBeFalse();
      expect(page.querySelector<HTMLInputElement>('#age')!.value).toBe('31');
    });
  });

  describe('leaving the page', () => {
    const router = () => TestBed.inject(Router);

    it('asks first when something was changed, and stays if the user says no', async () => {
      const ask = spyOn(window, 'confirm').and.returnValue(false);
      type('age', '31');

      await harness.navigateByUrl('/calendar');

      expect(ask).toHaveBeenCalledTimes(1);
      expect(router().url).toBe('/goals');
    });

    it('leaves, dropping the changes, when the user agrees', async () => {
      spyOn(window, 'confirm').and.returnValue(true);
      type('age', '31');

      await harness.navigateByUrl('/calendar');

      expect(router().url).toBe('/calendar');
      expect(save).not.toHaveBeenCalled();
    });

    it('leaves without asking when nothing was changed', async () => {
      const ask = spyOn(window, 'confirm');

      await harness.navigateByUrl('/calendar');

      expect(ask).not.toHaveBeenCalled();
      expect(router().url).toBe('/calendar');
    });

    it('leaves without asking once the changes are saved', async () => {
      const ask = spyOn(window, 'confirm');
      type('age', '31');
      saveButton().click();
      await settle();

      await harness.navigateByUrl('/calendar');

      expect(ask).not.toHaveBeenCalled();
      expect(router().url).toBe('/calendar');
    });
  });
});
