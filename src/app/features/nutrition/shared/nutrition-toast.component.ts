import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/nutrition/services/toast.service';

/** The app-wide message toast for the nutrition screens. Styles live in nutrition-base.css (under `.nt`). */
@Component({
  selector: 'app-nt-toast',
  standalone: true,
  template: `@if (toast.message(); as message) {
    <div class="toast" role="status">{{ message }}</div>
  }`,
})
export class NutritionToastComponent {
  readonly toast = inject(ToastService);
}
