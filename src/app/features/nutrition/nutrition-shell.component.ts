import { Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NutritionAccessService } from '../../core/nutrition/services/nutrition-access.service';
import { NutritionToastComponent } from './shared/nutrition-toast.component';

/**
 * Wraps every nutrition page in `.nt`, the scope of the nutrition design tokens and utility classes.
 * If the admin switches this account off while it is on one of these pages, it is sent back to the calendar.
 */
@Component({
  selector: 'app-nutrition-shell',
  standalone: true,
  imports: [RouterOutlet, NutritionToastComponent],
  template: `<div class="nt"><router-outlet /><app-nt-toast /></div>`,
})
export class NutritionShellComponent {
  private access = inject(NutritionAccessService);
  private router = inject(Router);

  constructor() {
    effect(() => {
      if (this.access.ready() && !this.access.canUse()) void this.router.navigate(['/calendar'], { replaceUrl: true });
    });
  }
}
