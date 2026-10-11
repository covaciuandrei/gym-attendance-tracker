import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { NutritionCalendarComponent } from './calendar/nutrition-calendar.component';
import { NutritionDayComponent } from './day/nutrition-day.component';
import { EntryEditorComponent } from './entry/entry-editor.component';
import { NutritionGoalsComponent } from './goals/nutrition-goals.component';
import { NutritionShellComponent } from './nutrition-shell.component';

/** Loaded lazily from app.routes.ts, so the nutrition code is not part of the initial bundle. */
export const NUTRITION_ROUTES: Routes = [
  {
    path: '',
    component: NutritionShellComponent,
    children: [
      { path: '', pathMatch: 'full', component: NutritionCalendarComponent },
      { path: 'day/:date', component: NutritionDayComponent },
      { path: 'day/:date/entry/:id', component: EntryEditorComponent },
      { path: 'goals', component: NutritionGoalsComponent, canDeactivate: [unsavedChangesGuard] },
    ],
  },
];
