import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FirebaseService } from '../../services/firebase.service';

interface DayCell {
  date: number;
  fullDate: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  attended: boolean;
}

interface MonthData {
  month: number;
  name: string;
  days: DayCell[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css']
})
export class CalendarComponent implements OnInit {
  currentDate = new Date();
  currentYear: number;
  currentMonth: number;
  viewMode: 'monthly' | 'yearly' = 'monthly';
  
  days: DayCell[] = [];
  monthsData: MonthData[] = [];
  attendedDates: Set<string> = new Set();
  
  showPopup = false;
  selectedDate: DayCell | null = null;
  isLoading = false;

  monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  constructor(private firebaseService: FirebaseService) {
    this.currentYear = this.currentDate.getFullYear();
    this.currentMonth = this.currentDate.getMonth();
  }

  async ngOnInit() {
    await this.loadAttendance();
    this.generateCalendar();
  }

  async loadAttendance() {
    this.isLoading = true;
    try {
      const dates = await this.firebaseService.getAllAttendance();
      this.attendedDates = new Set(dates);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
    this.isLoading = false;
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
    const startingDay = firstDay.getDay();
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
      const startingDay = firstDay.getDay();
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

  previousMonth() {
    if (this.viewMode === 'monthly') {
      this.currentMonth--;
      if (this.currentMonth < 0) {
        this.currentMonth = 11;
        this.currentYear--;
      }
    } else {
      this.currentYear--;
    }
    this.generateCalendar();
  }

  nextMonth() {
    if (this.viewMode === 'monthly') {
      this.currentMonth++;
      if (this.currentMonth > 11) {
        this.currentMonth = 0;
        this.currentYear++;
      }
    } else {
      this.currentYear++;
    }
    this.generateCalendar();
  }

  toggleView() {
    this.viewMode = this.viewMode === 'monthly' ? 'yearly' : 'monthly';
    this.generateCalendar();
  }

  onDayClick(day: DayCell) {
    if (day.date === 0) return;
    this.selectedDate = day;
    this.showPopup = true;
  }

  closePopup() {
    this.showPopup = false;
    this.selectedDate = null;
  }

  async toggleAttendance() {
    if (!this.selectedDate) return;
    
    this.isLoading = true;
    try {
      const attended = await this.firebaseService.toggleAttendance(this.selectedDate.fullDate);
      
      if (attended) {
        this.attendedDates.add(this.selectedDate.fullDate);
      } else {
        this.attendedDates.delete(this.selectedDate.fullDate);
      }
      
      this.selectedDate.attended = attended;
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
}
