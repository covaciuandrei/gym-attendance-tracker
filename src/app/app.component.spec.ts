import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { AppComponent } from './app.component';
import { NutritionAccessService } from './core/nutrition/services/nutrition-access.service';
import { AuthService } from './core/services/auth.service';
import { LanguageService } from './core/services/language.service';
import { ThemeService } from './core/services/theme.service';

describe('AppComponent', () => {
  let versionUpdates: Subject<{ type: string }>;
  let unrecoverable: Subject<{ type: string; reason: string }>;
  let checkForUpdate: jasmine.Spy;
  let swEnabled: boolean;

  const create = () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const reload = spyOn(fixture.componentInstance as unknown as { reload(): void }, 'reload');
    return { fixture, app: fixture.componentInstance, reload };
  };
  const comeBackToTheApp = (hidden: boolean) => {
    spyOnProperty(document, 'hidden', 'get').and.returnValue(hidden);
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(async () => {
    sessionStorage.clear();
    swEnabled = true;
    versionUpdates = new Subject();
    unrecoverable = new Subject();
    checkForUpdate = jasmine.createSpy('checkForUpdate').and.resolveTo(false);

    await TestBed.configureTestingModule({
      imports: [AppComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: SwUpdate,
          useValue: {
            get isEnabled() {
              return swEnabled;
            },
            versionUpdates,
            unrecoverable,
            checkForUpdate,
          },
        },
        { provide: AuthService, useValue: { currentUser$: new BehaviorSubject(null) } },
        { provide: ThemeService, useValue: {} },
        { provide: LanguageService, useValue: {} },
        { provide: NutritionAccessService, useValue: { canUse: () => false } },
      ],
    }).compileComponents();
  });

  afterEach(() => sessionStorage.clear());

  it('should create the app', () => {
    expect(create().app).toBeTruthy();
  });

  it(`should have the 'Gym Attendance Tracker' title`, () => {
    expect(create().app.title).toEqual('Gym Attendance Tracker');
  });

  describe('keeping an installed app up to date', () => {
    it('looks for a new version whenever the app comes back to the foreground', () => {
      create();

      comeBackToTheApp(false);

      expect(checkForUpdate).toHaveBeenCalledTimes(1);
    });

    it('does not look while the app goes to the background', () => {
      create();

      comeBackToTheApp(true);

      expect(checkForUpdate).not.toHaveBeenCalled();
    });

    it('stops looking once the app is gone', () => {
      const { fixture } = create();
      fixture.destroy();

      comeBackToTheApp(false);

      expect(checkForUpdate).not.toHaveBeenCalled();
    });

    it('does nothing without a service worker', () => {
      swEnabled = false;
      create();

      comeBackToTheApp(false);

      expect(checkForUpdate).not.toHaveBeenCalled();
    });

    it('reloads for a new version only when the user agrees', () => {
      const { reload } = create();
      const ask = spyOn(window, 'confirm').and.returnValues(false, true);

      versionUpdates.next({ type: 'VERSION_READY' });
      expect(reload).not.toHaveBeenCalled();

      versionUpdates.next({ type: 'VERSION_READY' });
      expect(ask).toHaveBeenCalledTimes(2);
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('ignores service worker events that are not a ready version', () => {
      const { reload } = create();
      const ask = spyOn(window, 'confirm');

      versionUpdates.next({ type: 'VERSION_DETECTED' });

      expect(ask).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    });

    it('reloads once when the cached files no longer match the server, never in a loop', () => {
      const { reload } = create();

      unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' });
      unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' });

      expect(reload).toHaveBeenCalledTimes(1);
    });
  });
});
