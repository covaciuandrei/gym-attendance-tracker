import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { AiError, NutritionAiService } from '../../../core/nutrition/services/nutrition-ai.service';
import { NutritionDataService } from '../../../core/nutrition/services/nutrition-data.service';
import { LanguageService } from '../../../core/services/language.service';
import { EntryEditorComponent } from './entry-editor.component';

@Component({ standalone: true, template: '' })
class DayPageComponent {}

describe('EntryEditorComponent', () => {
  let harness: RouterTestingHarness;
  let page: HTMLElement;
  let saveEntry: jasmine.Spy;
  let analyze: jasmine.Spy;

  const settle = async () => {
    await harness.fixture.whenStable();
    harness.detectChanges();
  };
  const type = async (selector: string, text: string) => {
    const field = page.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    field.value = text;
    field.dispatchEvent(new Event('input'));
    await settle();
  };
  const click = async (selector: string) => {
    page.querySelector<HTMLButtonElement>(selector)!.click();
    await settle();
  };
  const addItemNamed = async (name: string) => {
    await click('button.add-item');
    await type('.item-card input[type="text"]', name);
  };
  const errorText = () => page.querySelector('.error-box')?.textContent?.trim() ?? null;

  beforeEach(async () => {
    spyOn(console, 'error');
    saveEntry = jasmine.createSpy('saveEntry').and.resolveTo(undefined);
    analyze = jasmine.createSpy('analyze');

    await TestBed.configureTestingModule({
      imports: [EntryEditorComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([
          { path: 'nutrition/day/:date/entry/:id', component: EntryEditorComponent },
          { path: 'nutrition/day/:date', component: DayPageComponent },
        ]),
        { provide: NutritionDataService, useValue: { saveEntry, getEntry: async () => undefined, getPhoto: async () => null } },
        { provide: NutritionAiService, useValue: { analyze } },
        { provide: LanguageService, useValue: { currentLang: signal('en') } },
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/nutrition/day/2026-10-12/entry/new', EntryEditorComponent);
    page = harness.routeNativeElement!;
    await settle();
  });

  describe('saving', () => {
    it('saves the meal and goes back to the day', async () => {
      await addItemNamed('Apple');

      await click('.actions button');

      expect(saveEntry).toHaveBeenCalledTimes(1);
      const entry = saveEntry.calls.mostRecent().args[0];
      expect(entry.date).toBe('2026-10-12');
      expect(entry.items.map((item: { name: string }) => item.name)).toEqual(['Apple']);
      expect(TestBed.inject(Router).url).toBe('/nutrition/day/2026-10-12');
    });

    it('asks for an item or an estimate first', async () => {
      await click('.actions button');

      expect(saveEntry).not.toHaveBeenCalled();
      expect(errorText()).toBe('NUTRITION.ENTRY.NEED_ITEMS');
    });

    it('says why the meal could not be saved, and stays on the page', async () => {
      saveEntry.and.rejectWith(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }));
      await addItemNamed('Apple');

      await click('.actions button');

      expect(errorText()).toBe('NUTRITION.ENTRY.SAVE_FAILED (permission-denied)');
      expect(TestBed.inject(Router).url).toContain('/entry/new');
    });
  });

  describe('the AI estimate', () => {
    beforeEach(async () => {
      await type('#note', 'iaurt 200g');
    });

    it('shows the technical reason when the service is unavailable', async () => {
      analyze.and.rejectWith(new AiError('unavailable', 'HTTP 500'));

      await click('button.estimate-btn');

      expect(errorText()).toBe('NUTRITION.ERRORS.UNAVAILABLE (HTTP 500)');
    });

    it('adds nothing when the message already explains the problem', async () => {
      analyze.and.rejectWith(new AiError('forbidden', 'HTTP 403'));

      await click('button.estimate-btn');

      expect(errorText()).toBe('NUTRITION.ERRORS.FORBIDDEN');
    });

    it('logs an unexpected failure and shows its reason instead of hiding it', async () => {
      analyze.and.rejectWith(new TypeError('boom'));

      await click('button.estimate-btn');

      expect(errorText()).toBe('NUTRITION.ERRORS.UNKNOWN (boom)');
      expect(console.error).toHaveBeenCalled();
    });
  });

  it('says why a photo could not be read', async () => {
    const input = page.querySelector<HTMLInputElement>('input[capture]')!;
    const files = new DataTransfer();
    files.items.add(new File(['this is not an image'], 'meal.jpg', { type: 'image/jpeg' }));
    input.files = files.files;
    input.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve, 200));
    await settle();

    expect(errorText()).toMatch(/^NUTRITION\.ENTRY\.PHOTO_FAILED \(.+\)$/);
  });
});
