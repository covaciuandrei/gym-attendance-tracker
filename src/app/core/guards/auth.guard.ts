import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.authReady$.pipe(
    filter(ready => ready),
    take(1),
    map(() => {
      const user = authService.currentUser;
      
      if (user && user.emailVerified) {
        console.log('🛡️ Auth guard: Access granted');
        return true;
      } else if (user && !user.emailVerified) {
        console.log('🛡️ Auth guard: Email not verified, signing out and redirecting to login');
        // Sign out unverified user and redirect to login
        authService.signOutUser();
        router.navigate(['/login'], { 
          queryParams: { 
            returnUrl: state.url,
            message: 'verify-email'
          } 
        });
        return false;
      } else {
        console.log('🛡️ Auth guard: Not authenticated, redirecting to login');
        router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }
    })
  );
};

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.authReady$.pipe(
    filter(ready => ready),
    take(1),
    map(() => {
      const user = authService.currentUser;
      
      // Allow access if not authenticated OR if authenticated but email not verified
      if (!user || (user && !user.emailVerified)) {
        console.log('🛡️ Guest guard: Access granted');
        return true;
      } else {
        console.log('🛡️ Guest guard: Authenticated user, redirecting to calendar');
        router.navigate(['/calendar']);
        return false;
      }
    })
  );
};
