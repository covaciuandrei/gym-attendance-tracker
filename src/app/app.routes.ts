import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

// Auth pages (public)
import { AuthActionComponent } from './components/auth-action/auth-action.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';

// Protected pages
import { CalendarComponent } from './components/calendar/calendar.component';
import { ProfileComponent } from './components/profile/profile.component';
import { SettingsComponent } from './components/settings/settings.component';
import { StatsComponent } from './components/stats/stats.component';
import { WorkoutTypesComponent } from './components/workout-types/workout-types.component';
import { HealthComponent } from './components/health/health.component';

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
