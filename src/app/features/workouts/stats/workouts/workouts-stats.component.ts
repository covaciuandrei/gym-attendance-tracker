import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { AttendanceRecord, FirebaseService, TrainingType, WorkoutTypeStat } from '../../../../core/services/firebase.service';

@Component({
  selector: 'app-workouts-stats',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './workouts-stats.component.html',
  styleUrls: ['./workouts-stats.component.css']
})
export class WorkoutsStatsComponent implements OnInit, OnDestroy {
  isLoading = true;
  currentYear = new Date().getFullYear();
  userId: string | null = null;

  selectedWorkoutMonth = new Date().getMonth();
  workoutTypeStats: WorkoutTypeStat[] = [];
  monthlyWorkoutStats: WorkoutTypeStat[] = [];
  monthlyWorkoutData: { month: string; types: any[] }[] = [];

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

      this.processMonthlyWorkoutData(yearData, trainingTypes);
      this.workoutTypeStats = await this.firebaseService.getWorkoutTypeStats(
        this.userId!, this.currentYear, yearData, trainingTypes
      );
      await this.loadMonthlyWorkoutStats();
    } finally {
      this.isLoading = false;
    }
  }

  async loadMonthlyWorkoutStats() {
    if (!this.userId) return;
    this.monthlyWorkoutStats = await this.firebaseService.getMonthlyWorkoutTypeStats(
      this.userId, this.currentYear, this.selectedWorkoutMonth + 1
    );
  }

  async prevMonth() {
    this.selectedWorkoutMonth--;
    if (this.selectedWorkoutMonth < 0) {
      this.selectedWorkoutMonth = 11;
      this.currentYear--;
      if (this.userId)
        this.workoutTypeStats = await this.firebaseService.getWorkoutTypeStats(this.userId, this.currentYear);
    }
    await this.loadMonthlyWorkoutStats();
  }

  async nextMonth() {
    this.selectedWorkoutMonth++;
    if (this.selectedWorkoutMonth > 11) {
      this.selectedWorkoutMonth = 0;
      this.currentYear++;
      if (this.userId)
        this.workoutTypeStats = await this.firebaseService.getWorkoutTypeStats(this.userId, this.currentYear);
    }
    await this.loadMonthlyWorkoutStats();
  }

  private processMonthlyWorkoutData(data: AttendanceRecord[], trainingTypes: TrainingType[]) {
    const monthTypeCounts = new Array(12).fill(null).map(() => new Map<string, number>());
    data.forEach(record => {
      if (record.trainingTypeId) {
        const mi = new Date(record.date).getMonth();
        monthTypeCounts[mi].set(record.trainingTypeId, (monthTypeCounts[mi].get(record.trainingTypeId) || 0) + 1);
      }
    });
    this.monthlyWorkoutData = this.monthNames.map((month, i) => ({
      month,
      types: trainingTypes.map(t => ({
        id: t.id, name: t.name, icon: t.icon, color: t.color,
        count: monthTypeCounts[i].get(t.id) || 0
      })).filter(t => t.count > 0)
    }));
  }

  getTotalWorkouts(): number {
    return this.workoutTypeStats.reduce((s, t) => s + t.count, 0);
  }

  getMaxWorkoutCount(): number {
    return Math.max(...this.workoutTypeStats.map(s => s.count), 1);
  }

  getMaxMonthlyWorkoutCount(): number {
    return Math.max(...this.monthlyWorkoutStats.map(s => s.count), 1);
  }

  getMonthlyWorkoutTotal(): number {
    return this.monthlyWorkoutStats.reduce((s, t) => s + t.count, 0);
  }
}
