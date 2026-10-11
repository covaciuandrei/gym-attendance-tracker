export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '🥗',
  dinner: '🍽️',
  snack: '🍎',
};

export type Confidence = 'low' | 'medium' | 'high';

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
}

export interface FoodItem extends Macros {
  name: string;
  grams: number;
}

export interface DiaryEntry {
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  /** Local time, HH:mm. */
  time: string;
  meal: MealType;
  name: string;
  note: string;
  items: FoodItem[];
  totals: Macros;
  /** The photo itself lives in its own document so that listing meals stays light. */
  hasPhoto: boolean;
  source: 'ai' | 'manual';
  confidence?: Confidence;
  aiComment?: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WeightLog {
  /** YYYY-MM-DD */
  date: string;
  kg: number;
}

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface Profile {
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  /** Estimated body fat percentage (optional). */
  bodyFatPct: number | null;
  activity: ActivityLevel;
  /** Desired weight change in kg per week (negative = lose). */
  weeklyChangeKg: number;
  /** Overrides the calculated daily target when set. */
  customTargetKcal: number | null;
}

export interface AnalysisResult {
  isFood: boolean;
  name: string;
  items: FoodItem[];
  totals: Macros;
  confidence: Confidence;
  comment: string;
  model?: string;
}
