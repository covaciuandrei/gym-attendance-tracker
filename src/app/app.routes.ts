import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

// Auth pages (public)
import { AuthActionComponent } from './features/auth/auth-action/auth-action.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';

// Protected pages
import { CalendarComponent } from './features/calendar/calendar/calendar.component';
import { HealthComponent } from './features/health/health.component';
import { ProfileComponent } from './features/user/profile/profile.component';
import { SettingsComponent } from './features/user/settings/settings.component';
import { StatsComponent } from './features/workouts/stats/stats.component';
import { WorkoutTypesComponent } from './features/workouts/workout-types/workout-types.component';

export const routes: Routes = [
  // Public auth routes (redirect to app if logged in)
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent, canActivate: [guestGuard] },

  // Auth action handler (email verification, password reset - public)
  { path: 'auth/action', component: AuthActionComponent },

  // Protected routes (require authentication)
  { path: 'calendar', component: CalendarComponent, canActivate: [authGuard] },
  { path: 'stats', component: StatsComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'workout-types', component: WorkoutTypesComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'health', component: HealthComponent, canActivate: [authGuard] },

  // Default redirect
  { path: '', redirectTo: '/calendar', pathMatch: 'full' },

  // Catch-all redirect
  { path: '**', redirectTo: '/calendar' }
];
