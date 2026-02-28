import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { FirebaseService } from '../../../../core/services/firebase.service';

@Component({
  selector: 'app-health-stats',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './health-stats.component.html',
  styleUrls: ['./health-stats.component.css']
})
export class HealthStatsComponent implements OnInit, OnDestroy {
  isLoading = true;
  currentYear = new Date().getFullYear();
  userId: string | null = null;

  selectedHealthMonth = new Date().getMonth();

  mostTakenProduct: { name: string; count: number } | null = null;
  topNutrients: { name: string; amount: number; unit: string }[] = [];
  totalHealthLogs = 0;
  monthlyHealthData: { month: string; count: number }[] = [];

  monthlySupplementStats: { name: string; brand: string; count: number; color: string }[] = [];
  monthlyServingsCount = 0;
  yearlyServingsCount = 0;
  consistencyPercentage = 0;
  daysWithSupplements = 0;
  totalDaysElapsed = 0;

  topYearlySupp: { name: string; count: number; avgPerDay: number } | null = null;
  topMonthlySupp: { name: string; count: number; avgPerDay: number } | null = null;

  showConsistencyInfo = false;

  private authSub: Subscription | null = null;
  private routeSub: Subscription | null = null;

  readonly monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  private readonly healthColors = [
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#22c55e',
    '#84cc16', '#34d399', '#2dd4bf', '#38bdf8', '#4ade80'
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

      const logsPromises = [];
      for (let m = 1; m <= 12; m++) {
        logsPromises.push(this.firebaseService.getSupplementLogs(this.userId!, this.currentYear, m));
      }
      const monthlyLogs = await Promise.all(logsPromises);
      const allLogs = monthlyLogs.flat();

      this.yearlyServingsCount = allLogs.reduce((s, l) => s + l.servingsTaken, 0);
      this.totalHealthLogs = allLogs.length;

      this.monthlyHealthData = this.monthNames.map((month, idx) => ({
        month,
        count: monthlyLogs[idx].reduce((s, l) => s + l.servingsTaken, 0)
      }));

      const uniqueDays = new Set(allLogs.map(l => l.date));
      this.daysWithSupplements = uniqueDays.size;
      const now = new Date();
      const startOfYear = new Date(this.currentYear, 0, 1);
      const endDate = this.currentYear === now.getFullYear() ? now : new Date(this.currentYear, 11, 31);
      this.totalDaysElapsed = Math.max(1, Math.floor((endDate.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      this.consistencyPercentage = Math.round((this.daysWithSupplements / this.totalDaysElapsed) * 100);

      const products = await this.firebaseService.getProducts();
      const productMap = new Map<string, any>(products.map(p => [p.id, p]));

      const nutrientMap = new Map<string, { name: string; amount: number; unit: string }>();
      const productCounts = new Map<string, { name: string; brand: string; count: number }>();

      allLogs.forEach(log => {
        const product = productMap.get(log.productId);
        if (product) {
          const existing = productCounts.get(log.productId) || { name: product.name, brand: product.brand || '', count: 0 };
          existing.count += log.servingsTaken;
          productCounts.set(log.productId, existing);
          product.ingredients.forEach((ing: any) => {
            const en = nutrientMap.get(ing.stdId) || { name: ing.stdId, amount: 0, unit: ing.unit };
            en.amount += log.servingsTaken * ing.amount;
            nutrientMap.set(ing.stdId, en);
          });
        }
      });

      if (nutrientMap.size > 0) {
        const globalIngredients = await this.firebaseService.getIngredients();
        const ingMap = new Map(globalIngredients.map(i => [i.id, i.name]));
        nutrientMap.forEach((val, key) => { val.name = ingMap.get(key) || val.name; });
      }

      this.topNutrients = Array.from(nutrientMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 5);

      let maxProduct = ''; let maxVal = 0;
      productCounts.forEach(val => { if (val.count > maxVal) { maxVal = val.count; maxProduct = val.name; } });
      if (maxProduct) {
        this.mostTakenProduct = { name: maxProduct, count: maxVal };
        this.topYearlySupp = { name: maxProduct, count: maxVal, avgPerDay: this.totalDaysElapsed > 0 ? maxVal / this.totalDaysElapsed : 0 };
      } else {
        this.mostTakenProduct = null;
        this.topYearlySupp = null;
      }

      await this.loadMonthlySupplementStats(monthlyLogs, productMap);
    } finally {
      this.isLoading = false;
    }
  }

  async loadMonthlySupplementStats(monthlyLogs?: any[][], productMap?: Map<string, any>) {
    if (!this.userId) return;
    if (!monthlyLogs || !productMap) {
      const logs = await this.firebaseService.getSupplementLogs(this.userId, this.currentYear, this.selectedHealthMonth + 1);
      const prods = await this.firebaseService.getProducts();
      productMap = new Map(prods.map(p => [p.id, p]));
      monthlyLogs = [];
      monthlyLogs[this.selectedHealthMonth] = logs;
    }

    const selectedLogs = monthlyLogs[this.selectedHealthMonth] || [];
    this.monthlyServingsCount = selectedLogs.reduce((s: number, l: any) => s + l.servingsTaken, 0);

    const productAggregate = new Map<string, { name: string; brand: string; count: number }>();
    selectedLogs.forEach((log: any) => {
      const product = productMap!.get(log.productId);
      if (product) {
        const existing = productAggregate.get(log.productId) || { name: product.name, brand: product.brand || '', count: 0 };
        existing.count += log.servingsTaken;
        productAggregate.set(log.productId, existing);
      }
    });

    const sorted = Array.from(productAggregate.values()).sort((a, b) => b.count - a.count);
    this.monthlySupplementStats = sorted.slice(0, 8).map((s, i) => ({ ...s, color: this.healthColors[i % this.healthColors.length] }));

    if (sorted.length > 0) {
      const top = sorted[0];
      const now = new Date();
      const daysInMonth = new Date(this.currentYear, this.selectedHealthMonth + 1, 0).getDate();
      const daysElapsed = (this.currentYear === now.getFullYear() && this.selectedHealthMonth === now.getMonth()) ? now.getDate() : daysInMonth;
      this.topMonthlySupp = { name: top.name, count: top.count, avgPerDay: daysElapsed > 0 ? top.count / daysElapsed : 0 };
    } else {
      this.topMonthlySupp = null;
    }
  }

  async prevHealthMonth() {
    this.selectedHealthMonth--;
    if (this.selectedHealthMonth < 0) { this.selectedHealthMonth = 11; this.currentYear--; await this.load(); }
    else await this.loadMonthlySupplementStats();
  }

  async nextHealthMonth() {
    this.selectedHealthMonth++;
    if (this.selectedHealthMonth > 11) { this.selectedHealthMonth = 0; this.currentYear++; await this.load(); }
    else await this.loadMonthlySupplementStats();
  }

  getMaxSupplementCount(): number { return Math.max(...this.monthlySupplementStats.map(s => s.count), 1); }
  getMonthlySupplementTotal(): number { return this.monthlySupplementStats.reduce((s, c) => s + c.count, 0); }
  getMaxHealthCount(): number { return Math.max(...this.monthlyHealthData.map(d => d.count), 1); }
}
