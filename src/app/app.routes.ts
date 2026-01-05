import { Routes } from '@angular/router';
import { CalendarComponent } from './components/calendar/calendar.component';
import { StatsComponent } from './components/stats/stats.component';

export const routes: Routes = [
  { path: '', redirectTo: '/calendar', pathMatch: 'full' },
  { path: 'calendar', component: CalendarComponent },
  { path: 'stats', component: StatsComponent },
  { path: '**', redirectTo: '/calendar' }
];
