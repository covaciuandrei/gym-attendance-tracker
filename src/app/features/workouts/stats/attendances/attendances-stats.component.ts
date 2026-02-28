import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { AttendanceRecord, FirebaseService } from '../../../../core/services/firebase.service';

interface StreakInfo {
  count: number;         // number of consecutive weeks
  startDate: string;     // ISO start date of first week
  endDate: string;       // ISO end date of last week
}

@Component({
  selector: 'app-attendances-stats',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './attendances-stats.component.html',
  styleUrls: ['./attendances-stats.component.css']
})
export class AttendancesStatsComponent implements OnInit, OnDestroy {
  isLoading = true;
  currentYear = new Date().getFullYear();
  userId: string | null = null;

  // Core counts
  totalCount = 0;
  monthlyCount = 0;
  yearlyCount = 0;
  monthlyData: { month: string; count: number }[] = [];

  // Patterns
  currentStreak: StreakInfo = { count: 0, startDate: '', endDate: '' };
  bestStreak: StreakInfo = { count: 0, startDate: '', endDate: '' };
  showBestStreakDates = false;

  favoriteDayNames: string[] = []; // may be multiple if tied
  favoriteDayCount = 0;
  weekdayData: { day: string; count: number }[] = [];

  private authSub: Subscription | null = null;
  private routeSub: Subscription | null = null;

  readonly monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  readonly dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
    this.showBestStreakDates = false;
    try {
      // Artificial delay for UX
      await new Promise(resolve => setTimeout(resolve, 400));

      // Run year data, previous December data, + all-time total in parallel
      const [yearData, decemberData, totalCount] = await Promise.all([
        this.firebaseService.getYearAttendance(this.userId!, this.currentYear),
        this.firebaseService.getMonthAttendance(this.userId!, this.currentYear - 1, 12),
        this.firebaseService.getTotalAttendanceCountForUser(this.userId!)
      ]);

      this.yearlyCount = yearData.length;
      // Fall back to yearly count if counter not yet initialized
      this.totalCount = totalCount > 0 ? totalCount : this.yearlyCount;

      const now = new Date();
      const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      this.monthlyCount = yearData.filter(d => d.date.startsWith(prefix)).length;

      this.processMonthlyData(yearData);
      this.processWeekdayData(yearData);
      // Combine previous December with current year for accurate cross-year streak calculation
      this.processStreaks([...decemberData, ...yearData]);
    } finally {
      this.isLoading = false;
    }
  }

  private processMonthlyData(data: AttendanceRecord[]) {
    const counts = new Array(12).fill(0);
    data.forEach(r => { counts[new Date(r.date).getMonth()]++; });
    this.monthlyData = this.monthNames.map((month, i) => ({ month, count: counts[i] }));
  }

  private processWeekdayData(data: AttendanceRecord[]) {
    const counts = new Array(7).fill(0);
    data.forEach(r => {
      const jsDay = new Date(r.date + 'T12:00:00').getDay();
      const mondayFirst = jsDay === 0 ? 6 : jsDay - 1;
      counts[mondayFirst]++;
    });

    this.weekdayData = this.dayNames.map((day, i) => ({ day, count: counts[i] }));

    const maxCount = Math.max(...counts);
    this.favoriteDayCount = maxCount;
    // Collect ALL days with the max count (handles ties)
    this.favoriteDayNames = this.dayNames.filter((_, i) => counts[i] === maxCount && maxCount > 0);
  }

  private processStreaks(data: AttendanceRecord[]) {
    if (data.length === 0) {
      this.currentStreak = { count: 0, startDate: '', endDate: '' };
      this.bestStreak = { count: 0, startDate: '', endDate: '' };
      return;
    }

    // Get ISO week number for a date (Mon-Sun weeks)
    const getISOWeek = (dateStr: string): string => {
      const d = new Date(dateStr + 'T12:00:00');
      const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      return monday.toISOString().slice(0, 10); // ISO date of the Monday of that week
    };

    // Track actual first/last attendance dates for each week to display precise streak bounds
    const weekMap = new Map<string, { first: string, last: string }>();
    data.forEach(r => {
      const w = getISOWeek(r.date);
      if (!weekMap.has(w)) {
        weekMap.set(w, { first: r.date, last: r.date });
      } else {
        const entry = weekMap.get(w)!;
        if (r.date < entry.first) entry.first = r.date;
        if (r.date > entry.last) entry.last = r.date;
      }
    });

    const weeks = Array.from(weekMap.keys()).sort();
    if (weeks.length === 0) return;

    // Calculate all streaks (consecutive weeks, sorted by Monday date)
    let streaks: StreakInfo[] = [];
    let streakStartWeek = weeks[0];
    let streakLen = 1;

    const prevMonday = (mondayStr: string): string => {
      const d = new Date(mondayStr + 'T12:00:00');
      d.setDate(d.getDate() - 7);
      return d.toISOString().slice(0, 10);
    };

    for (let i = 1; i < weeks.length; i++) {
      if (weeks[i] === new Date(new Date(weeks[i - 1] + 'T12:00:00').getTime() + 7 * 86400000).toISOString().slice(0, 10)) {
        streakLen++;
      } else {
        streaks.push({
          count: streakLen,
          startDate: weekMap.get(streakStartWeek)!.first,
          endDate: weekMap.get(weeks[i - 1])!.last
        });
        streakStartWeek = weeks[i];
        streakLen = 1;
      }
    }
    streaks.push({
      count: streakLen,
      startDate: weekMap.get(streakStartWeek)!.first,
      endDate: weekMap.get(weeks[weeks.length - 1])!.last
    });

    // Best streak overall
    this.bestStreak = streaks.reduce((best, s) => s.count > best.count ? s : best, streaks[0]);

    // Current streak: check if the last week in the data is the current or previous week
    const todayMonday = getISOWeek(new Date().toISOString().slice(0, 10));
    const lastWeek = prevMonday(todayMonday);
    const lastStreakEnd = weeks[weeks.length - 1];

    if (lastStreakEnd === todayMonday || lastStreakEnd === lastWeek) {
      this.currentStreak = streaks[streaks.length - 1];
    } else {
      this.currentStreak = { count: 0, startDate: '', endDate: '' };
    }
  }

  toggleBestStreakDates() {
    this.showBestStreakDates = !this.showBestStreakDates;
  }

  getStreakMessage(weeks: number): string {
    if (weeks === 0)  return 'STATS.STREAK_0';
    if (weeks === 1)  return 'STATS.STREAK_1';
    if (weeks === 2)  return 'STATS.STREAK_2';
    if (weeks <= 4)   return 'STATS.STREAK_4';
    if (weeks <= 8)   return 'STATS.STREAK_8';
    if (weeks <= 12)  return 'STATS.STREAK_12';
    if (weeks <= 20)  return 'STATS.STREAK_20';
    if (weeks <= 30)  return 'STATS.STREAK_30';
    if (weeks <= 40)  return 'STATS.STREAK_40';
    if (weeks <= 52)  return 'STATS.STREAK_52';
    return 'STATS.STREAK_MAX';
  }

  isFavoriteDay(day: string): boolean {
    return this.favoriteDayNames.includes(day);
  }

  formatDateRange(start: string, end: string): string {
    if (!start || !end) return '';
    const fmt = (d: string) => {
      const date = new Date(d + 'T12:00:00');
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    return `${fmt(start)} → ${fmt(end)}`;
  }

  getMaxWeekdayCount(): number {
    return Math.max(...this.weekdayData.map(d => d.count), 1);
  }

  getMaxCount(): number {
    return Math.max(...this.monthlyData.map(d => d.count), 1);
  }
}
