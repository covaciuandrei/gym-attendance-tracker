import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AttendanceRecord, FirebaseService, TrainingType, SupplementProduct } from '../../services/firebase.service';

interface DayCell {
  date: number;
  fullDate: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  attended: boolean;
  trainingTypeId?: string;
}

interface MonthData {
  month: number;
  name: string;
  days: DayCell[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, RouterModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css']
})
export class CalendarComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  currentYear: number;
  currentMonth: number;
  viewMode: 'monthly' | 'yearly' = 'monthly';

  days: DayCell[] = [];
  monthsData: MonthData[] = [];
  attendedDates: Set<string> = new Set();
  attendanceMap: Map<string, AttendanceRecord> = new Map();
  supplementMap: Map<string, boolean> = new Map();
  // Supplement logs cache for popup details
  supplementLogsMap: Map<string, any[]> = new Map();

  iconCache: Map<string, string> = new Map(); // Cache icons to prevent infinite loops

  showPopup = false;
  selectedDate: DayCell | null = null;
  selectedTab: 'workout' | 'health' = 'workout';

  isLoading = false;

  // Workout types
  workoutTypes: TrainingType[] = [];
  selectedTypeId: string = '';
  isEditingType = false;
  editTypeId: string = '';

  // Duration
  selectedDuration: number | null = null;
  editDuration: number | null = null;

  // Products
  products: SupplementProduct[] = [];
  selectedProductId: string = '';

  // Custom Dropdown State
  dropdownOpen = false;
  productDropdownOpen = false;

  // Supplement Carousel State
  currentSupplementPage = 0;
  supplementsPerPage = 2;


  private authSub: Subscription | null = null;
  private userId: string | null = null;

  monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  // Helper to get day number from date string YYYY-MM-DD
  getDay(dateStr: string): string {
    if (!dateStr) return '';
    return dateStr.split('-')[2];
  }

  // Helper to get month key from date string YYYY-MM-DD
  getMonthKey(dateStr: string): string {
    if (!dateStr) return '';
    const monthIndex = parseInt(dateStr.split('-')[1]) - 1;
    return this.monthNames[monthIndex];
  }

  // Helper to get year from date string YYYY-MM-DD
  getYear(dateStr: string): string {
    if (!dateStr) return '';
    return dateStr.split('-')[0];
  }

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService
  ) {
    this.currentYear = this.currentDate.getFullYear();
    this.currentMonth = this.currentDate.getMonth();
  }

  ngOnInit() {
    this.authSub = this.authService.currentUser$.subscribe(async user => {
      if (user) {
        this.userId = user.uid;
        await this.loadWorkoutTypes();
        await this.loadAttendance();
        this.generateCalendar();
      }
    });
  }

  async loadWorkoutTypes() {
    if (!this.userId) return;
    try {
      this.workoutTypes = await this.firebaseService.getTrainingTypes(this.userId);
    } catch (error) {
      console.error('Error loading workout types:', error);
    }
  }

  ngOnDestroy() {
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }

  async loadAttendance() {
    if (!this.userId) return;

    this.isLoading = true;
    try {
      let records: AttendanceRecord[];
      if (this.viewMode === 'monthly') {
        records = await this.loadMonthRange();
      } else {
        records = await this.firebaseService.getYearAttendance(this.userId, this.currentYear);
      }

      // Build both set and map
      this.attendedDates = new Set(records.map(r => r.date));
      this.attendanceMap = new Map(records.map(r => [r.date, r]));

      // Load supplements too
      this.products = await this.firebaseService.getProducts();
      await this.loadSupplementLogs();

      // Pre-compute icon cache
      this.buildIconCache();
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
    this.isLoading = false;
  }

  private async loadMonthRange(): Promise<AttendanceRecord[]> {
    if (!this.userId) return [];

    const records: AttendanceRecord[] = [];

    // Previous month
    let prevMonth = this.currentMonth;
    let prevYear = this.currentYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear--;
    }

    // Next month
    let nextMonth = this.currentMonth + 2;
    let nextYear = this.currentYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }

    // Load 3 months in parallel
    const [prev, current, next] = await Promise.all([
      this.firebaseService.getMonthAttendance(this.userId, prevYear, prevMonth),
      this.firebaseService.getMonthAttendance(this.userId, this.currentYear, this.currentMonth + 1),
      this.firebaseService.getMonthAttendance(this.userId, nextYear, nextMonth)
    ]);

    records.push(...prev, ...current, ...next);
    return records;
  }

  generateCalendar() {
    if (this.viewMode === 'monthly') {
      this.generateMonthlyView();
    } else {
      this.generateYearlyView();
    }
  }

  generateMonthlyView() {
    this.days = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    // Adjust to make Monday the first day (0=Monday, 6=Sunday)
    const startingDay = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();

    const today = new Date();
    const todayStr = this.formatDate(today);

    // Previous month days
    const prevMonthLastDay = new Date(this.currentYear, this.currentMonth, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      const date = prevMonthLastDay - i;
      const fullDate = this.formatDate(new Date(this.currentYear, this.currentMonth - 1, date));
      this.days.push({
        date,
        fullDate,
        isCurrentMonth: false,
        isToday: false,
        attended: this.attendedDates.has(fullDate)
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const fullDate = this.formatDate(new Date(this.currentYear, this.currentMonth, i));
      this.days.push({
        date: i,
        fullDate,
        isCurrentMonth: true,
        isToday: fullDate === todayStr,
        attended: this.attendedDates.has(fullDate)
      });
    }

    // Next month days
    const remainingDays = 42 - this.days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const fullDate = this.formatDate(new Date(this.currentYear, this.currentMonth + 1, i));
      this.days.push({
        date: i,
        fullDate,
        isCurrentMonth: false,
        isToday: false,
        attended: this.attendedDates.has(fullDate)
      });
    }
  }

  generateYearlyView() {
    this.monthsData = [];
    const today = new Date();
    const todayStr = this.formatDate(today);

    for (let month = 0; month < 12; month++) {
      const firstDay = new Date(this.currentYear, month, 1);
      const lastDay = new Date(this.currentYear, month + 1, 0);
      // Adjust to make Monday the first day (0=Monday, 6=Sunday)
      const startingDay = (firstDay.getDay() + 6) % 7;
      const totalDays = lastDay.getDate();

      const days: DayCell[] = [];

      // Empty cells for alignment
      for (let i = 0; i < startingDay; i++) {
        days.push({
          date: 0,
          fullDate: '',
          isCurrentMonth: false,
          isToday: false,
          attended: false
        });
      }

      // Month days
      for (let i = 1; i <= totalDays; i++) {
        const fullDate = this.formatDate(new Date(this.currentYear, month, i));
        days.push({
          date: i,
          fullDate,
          isCurrentMonth: true,
          isToday: fullDate === todayStr,
          attended: this.attendedDates.has(fullDate)
        });
      }

      this.monthsData.push({
        month,
        name: this.monthNames[month],
        days
      });
    }
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async previousMonth() {
    if (this.viewMode === 'monthly') {
      this.currentMonth--;
      if (this.currentMonth < 0) {
        this.currentMonth = 11;
        this.currentYear--;
      }
    } else {
      this.currentYear--;
    }
    await this.loadAttendance();
    this.generateCalendar();
  }

  async nextMonth() {
    if (this.viewMode === 'monthly') {
      this.currentMonth++;
      if (this.currentMonth > 11) {
        this.currentMonth = 0;
        this.currentYear++;
      }
    } else {
      this.currentYear++;
    }
    await this.loadAttendance();
    this.generateCalendar();
  }

  async toggleView() {
    this.viewMode = this.viewMode === 'monthly' ? 'yearly' : 'monthly';
    await this.loadAttendance();
    this.generateCalendar();
  }

  onDayClick(day: DayCell) {
    if (day.date === 0) return;
    this.selectedDate = day;
    this.selectedTypeId = ''; // Reset selection
    this.selectedDuration = null; // Reset duration
    this.currentSupplementPage = 0; // Reset carousel page
    this.showPopup = true;
  }

  closePopup() {
    this.showPopup = false;
    this.selectedDate = null;
    this.isEditingType = false;
    this.dropdownOpen = false; // Reset dropdown state
    this.productDropdownOpen = false;
    this.selectedDuration = null; // Reset duration
    this.editDuration = null; // Reset edit duration
    this.currentSupplementPage = 0; // Reset carousel page
  }

  startEditType() {
    if (!this.selectedDate) return;
    const attendance = this.attendanceMap.get(this.selectedDate.fullDate);
    this.editTypeId = attendance?.trainingTypeId || '';
    this.editDuration = attendance?.durationMinutes ?? null;
    this.isEditingType = true;
  }

  async saveEditType() {
    if (!this.selectedDate || !this.userId) return;

    this.isLoading = true;
    try {
      // Update the attendance with the new workout type and duration
      await this.firebaseService.markAttendance(
        this.userId,
        this.selectedDate.fullDate,
        this.editTypeId || undefined,
        undefined,
        this.editDuration ?? undefined
      );

      // Update local cache
      const record = this.attendanceMap.get(this.selectedDate.fullDate);
      if (record) {
        record.trainingTypeId = this.editTypeId || undefined;
        record.durationMinutes = this.editDuration ?? undefined;
        this.attendanceMap.set(this.selectedDate.fullDate, record);
      }

      // Update icon cache
      if (this.editTypeId) {
        const workoutType = this.workoutTypes.find(t => t.id === this.editTypeId);
        if (workoutType?.icon) {
          this.iconCache.set(this.selectedDate.fullDate, workoutType.icon);
        }
      } else {
        this.iconCache.delete(this.selectedDate.fullDate);
      }

      this.isEditingType = false;
      this.generateCalendar();
    } catch (error) {
      console.error('Error updating workout type:', error);
    }
    this.isLoading = false;
  }

  cancelEditType() {
    this.isEditingType = false;
  }

  async toggleAttendance() {
    if (!this.selectedDate || !this.userId) return;

    this.isLoading = true;
    try {
      if (this.selectedDate.attended) {
        // Remove attendance
        await this.firebaseService.removeAttendance(this.userId, this.selectedDate.fullDate);
        this.attendedDates.delete(this.selectedDate.fullDate);
        this.attendanceMap.delete(this.selectedDate.fullDate);
        this.iconCache.delete(this.selectedDate.fullDate);
        this.selectedDate.attended = false;
      } else {
        // Add attendance with optional workout type and duration
        await this.firebaseService.markAttendance(
          this.userId,
          this.selectedDate.fullDate,
          this.selectedTypeId || undefined,
          undefined,
          this.selectedDuration ?? undefined
        );
        this.attendedDates.add(this.selectedDate.fullDate);
        this.selectedDate.attended = true;

        // Update local cache immediately
        const record = {
          date: this.selectedDate.fullDate,
          timestamp: new Date(),
          trainingTypeId: this.selectedTypeId || undefined,
          durationMinutes: this.selectedDuration ?? undefined
        };
        this.attendanceMap.set(this.selectedDate.fullDate, record);

        // Update icon cache if workout type selected
        if (this.selectedTypeId) {
          const workoutType = this.workoutTypes.find(t => t.id === this.selectedTypeId);
          if (workoutType?.icon) {
            this.iconCache.set(this.selectedDate.fullDate, workoutType.icon);
          }
        }
      }

      this.generateCalendar();
    } catch (error) {
      console.error('Error toggling attendance:', error);
    }
    this.isLoading = false;
    this.closePopup();
  }

  getDisplayTitle(): string {
    if (this.viewMode === 'monthly') {
      return `${this.monthNames[this.currentMonth]} ${this.currentYear}`;
    }
    return `${this.currentYear}`;
  }

  getWorkoutIcon(fullDate: string): string | null {
    return this.iconCache.get(fullDate) || null;
  }

  // Custom Dropdown Methods
  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  selectType(typeId: string) {
    if (this.isEditingType) {
      this.editTypeId = typeId;
    } else {
      this.selectedTypeId = typeId;
    }
    this.dropdownOpen = false;
  }

  getSelectedType(): TrainingType | undefined {
    const id = this.isEditingType ? this.editTypeId : this.selectedTypeId;
    if (!id) return undefined;
    return this.workoutTypes.find(t => t.id === id);
  }

  getWorkoutTypeName(fullDate: string): string | null {
    const attendance = this.attendanceMap.get(fullDate);
    if (!attendance?.trainingTypeId) return null;
    const workoutType = this.workoutTypes.find(t => t.id === attendance.trainingTypeId);
    return workoutType?.name || null;
  }

  private buildIconCache() {
    this.iconCache.clear();
    this.attendanceMap.forEach((record, date) => {
      if (record.trainingTypeId) {
        const workoutType = this.workoutTypes.find(t => t.id === record.trainingTypeId);
        if (workoutType?.icon) {
          this.iconCache.set(date, workoutType.icon);
        }
      }
    });
  }

  getWorkoutDuration(fullDate: string): number | null {
    const attendance = this.attendanceMap.get(fullDate);
    return attendance?.durationMinutes ?? null;
  }

  formatDuration(minutes: number | null): string {
    if (minutes === null || minutes === undefined) return '';
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }

  async loadSupplementLogs() {
    if (!this.userId) return;

    let logs: any[] = [];

    // Simplification for MVP: Just load adjacent months for monthly view
    if (this.viewMode === 'monthly') {
      const prevMonth = this.currentMonth === 0 ? 12 : this.currentMonth;
      const prevYear = this.currentMonth === 0 ? this.currentYear - 1 : this.currentYear;
      const nextMonth = this.currentMonth === 11 ? 1 : this.currentMonth + 2;
      const nextYear = this.currentMonth === 11 ? this.currentYear + 1 : this.currentYear;

      const [prev, curr, next] = await Promise.all([
        this.firebaseService.getSupplementLogs(this.userId, prevYear, prevMonth),
        this.firebaseService.getSupplementLogs(this.userId, this.currentYear, this.currentMonth + 1),
        this.firebaseService.getSupplementLogs(this.userId, nextYear, nextMonth)
      ]);
      logs = [...prev, ...curr, ...next];
    } else {
      // Load all 12 months for yearly view
      const promises = [];
      for (let i = 1; i <= 12; i++) {
        promises.push(this.firebaseService.getSupplementLogs(this.userId, this.currentYear, i));
      }
      const results = await Promise.all(promises);
      logs = results.flat();
    }

    this.supplementMap.clear();
    this.supplementLogsMap.clear();

    logs.forEach(l => {
      // Assuming new log structure: each l is a SupplementLog { date, productId, servingsTaken }
      // We group by date
      if (l.servingsTaken > 0) {
        this.supplementMap.set(l.date, true);

        const existing = this.supplementLogsMap.get(l.date) || [];
        existing.push(l);
        this.supplementLogsMap.set(l.date, existing);
      }
    });
  }

  getDaySupplementLogs(fullDate: string): any[] {
    return this.supplementLogsMap.get(fullDate) || [];
  }

  hasSupplement(fullDate: string): boolean {
    return this.supplementMap.has(fullDate);
  }

  async addProductLog() {
    if (!this.selectedDate || !this.selectedProductId || !this.userId) return;
    this.isLoading = true;
    try {
      const product = this.products.find(p => p.id === this.selectedProductId);
      const servings = product?.servingsPerDayDefault || 1;

      if (product) {
        await this.firebaseService.logSupplement(
          this.userId,
          this.selectedDate.fullDate,
          this.selectedProductId,
          servings,
          { name: product.name, brand: product.brand }
        );
      }

      // Refresh logs
      await this.loadSupplementLogs();
      this.selectedProductId = ''; // Reset selection
      this.closePopup(); // Close popup after adding
    } catch (error) {
      console.error('Error adding log:', error);
    }
    this.isLoading = false;
  }

  toggleProductDropdown() {
    this.productDropdownOpen = !this.productDropdownOpen;
  }

  selectProduct(productId: string) {
    this.selectedProductId = productId;
    this.productDropdownOpen = false;
  }

  async removeProductLog(logId: string) {
    console.log('removeProductLog called with logId:', logId);
    if (!this.selectedDate || !this.userId) {
      console.log('Missing selectedDate or userId');
      return;
    }

    // Skip confirm for now to test
    // if (!confirm('Delete this entry?')) return;

    this.isLoading = true;
    try {
      console.log('Calling removeSupplementLog with:', this.userId, logId, this.selectedDate.fullDate);
      await this.firebaseService.removeSupplementLog(this.userId, logId, this.selectedDate.fullDate);
      console.log('Successfully removed, refreshing logs...');

      // Refresh logs
      await this.loadSupplementLogs();
      console.log('Logs refreshed');
    } catch (error) {
      console.error('Error removing log:', error);
    }
    this.isLoading = false;
  }

  getProductName(productId: string): string {
    const p = this.products.find(x => x.id === productId);
    return p ? p.name : 'Unknown';
  }

  // Supplement Carousel Methods
  getPaginatedSupplements(fullDate: string): any[][] {
    const allLogs = this.getDaySupplementLogs(fullDate);
    const pages: any[][] = [];
    for (let i = 0; i < allLogs.length; i += this.supplementsPerPage) {
      pages.push(allLogs.slice(i, i + this.supplementsPerPage));
    }
    return pages;
  }

  getTotalPages(fullDate: string): number {
    const allLogs = this.getDaySupplementLogs(fullDate);
    return Math.ceil(allLogs.length / this.supplementsPerPage);
  }

  goToSupplementPage(pageIndex: number) {
    this.currentSupplementPage = pageIndex;
    // Scroll to the page
    const carousel = document.querySelector('.supplement-carousel');
    if (carousel) {
      const pageWidth = carousel.clientWidth;
      carousel.scrollTo({
        left: pageIndex * pageWidth,
        behavior: 'smooth'
      });
    }
  }

  onCarouselScroll(event: Event) {
    const carousel = event.target as HTMLElement;
    const pageWidth = carousel.clientWidth;
    const scrollLeft = carousel.scrollLeft;
    const newPage = Math.round(scrollLeft / pageWidth);
    if (newPage !== this.currentSupplementPage) {
      this.currentSupplementPage = newPage;
    }
  }

  getVisibleDots(fullDate: string): number[] {
    const totalPages = this.getTotalPages(fullDate);
    if (totalPages <= 3) {
      // Show all dots if 3 or fewer
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    // Show sliding window of 3 dots
    const current = this.currentSupplementPage;

    if (current === 0) {
      // At the start: show [0, 1, 2]
      return [0, 1, 2];
    } else if (current === totalPages - 1) {
      // At the end: show last 3
      return [totalPages - 3, totalPages - 2, totalPages - 1];
    } else {
      // In the middle: show [current-1, current, current+1]
      return [current - 1, current, current + 1];
    }
  }

  formatSupplementTime(log: any): string {
    if (!log.timestamp) {
      return '';
    }

    let date: Date;
    // Handle Firestore Timestamp with toDate() method
    if (log.timestamp.toDate) {
      date = log.timestamp.toDate();
    }
    // Handle plain object with seconds/nanoseconds (serialized Firestore Timestamp)
    else if (typeof log.timestamp === 'object' && 'seconds' in log.timestamp) {
      date = new Date(log.timestamp.seconds * 1000);
    }
    // Handle ISO string
    else if (typeof log.timestamp === 'string') {
      date = new Date(log.timestamp);
    }
    else {
      console.log('Timestamp format not recognized:', log.timestamp);
      return '';
    }

    // Format as HH:MM (24h format)
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
