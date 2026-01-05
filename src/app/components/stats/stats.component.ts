import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FirebaseService } from '../../services/firebase.service';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.css']
})
export class StatsComponent implements OnInit {
  viewMode: 'yearly' = 'yearly';
  currentDate = new Date();
  currentYear: number;
  currentMonth: number;
  
  monthlyCount = 0;
  yearlyCount = 0;
  totalCount = 0;
  
  // Monthly stats
  monthlyData: { month: string; count: number }[] = [];
  
  isLoading = false;

  monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  constructor(private firebaseService: FirebaseService) {
    this.currentYear = this.currentDate.getFullYear();
    this.currentMonth = this.currentDate.getMonth();
  }

  async ngOnInit() {
    await this.loadStats();
  }

  async loadStats() {
    this.isLoading = true;
    try {
      const allDates = await this.firebaseService.getAllAttendance();
      
      // Calculate totals
      this.totalCount = allDates.length;
      
      // Current month count
      const currentMonthStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
      this.monthlyCount = allDates.filter(date => date.startsWith(currentMonthStr)).length;
      
      // Current year count
      const currentYearStr = `${this.currentYear}`;
      this.yearlyCount = allDates.filter(date => date.startsWith(currentYearStr)).length;
      
      // Monthly breakdown for the year
      this.monthlyData = [];
      for (let i = 0; i < 12; i++) {
        const monthStr = `${this.currentYear}-${String(i + 1).padStart(2, '0')}`;
        const count = allDates.filter(date => date.startsWith(monthStr)).length;
        this.monthlyData.push({
          month: this.monthNames[i],
          count
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
    this.isLoading = false;
  }



  previousPeriod() {
    this.currentYear--;
    this.loadStats();
  }

  nextPeriod() {
    this.currentYear++;
    this.loadStats();
  }

  getDisplayTitle(): string {
    return `${this.currentYear}`;
  }

  getMaxCount(): number {
    if (this.monthlyData.length === 0) return 1;
    return Math.max(...this.monthlyData.map(d => d.count), 1);
  }
}
