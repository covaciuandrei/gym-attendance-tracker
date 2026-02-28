import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { AttendanceRecord, FirebaseService, WorkoutTypeDurationStat } from '../../../../core/services/firebase.service';

@Component({
  selector: 'app-duration-stats',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './duration-stats.component.html',
  styleUrls: ['./duration-stats.component.css']
})
export class DurationStatsComponent implements OnInit, OnDestroy {
  isLoading = true;
  currentYear = new Date().getFullYear();
  userId: string | null = null;

  selectedMonth = new Date().getMonth();
  monthlyAvgDuration = 0;
  yearlyAvgDuration = 0;
  untrackedWorkoutsMonth = 0;
  untrackedWorkoutsYear = 0;
  workoutTypeDurationStats: WorkoutTypeDurationStat[] = [];
  monthlyDurationStats: WorkoutTypeDurationStat[] = [];
  monthlyDurationData: { month: string; avgMinutes: number }[] = [];

  private authSub: Subscription | null = null;
  private routeSub: Subscription | null = null;

  readonly monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.authSub = this.authService.currentUser$.subscribe(async user => {
      this.userId = user?.uid ?? null;
      if (this.userId) await this.load();
    });

    this.routeSub = this.route.queryParams.subscribe(async params => {
      if (params['year'] && +params['year'] !== this.currentYear) {
        this.currentYear = +params['year'];
        if (this.userId) await this.load();
      }
    });
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
    this.routeSub?.unsubscribe();
  }

  async load() {
    this.isLoading = true;
    try {
      // Artificial delay for testing UX
      await new Promise(resolve => setTimeout(resolve, 400));

      const [yearData, trainingTypes] = await Promise.all([
        this.firebaseService.getYearAttendance(this.userId!, this.currentYear),
        this.firebaseService.getTrainingTypes(this.userId!)
      ]);

      this.processMonthlyDurationData(yearData);

      const yearStats = await this.firebaseService.getYearDurationStats(this.userId!, this.currentYear, yearData);
      this.yearlyAvgDuration = yearStats.avgMinutes;
      this.untrackedWorkoutsYear = yearStats.untrackedCount;

      this.workoutTypeDurationStats = await this.firebaseService.getWorkoutTypeDurationStats(
        this.userId!, this.currentYear, yearData, trainingTypes
      );

      await this.loadMonthStats();
    } finally {
      this.isLoading = false;
    }
  }

  async loadMonthStats() {
    if (!this.userId) return;
    const monthStats = await this.firebaseService.getMonthDurationStats(
      this.userId, this.currentYear, this.selectedMonth + 1
    );
    this.monthlyAvgDuration = monthStats.avgMinutes;
    this.untrackedWorkoutsMonth = monthStats.untrackedCount;

    this.monthlyDurationStats = await this.firebaseService.getMonthlyWorkoutTypeDurationStats(
      this.userId, this.currentYear, this.selectedMonth + 1
    );
  }

  async prevMonth() {
    this.selectedMonth--;
    if (this.selectedMonth < 0) {
      this.selectedMonth = 11;
      this.currentYear--;
      if (this.userId) {
        this.workoutTypeDurationStats = await this.firebaseService.getWorkoutTypeDurationStats(this.userId, this.currentYear);
      }
    }
    await this.loadMonthStats();
  }

  async nextMonth() {
    this.selectedMonth++;
    if (this.selectedMonth > 11) {
      this.selectedMonth = 0;
      this.currentYear++;
      if (this.userId) {
        this.workoutTypeDurationStats = await this.firebaseService.getWorkoutTypeDurationStats(this.userId, this.currentYear);
      }
    }
    await this.loadMonthStats();
  }

  private processMonthlyDurationData(data: AttendanceRecord[]) {
    const durations = new Array(12).fill(null).map(() => ({ total: 0, count: 0 }));
    data.forEach(r => {
      if (r.durationMinutes != null && r.durationMinutes > 0) {
        const mi = new Date(r.date).getMonth();
        durations[mi].total += r.durationMinutes;
        durations[mi].count++;
      }
    });
    this.monthlyDurationData = this.monthNames.map((month, i) => ({
      month,
      avgMinutes: durations[i].count > 0 ? Math.round(durations[i].total / durations[i].count) : 0
    }));
  }

  formatDuration(minutes: number): string {
    if (minutes === 0) return '0 min';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  }

  getMaxDurationMinutes(): number {
    return Math.max(...this.workoutTypeDurationStats.map(s => s.avgMinutes), 1);
  }

  getMaxMonthlyDurationMinutes(): number {
    return Math.max(...this.monthlyDurationStats.map(s => s.avgMinutes), 1);
  }

  getMaxMonthlyDurationChartValue(): number {
    return Math.max(...this.monthlyDurationData.map(d => d.avgMinutes), 1);
  }
}
