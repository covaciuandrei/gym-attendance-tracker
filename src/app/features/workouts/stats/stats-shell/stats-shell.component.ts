import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NutritionAccessService } from '../../../../core/nutrition/services/nutrition-access.service';

@Component({
  selector: 'app-stats-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './stats-shell.component.html',
  styleUrls: ['./stats-shell.component.css']
})
export class StatsShellComponent implements OnInit, OnDestroy {
  currentYear = new Date().getFullYear();

  readonly tabs = [
    { path: 'attendances', labelKey: 'STATS.TAB_ATTENDANCES', label: 'Attendances' },
    { path: 'workouts',    labelKey: 'STATS.TAB_WORKOUTS',    label: 'Workouts' },
    { path: 'duration',    labelKey: 'STATS.TAB_DURATION',    label: 'Duration' },
    { path: 'health',      labelKey: 'STATS.TAB_HEALTH',      label: 'Health' },
    { path: 'nutrition',   labelKey: 'STATS.TAB_NUTRITION',   label: 'Nutrition' },
  ];

  constructor(private router: Router, private route: ActivatedRoute, public access: NutritionAccessService) {}

  /** The nutrition tab is only offered to accounts the admin has switched on. */
  get visibleTabs() {
    return this.tabs.filter(tab => tab.path !== 'nutrition' || this.access.canUse());
  }

  /** The nutrition tab shows rolling windows (7/30 days), so the year selector doesn't apply to it. */
  get showYearNav(): boolean {
    return !this.router.url.split('?')[0].endsWith('/nutrition');
  }

  ngOnInit() {
    // Read year from query param if present
    this.route.queryParams.subscribe(params => {
      if (params['year']) {
        this.currentYear = +params['year'];
      }
    });
  }

  ngOnDestroy() {}

  get titleKey(): string {
    const child = this.router.url.split('?')[0].split('/').pop();
    if (child === 'workouts') return 'STATS.TITLE_WORKOUTS';
    if (child === 'duration') return 'STATS.TITLE_DURATION';
    if (child === 'health') return 'Health Stats';
    return 'STATS.TITLE_ATTENDANCE';
  }

  previousYear() {
    this.currentYear--;
    this.updateYearParam();
  }

  nextYear() {
    this.currentYear++;
    this.updateYearParam();
  }

  private updateYearParam() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { year: this.currentYear },
      queryParamsHandling: 'merge'
    });
  }
}
