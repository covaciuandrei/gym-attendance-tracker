import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AttendanceRecord, FirebaseService, WorkoutTypeDurationStat, WorkoutTypeStat } from '../../services/firebase.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.css']
})
export class StatsComponent implements OnInit, OnDestroy {
  // View mode: 'attendances' | 'workouts' | 'duration' | 'health'
  viewMode: 'attendances' | 'workouts' | 'duration' | 'health' = 'attendances';

  // Attendance Stats
  totalCount = 0;
  monthlyCount = 0;
  yearlyCount = 0;
  monthlyData: { month: string; count: number }[] = [];

  // Workout Type Stats
  workoutTypeStats: WorkoutTypeStat[] = [];
  monthlyWorkoutStats: WorkoutTypeStat[] = [];
  monthlyWorkoutData: { month: string; types: { id: string; name: string; icon?: string; color: string; count: number }[] }[] = []; // Monthly breakdown by category

  // Duration Stats
  monthlyAvgDuration = 0;
  yearlyAvgDuration = 0;
  untrackedWorkoutsMonth = 0;
  untrackedWorkoutsYear = 0;
  workoutTypeDurationStats: WorkoutTypeDurationStat[] = [];
  monthlyDurationStats: WorkoutTypeDurationStat[] = [];
  monthlyDurationData: { month: string; avgMinutes: number }[] = []; // Monthly breakdown chart for duration

  // Date tracking for workout view
  currentYear = new Date().getFullYear();
  selectedWorkoutMonth = new Date().getMonth(); // 0-11

  isLoading = true;
  private authSub: Subscription | null = null;
  private userId: string | null = null;

  monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  // Health Stats
  mostTakenProduct: { name: string; count: number } | null = null;
  topNutrients: { name: string; amount: number; unit: string }[] = [];
  totalHealthLogs = 0;
  monthlyHealthData: { month: string; count: number }[] = [];

  // Health Stats - Enhanced
  selectedHealthMonth: number = new Date().getMonth(); // 0-11
  monthlySupplementStats: { name: string; brand: string; count: number; color: string }[] = [];
  monthlyServingsCount = 0;
  yearlyServingsCount = 0;
  consistencyPercentage = 0; // % of days with logged supplements
  daysWithSupplements = 0;
  totalDaysElapsed = 0;

  // Top supplements with daily averages
  topYearlySupp: { name: string; count: number; avgPerDay: number } | null = null;
  topMonthlySupp: { name: string; count: number; avgPerDay: number } | null = null;

  constructor(
    private firebaseService: FirebaseService,
    private themeService: ThemeService,
    private authService: AuthService
  ) { }

  ngOnInit() {
    this.authSub = this.authService.currentUser$.subscribe(async (user) => {
      this.isLoading = true;
      if (user) {
        this.userId = user.uid;
        await this.loadStats();
      } else {
        this.userId = null;
        this.resetStats();
      }
      this.isLoading = false;
    });
  }

  ngOnDestroy() {
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }

  resetStats() {
    this.totalCount = 0;
    this.monthlyCount = 0;
    this.yearlyCount = 0;
    this.workoutTypeStats = [];
    this.monthlyWorkoutStats = [];
    this.monthlyData = [];
    this.monthlyWorkoutData = [];
    // Reset duration stats
    this.monthlyAvgDuration = 0;
    this.yearlyAvgDuration = 0;
    this.untrackedWorkoutsMonth = 0;
    this.untrackedWorkoutsYear = 0;
    this.workoutTypeDurationStats = [];
    this.monthlyDurationStats = [];
    this.monthlyDurationData = [];
    // Reset health stats
    this.mostTakenProduct = null;
    this.topNutrients = [];
    this.totalHealthLogs = 0;
    this.monthlyHealthData = [];
  }

  async loadStats() {
    if (!this.userId) return;

    // Load attendance stats
    const yearData = await this.firebaseService.getYearAttendance(this.userId, this.currentYear);
    this.yearlyCount = yearData.length;
    this.totalCount = await this.firebaseService.getTotalAttendanceCount() || this.yearlyCount;

    // Current month count
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.monthlyCount = yearData.filter(d => d.date.startsWith(currentMonthPrefix)).length;

    // Process monthly breakdown for attendances
    this.processMonthlyData(yearData);

    // Process monthly breakdown for duration (average per month)
    this.processMonthlyDurationData(yearData);

    // Load workout type stats first (needed for monthly workout chart)
    this.workoutTypeStats = await this.firebaseService.getWorkoutTypeStats(this.userId, this.currentYear);

    // Process monthly breakdown for workouts by category (needs workout types)
    const trainingTypes = await this.firebaseService.getTrainingTypes(this.userId);
    this.processMonthlyWorkoutData(yearData, trainingTypes);

    await this.loadMonthlyWorkoutStats();

    // Load duration stats
    await this.loadDurationStats();

    // Load Health stats
    await this.loadHealthStats();
  }

  async loadHealthStats() {
    if (!this.userId) return;

    // Fetch all logs for the year (iterate 12 months)
    const logsPromises = [];
    for (let m = 1; m <= 12; m++) {
      logsPromises.push(this.firebaseService.getSupplementLogs(this.userId, this.currentYear, m));
    }
    const monthlyLogs = await Promise.all(logsPromises);
    const allLogs = monthlyLogs.flat();

    // Calculate yearly servings (sum of servingsTaken)
    this.yearlyServingsCount = allLogs.reduce((sum, log) => sum + log.servingsTaken, 0);
    this.totalHealthLogs = allLogs.length;

    // Calculate Monthly consistency chart
    this.monthlyHealthData = this.monthNames.map((name, idx) => {
      const monthServings = monthlyLogs[idx].reduce((sum, log) => sum + log.servingsTaken, 0);
      return { month: name, count: monthServings };
    });

    // Calculate consistency (unique days with supplements / days elapsed this year)
    const uniqueDays = new Set(allLogs.map(log => log.date));
    this.daysWithSupplements = uniqueDays.size;

    const now = new Date();
    const startOfYear = new Date(this.currentYear, 0, 1);
    const endDate = this.currentYear === now.getFullYear() ? now : new Date(this.currentYear, 11, 31);
    this.totalDaysElapsed = Math.max(1, Math.floor((endDate.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    this.consistencyPercentage = Math.round((this.daysWithSupplements / this.totalDaysElapsed) * 100);

    // Need products to aggregate nutrients and get product info
    const products = await this.firebaseService.getProducts();
    const productMap = new Map<string, any>();
    products.forEach(p => productMap.set(p.id, p));

    const nutrientMap = new Map<string, { name: string; amount: number; unit: string }>();
    const productCounts = new Map<string, { name: string; brand: string; count: number }>();

    allLogs.forEach(log => {
      const product = productMap.get(log.productId);
      if (product) {
        // Track product usage
        const existing = productCounts.get(log.productId) || { name: product.name, brand: product.brand || '', count: 0 };
        existing.count += log.servingsTaken;
        productCounts.set(log.productId, existing);

        // Aggregate nutrients
        product.ingredients.forEach((ing: any) => {
          const total = log.servingsTaken * ing.amount;
          const existingNutrient = nutrientMap.get(ing.stdId) || { name: ing.stdId, amount: 0, unit: ing.unit };
          existingNutrient.amount += total;
          nutrientMap.set(ing.stdId, existingNutrient);
        });
      }
    });

    // Resolve Nutrient Names
    if (nutrientMap.size > 0) {
      const globalIngredients = await this.firebaseService.getIngredients();
      const ingMap = new Map(globalIngredients.map(i => [i.id, i.name]));

      nutrientMap.forEach((val, key) => {
        val.name = ingMap.get(key) || val.name;
      });
    }

    // Top Nutrients
    this.topNutrients = Array.from(nutrientMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Most Taken Product (yearly) with avgPerDay
    let maxProduct = '';
    let maxVal = 0;
    productCounts.forEach((val, key) => {
      if (val.count > maxVal) {
        maxVal = val.count;
        maxProduct = val.name;
      }
    });

    if (maxProduct) {
      this.mostTakenProduct = { name: maxProduct, count: maxVal };
      // Calculate average per day of month (based on days elapsed)
      const avgPerDay = this.totalDaysElapsed > 0 ? maxVal / this.totalDaysElapsed : 0;
      this.topYearlySupp = { name: maxProduct, count: maxVal, avgPerDay };
    } else {
      this.topYearlySupp = null;
    }

    // Load monthly supplement breakdown
    await this.loadMonthlySupplementStats(monthlyLogs, productMap);
  }

  async loadMonthlySupplementStats(monthlyLogs?: any[][], productMap?: Map<string, any>) {
    if (!this.userId) return;

    // If not provided, fetch fresh
    if (!monthlyLogs || !productMap) {
      const logs = await this.firebaseService.getSupplementLogs(
        this.userId,
        this.currentYear,
        this.selectedHealthMonth + 1
      );
      const products = await this.firebaseService.getProducts();
      productMap = new Map();
      products.forEach(p => productMap!.set(p.id, p));
      monthlyLogs = [];
      monthlyLogs[this.selectedHealthMonth] = logs;
    }

    const selectedLogs = monthlyLogs[this.selectedHealthMonth] || [];

    // Calculate monthly servings count
    this.monthlyServingsCount = selectedLogs.reduce((sum, log) => sum + log.servingsTaken, 0);

    // Aggregate by product
    const productAggregate = new Map<string, { name: string; brand: string; count: number }>();
    selectedLogs.forEach(log => {
      const product = productMap!.get(log.productId);
      if (product) {
        const existing = productAggregate.get(log.productId) || { name: product.name, brand: product.brand || '', count: 0 };
        existing.count += log.servingsTaken;
        productAggregate.set(log.productId, existing);
      }
    });

    // Generate colors for products (health-themed greens/teals)
    const healthColors = [
      '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#22c55e',
      '#84cc16', '#34d399', '#2dd4bf', '#38bdf8', '#4ade80'
    ];

    const sortedProducts = Array.from(productAggregate.values())
      .sort((a, b) => b.count - a.count);

    this.monthlySupplementStats = sortedProducts
      .slice(0, 8)
      .map((stat, idx) => ({
        ...stat,
        color: healthColors[idx % healthColors.length]
      }));

    // Calculate top monthly supplement with avgPerDay
    if (sortedProducts.length > 0) {
      const topProduct = sortedProducts[0];
      // Days in the selected month
      const now = new Date();
      const daysInMonth = new Date(this.currentYear, this.selectedHealthMonth + 1, 0).getDate();
      // If current month of current year, use days elapsed so far
      const daysElapsed = (this.currentYear === now.getFullYear() && this.selectedHealthMonth === now.getMonth())
        ? now.getDate()
        : daysInMonth;
      const avgPerDay = daysElapsed > 0 ? topProduct.count / daysElapsed : 0;
      this.topMonthlySupp = { name: topProduct.name, count: topProduct.count, avgPerDay };
    } else {
      this.topMonthlySupp = null;
    }
  }

  async prevHealthMonth() {
    this.selectedHealthMonth--;
    if (this.selectedHealthMonth < 0) {
      this.selectedHealthMonth = 11;
      this.currentYear--;
      await this.loadHealthStats();
    } else {
      await this.loadMonthlySupplementStats();
    }
  }

  async nextHealthMonth() {
    this.selectedHealthMonth++;
    if (this.selectedHealthMonth > 11) {
      this.selectedHealthMonth = 0;
      this.currentYear++;
      await this.loadHealthStats();
    } else {
      await this.loadMonthlySupplementStats();
    }
  }

  getMaxSupplementCount(): number {
    return Math.max(...this.monthlySupplementStats.map(s => s.count), 1);
  }

  getMonthlySupplementTotal(): number {
    return this.monthlySupplementStats.reduce((sum, current) => sum + current.count, 0);
  }

  getMaxHealthCount(): number {
    return Math.max(...this.monthlyHealthData.map(d => d.count), 1);
  }

  // ... existing methods ...

  getDisplayTitle(): string {
    if (this.viewMode === 'attendances') return 'STATS.TITLE_ATTENDANCE';
    if (this.viewMode === 'workouts') return 'STATS.TITLE_WORKOUTS';
    if (this.viewMode === 'health') return 'Health Stats';
    return 'STATS.TITLE_DURATION';
  }

  toggleView(mode: 'attendances' | 'workouts' | 'duration' | 'health') {
    this.viewMode = mode;
  }

  async loadDurationStats() {
    if (!this.userId) return;

    // Get yearly duration stats
    const yearStats = await this.firebaseService.getYearDurationStats(this.userId, this.currentYear);
    this.yearlyAvgDuration = yearStats.avgMinutes;
    this.untrackedWorkoutsYear = yearStats.untrackedCount;

    // Get duration by workout type (yearly)
    this.workoutTypeDurationStats = await this.firebaseService.getWorkoutTypeDurationStats(this.userId, this.currentYear);

    // Load monthly duration stats
    await this.loadMonthlyDurationStats();
  }

  async loadMonthlyWorkoutStats() {
    if (!this.userId) return;
    this.monthlyWorkoutStats = await this.firebaseService.getMonthlyWorkoutTypeStats(
      this.userId,
      this.currentYear,
      this.selectedWorkoutMonth + 1 // Service expects 1-12 probably? verify getMonthlyWorkoutTypeStats
    );
  }

  processMonthlyData(data: AttendanceRecord[]) {
    // Aggregate attendance records into monthly counts
    const counts = new Array(12).fill(0);

    data.forEach(record => {
      const date = new Date(record.date);
      const monthIndex = date.getMonth();
      counts[monthIndex]++;
    });

    this.monthlyData = this.monthNames.map((name, index) => {
      return {
        month: name,
        count: counts[index]
      };
    });
  }

  processMonthlyWorkoutData(data: AttendanceRecord[], trainingTypes: { id: string; name: string; color: string; icon?: string }[]) {
    // Count workouts per month per category
    // Create a map: monthIndex -> typeId -> count
    const monthTypeCounts = new Array(12).fill(null).map(() => new Map<string, number>());

    data.forEach(record => {
      if (record.trainingTypeId) {
        const date = new Date(record.date);
        const monthIndex = date.getMonth();
        const currentCount = monthTypeCounts[monthIndex].get(record.trainingTypeId) || 0;
        monthTypeCounts[monthIndex].set(record.trainingTypeId, currentCount + 1);
      }
    });

    this.monthlyWorkoutData = this.monthNames.map((name, index) => {
      const typesForMonth = trainingTypes.map(type => ({
        id: type.id,
        name: type.name,
        icon: type.icon,
        color: type.color,
        count: monthTypeCounts[index].get(type.id) || 0
      })).filter(t => t.count > 0); // Only include types with workouts

      return {
        month: name,
        types: typesForMonth
      };
    });
  }

  processMonthlyDurationData(data: AttendanceRecord[]) {
    // Calculate average duration per month (only workouts with duration)
    const durations: { total: number; count: number }[] = new Array(12).fill(null).map(() => ({ total: 0, count: 0 }));

    data.forEach(record => {
      if (record.durationMinutes != null && record.durationMinutes > 0) {
        const date = new Date(record.date);
        const monthIndex = date.getMonth();
        durations[monthIndex].total += record.durationMinutes;
        durations[monthIndex].count++;
      }
    });

    this.monthlyDurationData = this.monthNames.map((name, index) => {
      const avg = durations[index].count > 0
        ? Math.round(durations[index].total / durations[index].count)
        : 0;
      return {
        month: name,
        avgMinutes: avg
      };
    });
  }

  getMaxCount(): number {
    return Math.max(...this.monthlyData.map(d => d.count), 1); // Avoid div by 0
  }

  getMaxWorkoutCount(): number {
    return Math.max(...this.workoutTypeStats.map(s => s.count), 1);
  }

  getMaxMonthlyWorkoutCount(): number {
    return Math.max(...this.monthlyWorkoutStats.map(s => s.count), 1);
  }

  getMaxMonthlyWorkoutChartCount(): number {
    // Get the max count across all types in all months
    let maxCount = 1;
    this.monthlyWorkoutData.forEach(month => {
      month.types.forEach(type => {
        if (type.count > maxCount) {
          maxCount = type.count;
        }
      });
    });
    return maxCount;
  }

  getMaxMonthlyDurationChartValue(): number {
    return Math.max(...this.monthlyDurationData.map(d => d.avgMinutes), 1);
  }


  formatDuration(minutes: number): string {
    if (minutes === 0) return '0 min';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  }

  getMaxDurationMinutes(): number {
    return Math.max(...this.workoutTypeDurationStats.map(s => s.avgMinutes), 1);
  }

  getMaxMonthlyDurationMinutes(): number {
    return Math.max(...this.monthlyDurationStats.map(s => s.avgMinutes), 1);
  }

  async previousPeriod() {
    this.currentYear--;
    await this.loadStats();
  }

  async nextPeriod() {
    this.currentYear++;
    await this.loadStats();
  }

  async prevWorkoutMonth() {
    this.selectedWorkoutMonth--;
    if (this.selectedWorkoutMonth < 0) {
      this.selectedWorkoutMonth = 11;
      this.currentYear--;
      if (this.userId) {
        this.workoutTypeStats = await this.firebaseService.getWorkoutTypeStats(this.userId, this.currentYear);
        this.workoutTypeDurationStats = await this.firebaseService.getWorkoutTypeDurationStats(this.userId, this.currentYear);
      }
    }
    await this.loadMonthlyWorkoutStats();
    await this.loadMonthlyDurationStats();
  }

  async nextWorkoutMonth() {
    this.selectedWorkoutMonth++;
    if (this.selectedWorkoutMonth > 11) {
      this.selectedWorkoutMonth = 0;
      this.currentYear++;
      if (this.userId) {
        this.workoutTypeStats = await this.firebaseService.getWorkoutTypeStats(this.userId, this.currentYear);
        this.workoutTypeDurationStats = await this.firebaseService.getWorkoutTypeDurationStats(this.userId, this.currentYear);
      }
    }
    await this.loadMonthlyWorkoutStats();
    await this.loadMonthlyDurationStats();
  }

  async loadMonthlyDurationStats() {
    if (!this.userId) return;

    const monthStats = await this.firebaseService.getMonthDurationStats(
      this.userId,
      this.currentYear,
      this.selectedWorkoutMonth + 1
    );
    this.monthlyAvgDuration = monthStats.avgMinutes;
    this.untrackedWorkoutsMonth = monthStats.untrackedCount;

    this.monthlyDurationStats = await this.firebaseService.getMonthlyWorkoutTypeDurationStats(
      this.userId,
      this.currentYear,
      this.selectedWorkoutMonth + 1
    );
  }

  getMonthlyWorkoutTotal(): number {
    return this.monthlyWorkoutStats.reduce((sum, current) => sum + current.count, 0);
  }

  getTotalWorkouts(): number {
    return this.workoutTypeStats.reduce((sum, current) => sum + current.count, 0);
  }
}
