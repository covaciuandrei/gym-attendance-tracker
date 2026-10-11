import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Macros } from '../../../../core/nutrition/models';

export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
}

interface MacroRow {
  key: 'PROTEIN' | 'CARBS' | 'FAT';
  value: number;
  target: number | null;
  color: string;
  pct: number;
}

@Component({
  selector: 'app-nt-day-summary',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './day-summary.component.html',
  styleUrls: ['./day-summary.component.css'],
})
export class DaySummaryComponent {
  @Input({ required: true }) totals!: Macros;
  @Input() target: number | null = null;
  @Input() macroTargets: MacroTargets | null = null;

  get kcal(): number {
    return Math.round(this.totals.kcal);
  }

  get pct(): number {
    return this.target ? Math.min(100, Math.round((this.totals.kcal / this.target) * 100)) : 0;
  }

  get over(): boolean {
    return !!this.target && this.totals.kcal > this.target;
  }

  get difference(): number {
    return Math.abs(Math.round((this.target ?? 0) - this.totals.kcal));
  }

  get rows(): MacroRow[] {
    const { protein, carbs, fat } = this.totals;
    const total = protein + carbs + fat;
    const build = (key: MacroRow['key'], value: number, target: number | null, color: string): MacroRow => ({
      key,
      value: Math.round(value),
      target,
      color,
      pct: target ? Math.min(100, (value / target) * 100) : total > 0 ? (value / total) * 100 : 0,
    });
    const t = this.macroTargets;
    return [
      build('PROTEIN', protein, t?.protein ?? null, 'var(--protein-color)'),
      build('CARBS', carbs, t?.carbs ?? null, 'var(--carbs-color)'),
      build('FAT', fat, t?.fat ?? null, 'var(--fat-color)'),
    ];
  }
}
