import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree, provideRouter } from '@angular/router';
import { NutritionAccessService } from '../nutrition/services/nutrition-access.service';
import { AuthService } from '../services/auth.service';
import { adminGuard, nutritionGuard } from './access.guard';

/** Runs a guard the way the router does: inside an injection context, with the result awaited. */
async function run(guard: typeof nutritionGuard, access: Partial<NutritionAccessService>, signedIn: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: NutritionAccessService, useValue: access },
      { provide: AuthService, useValue: { currentUser: signedIn ? { uid: 'u1' } : null } },
    ],
  });
  const result = await TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  return { result, router: TestBed.inject(Router) };
}

describe('nutritionGuard', () => {
  it('lets an account that is switched on in', async () => {
    const { result } = await run(nutritionGuard, { whenReady: async () => true }, true);
    expect(result).toBeTrue();
  });

  it('sends an account that is not switched on back to the calendar', async () => {
    const { result, router } = await run(nutritionGuard, { whenReady: async () => false }, true);
    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result as UrlTree)).toBe('/calendar');
  });

  it('leaves signed-out visitors to the auth guard', async () => {
    const { result } = await run(nutritionGuard, { whenReady: async () => false }, false);
    expect(result).toBeFalse();
  });
});

describe('adminGuard', () => {
  it('lets the admin in', async () => {
    const { result } = await run(adminGuard, { refreshClaims: async () => true }, true);
    expect(result).toBeTrue();
  });

  it('sends everybody else to Settings', async () => {
    const { result, router } = await run(adminGuard, { refreshClaims: async () => false }, true);
    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result as UrlTree)).toBe('/settings');
  });

  it('leaves signed-out visitors to the auth guard', async () => {
    const { result } = await run(adminGuard, { refreshClaims: async () => false }, false);
    expect(result).toBeFalse();
  });
});
