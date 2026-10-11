import { Routes } from '@angular/router';
import { adminGuard, nutritionGuard } from './core/guards/access.guard';
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
import { WorkoutTypesComponent } from './features/workouts/workout-types/workout-types.component';

// Stats sub-routes
import { AttendancesStatsComponent } from './features/workouts/stats/attendances/attendances-stats.component';
import { DurationStatsComponent } from './features/workouts/stats/duration/duration-stats.component';
import { HealthStatsComponent } from './features/workouts/stats/health/health-stats.component';
import { StatsShellComponent } from './features/workouts/stats/stats-shell/stats-shell.component';
import { WorkoutsStatsComponent } from './features/workouts/stats/workouts/workouts-stats.component';

export const routes: Routes = [
  // Public auth routes (redirect to app if logged in)
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent, canActivate: [guestGuard] },

  // Auth action handler (email verification, password reset - public)
  { path: 'auth/action', component: AuthActionComponent },

  // Protected routes (require authentication)
  { path: 'calendar', component: CalendarComponent, canActivate: [authGuard] },
  {
    path: 'stats',
    component: StatsShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'attendances', pathMatch: 'full' },
      { path: 'attendances', component: AttendancesStatsComponent },
      { path: 'workouts',    component: WorkoutsStatsComponent },
      { path: 'duration',    component: DurationStatsComponent },
      { path: 'health',      component: HealthStatsComponent },
      {
        path: 'nutrition',
        canActivate: [nutritionGuard],
        loadComponent: () => import('./features/nutrition/stats/nutrition-stats.component').then(m => m.NutritionStatsComponent)
      },
    ]
  },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'workout-types', component: WorkoutTypesComponent, canActivate: [authGuard] },
  // Only the admin account: lets it switch the food tracker on or off for each account
  {
    path: 'settings/access',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./features/admin/access/admin-access.component').then(m => m.AdminAccessComponent)
  },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'health', component: HealthComponent, canActivate: [authGuard] },

  // Nutrition (calorie tracker): loaded on demand, so it isn't part of the initial bundle.
  // Only accounts the admin has switched on get in.
  {
    path: 'nutrition',
    canActivate: [authGuard, nutritionGuard],
    loadChildren: () => import('./features/nutrition/nutrition.routes').then(m => m.NUTRITION_ROUTES)
  },

  // Default redirect
  { path: '', redirectTo: '/calendar', pathMatch: 'full' },

  // Catch-all redirect
  { path: '**', redirectTo: '/calendar' }
];
