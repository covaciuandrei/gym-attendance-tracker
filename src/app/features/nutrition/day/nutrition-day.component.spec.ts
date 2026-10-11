import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DiaryEntry } from '../../../core/nutrition/models';
import { NutritionDataService } from '../../../core/nutrition/services/nutrition-data.service';
import { NutritionProfileService } from '../../../core/nutrition/services/nutrition-profile.service';
import { LanguageService } from '../../../core/services/language.service';
import { NutritionDayComponent } from './nutrition-day.component';

const meal = (date: string, name: string): DiaryEntry => ({
  id: `${date}-${name}`,
  date,
  time: '12:00',
  meal: 'lunch',
  name,
  note: '',
  items: [],
  totals: { kcal: 300, protein: 20, carbs: 30, fat: 10, fiber: 0, sugar: 0 },
  hasPhoto: false,
  source: 'manual',
  createdAt: 0,
  updatedAt: 0,
});

describe('NutritionDayComponent', () => {
  let harness: RouterTestingHarness;
  let page: HTMLElement;
  let getDay: jasmine.Spy;

  const settle = async () => {
    await harness.fixture.whenStable();
    harness.detectChanges();
  };
  const entryNames = () => Array.from(page.querySelectorAll('.entry-name')).map((el) => el.textContent?.trim());

  beforeEach(async () => {
    spyOn(console, 'error');
    getDay = jasmine.createSpy('getDay').and.callFake(async (date: string) => [meal(date, `Lunch on ${date}`)]);

    await TestBed.configureTestingModule({
      imports: [NutritionDayComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([{ path: 'day/:date', component: NutritionDayComponent }]),
        { provide: NutritionDataService, useValue: { getDay, recentMeals: async () => [], getPhoto: async () => null } },
        { provide: NutritionProfileService, useValue: { targetKcal: signal(2200), plan: signal(null) } },
        { provide: LanguageService, useValue: { currentLang: signal('en') } },
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/day/2026-10-12', NutritionDayComponent);
    page = harness.routeNativeElement!;
    await settle();
  });

  it('lists the meals of the day', () => {
    expect(entryNames()).toEqual(['Lunch on 2026-10-12']);
    expect(page.querySelector('.summary-card')!.textContent).toContain('300');
    expect(page.querySelector('.load-error')).toBeNull();
  });

  describe('when the meals cannot be read', () => {
    beforeEach(async () => {
      getDay.and.rejectWith(new Error('unavailable'));
      await harness.navigateByUrl('/day/2026-10-13', NutritionDayComponent);
      await settle();
      page = harness.routeNativeElement!;
    });

    it('says so instead of showing an empty day', () => {
      expect(page.querySelector('.load-error')).not.toBeNull();
      expect(page.querySelector('.empty')).toBeNull();
    });

    it('does not keep the totals of the day it came from', () => {
      expect(entryNames()).toEqual([]);
      expect(page.querySelector('.summary-card')!.textContent).not.toContain('300');
    });

    it('shows the meals once trying again works', async () => {
      getDay.and.callFake(async (date: string) => [meal(date, 'Dinner')]);

      page.querySelector<HTMLButtonElement>('.load-error button')!.click();
      await settle();

      expect(page.querySelector('.load-error')).toBeNull();
      expect(entryNames()).toEqual(['Dinner']);
    });
  });
});
