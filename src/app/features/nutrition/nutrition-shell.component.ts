import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NutritionToastComponent } from './shared/nutrition-toast.component';

/** Wraps every nutrition page in `.nt`, the scope of the nutrition design tokens and utility classes. */
@Component({
  selector: 'app-nutrition-shell',
  standalone: true,
  imports: [RouterOutlet, NutritionToastComponent],
  template: `<div class="nt"><router-outlet /><app-nt-toast /></div>`,
})
export class NutritionShellComponent {}
