import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NutritionAccessService } from '../nutrition/services/nutrition-access.service';

/**
 * Keeps accounts that the admin has not switched on out of the food tracker. Signed-out visitors are left to authGuard
 * (it runs next to this one and sends them to the login page), so this guard just says no for them.
 *
 * inject() only works before the first await, so everything is injected up front.
 */
export const nutritionGuard: CanActivateFn = async () => {
  const access = inject(NutritionAccessService);
  const auth = inject(AuthService);
  const router = inject(Router);

  if (await access.whenReady()) return true;
  return auth.currentUser ? router.createUrlTree(['/calendar']) : false;
};

/** Only the admin account may open the access settings. */
export const adminGuard: CanActivateFn = async () => {
  const access = inject(NutritionAccessService);
  const auth = inject(AuthService);
  const router = inject(Router);

  if (await access.refreshClaims()) return true;
  return auth.currentUser ? router.createUrlTree(['/settings']) : false;
};
