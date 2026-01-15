import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AttendanceRecord, FirebaseService, TrainingType } from '../../services/firebase.service';

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
  imports: [CommonModule, FormsModule, TranslateModule],
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
  iconCache: Map<string, string> = new Map(); // Cache icons to prevent infinite loops
  
  showPopup = false;
  selectedDate: DayCell | null = null;
  isLoading = false;
  
  // Workout types
  workoutTypes: TrainingType[] = [];
  selectedTypeId: string = '';
  isEditingType = false;
  editTypeId: string = '';
  
  // Custom Dropdown State
  dropdownOpen = false;


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
    this.showPopup = true;
  }

  closePopup() {
    this.showPopup = false;
    this.selectedDate = null;
    this.isEditingType = false;
    this.dropdownOpen = false; // Reset dropdown state
  }

  startEditType() {
    if (!this.selectedDate) return;
    const attendance = this.attendanceMap.get(this.selectedDate.fullDate);
    this.editTypeId = attendance?.trainingTypeId || '';
    this.isEditingType = true;
  }

  async saveEditType() {
    if (!this.selectedDate || !this.userId) return;
    
    this.isLoading = true;
    try {
      // Update the attendance with the new workout type
      await this.firebaseService.markAttendance(
        this.userId,
        this.selectedDate.fullDate,
        this.editTypeId || undefined
      );
      
      // Update local cache
      const record = this.attendanceMap.get(this.selectedDate.fullDate);
      if (record) {
        record.trainingTypeId = this.editTypeId || undefined;
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
        // Add attendance with optional workout type
        await this.firebaseService.markAttendance(
          this.userId, 
          this.selectedDate.fullDate, 
          this.selectedTypeId || undefined
        );
        this.attendedDates.add(this.selectedDate.fullDate);
        this.selectedDate.attended = true;
        
        // Update local cache immediately
        const record = { date: this.selectedDate.fullDate, timestamp: new Date(), trainingTypeId: this.selectedTypeId || undefined };
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
}
