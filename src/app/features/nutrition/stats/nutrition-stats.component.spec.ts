import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { DiaryEntry } from '../../../core/nutrition/models';
import { ClockService } from '../../../core/nutrition/services/clock.service';
import { NutritionDataService } from '../../../core/nutrition/services/nutrition-data.service';
import { NutritionProfileService } from '../../../core/nutrition/services/nutrition-profile.service';
import { LanguageService } from '../../../core/services/language.service';
import { NutritionStatsComponent } from './nutrition-stats.component';

const meal = (date: string, kcal: number, protein: number): DiaryEntry => ({
  id: `${date}-meal`,
  date,
  time: '12:00',
  meal: 'lunch',
  name: 'Lunch',
  note: '',
  items: [],
  totals: { kcal, protein, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
  hasPhoto: false,
  source: 'manual',
  createdAt: 0,
  updatedAt: 0,
});

describe('NutritionStatsComponent', () => {
  let fixture: ComponentFixture<NutritionStatsComponent>;
  let root: HTMLElement;

  beforeEach(async () => {
    const data = { getRange: jasmine.createSpy('getRange').and.resolveTo([meal('2026-10-10', 1800, 120), meal('2026-10-11', 2200, 140)]) };

    await TestBed.configureTestingModule({
      imports: [NutritionStatsComponent, TranslateModule.forRoot()],
      providers: [
        { provide: NutritionDataService, useValue: data },
        { provide: NutritionProfileService, useValue: { targetKcal: signal(2200) } },
        { provide: ClockService, useValue: { today: signal('2026-10-11'), refresh: () => undefined, dayChange: new Subject<string>() } },
        { provide: LanguageService, useValue: { currentLang: signal('en') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NutritionStatsComponent);
    root = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows the averages and a bar for every day of the range', () => {
    expect(root.querySelector('.stat-card.primary .stat-value')?.textContent?.trim()).toBe('2000');
    expect(root.querySelector('.stat-card.secondary .stat-value')?.textContent?.trim()).toBe('130');
    expect(root.querySelector('.stat-card.tertiary .stat-value')?.textContent?.replace(/\s/g, '')).toBe('2/7');
    expect(root.querySelectorAll('.chart-bar').length).toBe(7);
    expect(root.querySelector('.split-bar')).not.toBeNull();
  });

  it('has no weight tracker: no weight form and no weight chart', () => {
    expect(root.querySelector('input')).toBeNull();
    expect(root.querySelector('svg')).toBeNull();
  });
});
