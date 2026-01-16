import { Injectable } from '@angular/core';
import { FirebaseApp, getApp, initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  Timestamp,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAt,
  endAt
} from 'firebase/firestore';
import { environment } from '../../environments/environment';

export interface AttendanceRecord {
  date: string; // Format: YYYY-MM-DD
  timestamp: any;
  trainingTypeId?: string;
  durationMinutes?: number;
  notes?: string;
}

export interface TrainingType {
  id: string;
  name: string;
  color: string;
  icon?: string;
  createdAt?: any;
}

export interface UserProfile {
  email: string;
  displayName?: string;
  createdAt: any;
  lastLoginAt?: any;
  preferences?: {
    defaultTrainingType?: string;
  };
}

export interface MonthStat {
  month: number;
  count: number;
}

export interface WorkoutTypeStat {
  id: string;
  name: string;
  color: string;
  icon?: string;
  count: number;
}

export interface WorkoutTypeDurationStat {
  id: string;
  name: string;
  color: string;
  icon?: string;
  count: number;        // number of tracked workouts with duration
  avgMinutes: number;   // average duration in minutes
}

export interface Ingredient {
  id: string; // stdId
  name: string;
  aliases?: string[];
  category: string; // Vitamin, Mineral, etc.
  defaultUnit: string;
  safeUpperLimit?: number;
  rda?: number;
}

export interface SupplementProduct {
  id: string;
  name: string;
  brand: string;
  ingredients: { stdId: string; name: string; amount: number; unit: string }[];
  servingsPerDayDefault: number;
  createdBy?: string;
  verified?: boolean;
}

export interface SupplementLog {
  date: string;
  productId: string;
  productName?: string; // Snapshot of name at time of logging
  productBrand?: string; // Snapshot of brand at time of logging
  servingsTaken: number;
  timestamp?: any;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private readonly LOCAL_STORAGE_KEY = 'gym_attendance_dates';
  private useLocalStorage = false;

  constructor() {
    console.log('🏋️ Gym Tracker: Initializing Firebase Service...');
    this.initializeFirebase();
  }

  // Utility to remove undefined fields for Firestore
  private sanitizeForFirestore(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) return obj.map(item => this.sanitizeForFirestore(item));
    if (typeof obj === 'object') {
      const newObj: any = {};
      Object.keys(obj).forEach(key => {
        const value = this.sanitizeForFirestore(obj[key]);
        if (value !== undefined) {
          newObj[key] = value;
        }
      });
      return newObj;
    }
    return obj;
  }

  private initializeFirebase(): void {
    const config = environment.firebase;
    if (!config.apiKey || config.apiKey === 'YOUR_API_KEY' || config.apiKey.startsWith('YOUR_')) {
      console.warn('⚠️ Firebase not configured. Using localStorage for data persistence.');
      console.info('💡 To enable Firebase, update your .env file with Firebase config.');
      this.useLocalStorage = true;
      return;
    }

    try {
      // Try to get existing app first, then initialize if needed
      try {
        this.app = getApp();
      } catch {
        this.app = initializeApp(config);
      }
      this.db = getFirestore(this.app);
      console.log('✅ Firebase Firestore initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error);
      console.warn('⚠️ Falling back to localStorage for data persistence.');
      this.useLocalStorage = true;
    }
  }

  // ========================================
  // User Profile Methods
  // ========================================

  async createUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
    if (this.useLocalStorage) {
      localStorage.setItem(`user_${userId}`, JSON.stringify(data));
      return;
    }

    const userRef = doc(this.db!, 'users', userId);
    await setDoc(userRef, {
      ...data,
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now()
    }, { merge: true });
    console.log('✅ User profile created/updated for:', userId);
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    if (this.useLocalStorage) {
      const data = localStorage.getItem(`user_${userId}`);
      return data ? JSON.parse(data) : null;
    }

    const userRef = doc(this.db!, 'users', userId);
    const snapshot = await getDoc(userRef);
    return snapshot.exists() ? snapshot.data() as UserProfile : null;
  }

  async updateLastLogin(userId: string): Promise<void> {
    if (this.useLocalStorage) return;

    const userRef = doc(this.db!, 'users', userId);
    await updateDoc(userRef, { lastLoginAt: Timestamp.now() });
  }

  // ========================================
  // Training Types Methods (Per-User)
  // ========================================

  async getTrainingTypes(userId: string): Promise<TrainingType[]> {
    if (this.useLocalStorage) {
      const data = localStorage.getItem(`trainingTypes_${userId}`);
      return data ? JSON.parse(data) : [];
    }

    const typesRef = collection(this.db!, 'users', userId, 'trainingTypes');
    const snapshot = await getDocs(typesRef);

    const types: TrainingType[] = [];
    snapshot.forEach((doc) => {
      types.push({ id: doc.id, ...doc.data() } as TrainingType);
    });

    console.log('📊 Loaded', types.length, 'training types for user:', userId);
    return types;
  }

  async createTrainingType(userId: string, data: Omit<TrainingType, 'id' | 'createdAt'>): Promise<string> {
    const typeId = this.generateId();

    if (this.useLocalStorage) {
      const types = await this.getTrainingTypes(userId);
      types.push({ id: typeId, ...data, createdAt: new Date().toISOString() });
      localStorage.setItem(`trainingTypes_${userId}`, JSON.stringify(types));
      return typeId;
    }

    const typeRef = doc(this.db!, 'users', userId, 'trainingTypes', typeId);
    await setDoc(typeRef, {
      ...data,
      createdAt: Timestamp.now()
    });
    console.log('✅ Training type created:', data.name);
    return typeId;
  }

  async updateTrainingType(userId: string, typeId: string, data: Partial<TrainingType>): Promise<void> {
    if (this.useLocalStorage) {
      const types = await this.getTrainingTypes(userId);
      const index = types.findIndex(t => t.id === typeId);
      if (index !== -1) {
        types[index] = { ...types[index], ...data };
        localStorage.setItem(`trainingTypes_${userId}`, JSON.stringify(types));
      }
      return;
    }

    const typeRef = doc(this.db!, 'users', userId, 'trainingTypes', typeId);
    await updateDoc(typeRef, data);
    console.log('✅ Training type updated:', typeId);
  }

  async deleteTrainingType(userId: string, typeId: string): Promise<void> {
    if (this.useLocalStorage) {
      const types = await this.getTrainingTypes(userId);
      const filtered = types.filter(t => t.id !== typeId);
      localStorage.setItem(`trainingTypes_${userId}`, JSON.stringify(filtered));
      return;
    }

    const typeRef = doc(this.db!, 'users', userId, 'trainingTypes', typeId);
    await deleteDoc(typeRef);
    console.log('✅ Training type deleted:', typeId);
  }

  // ========================================
  // Attendance Methods (New Multi-User Structure)
  // ========================================

  private getYearMonthKey(date: string): string {
    // date format: YYYY-MM-DD
    return date.substring(0, 7); // Returns YYYY-MM
  }

  async markAttendance(userId: string, date: string, trainingTypeId?: string, notes?: string, durationMinutes?: number): Promise<void> {
    console.log('➕ Marking attendance for user:', userId, 'date:', date);

    if (this.useLocalStorage) {
      const key = `attendance_${userId}`;
      const data = localStorage.getItem(key);
      const attendances: Record<string, AttendanceRecord> = data ? JSON.parse(data) : {};
      attendances[date] = { date, timestamp: new Date().toISOString(), trainingTypeId, durationMinutes, notes };
      localStorage.setItem(key, JSON.stringify(attendances));
      console.log('✅ Attendance marked (localStorage):', date);
      return;
    }

    const yearMonth = this.getYearMonthKey(date);
    const docRef = doc(this.db!, 'users', userId, 'attendances', yearMonth, 'days', date);
    await setDoc(docRef, {
      date,
      timestamp: Timestamp.now(),
      trainingTypeId: trainingTypeId || null,
      durationMinutes: durationMinutes || null,
      notes: notes || null
    });
    console.log('✅ Attendance marked (Firebase):', date);
  }

  async removeAttendance(userId: string, date: string): Promise<void> {
    console.log('➖ Removing attendance for user:', userId, 'date:', date);

    if (this.useLocalStorage) {
      const key = `attendance_${userId}`;
      const data = localStorage.getItem(key);
      const attendances: Record<string, AttendanceRecord> = data ? JSON.parse(data) : {};
      delete attendances[date];
      localStorage.setItem(key, JSON.stringify(attendances));
      console.log('✅ Attendance removed (localStorage):', date);
      return;
    }

    const yearMonth = this.getYearMonthKey(date);
    const docRef = doc(this.db!, 'users', userId, 'attendances', yearMonth, 'days', date);
    await deleteDoc(docRef);
    console.log('✅ Attendance removed (Firebase):', date);
  }

  async getMonthAttendance(userId: string, year: number, month: number): Promise<AttendanceRecord[]> {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    console.log('🔍 Getting attendance for:', yearMonth);

    if (this.useLocalStorage) {
      const key = `attendance_${userId}`;
      const data = localStorage.getItem(key);
      const attendances: Record<string, AttendanceRecord> = data ? JSON.parse(data) : {};
      return Object.values(attendances).filter(a => a.date.startsWith(yearMonth));
    }

    const monthRef = collection(this.db!, 'users', userId, 'attendances', yearMonth, 'days');
    const snapshot = await getDocs(monthRef);

    const records: AttendanceRecord[] = [];
    snapshot.forEach((doc) => {
      records.push(doc.data() as AttendanceRecord);
    });

    console.log('📊 Found', records.length, 'records for', yearMonth);
    return records;
    return records;
  }

  async getCurrentMonthCount(): Promise<number> {
    if (!this.app) return 0;
    const today = new Date();
    // Assuming auth is handled by caller passing uid or we store it?
    // The service doesn't store uid persistently except in args.
    // We need uid. implementation in stats passes nothing?
    // Stats component calls: this.firebaseService.getCurrentMonthCount()
    // It assumes service knows the user?
    // FirebaseService doesn't seem to hold userId in state!
    // I need to fix StatsComponent or FirebaseService.
    // The previous service methods take userId.
    // I will add userId as optional arg or use auth.
    // Wait, StatsComponent: `await this.firebaseService.getTotalAttendanceCount();`
    // It doesn't pass userId!
    // I need to fix StatsComponent to pass userId or Service to hold it.
    // Service has `getTrainingTypes(userId)`.
    // I will modify StatsComponent to pass userId.
    return 0; // Placeholder
  }

  async getTotalAttendanceCount(): Promise<number> {
    // Placeholder implementation until we track this in user profile
    return 0;
  }

  async getCurrentYearCount(): Promise<number> {
    // Placeholder
    return 0;
  }

  async getWorkoutTypeStats(userId: string, year: number): Promise<WorkoutTypeStat[]> {
    const records = await this.getYearAttendance(userId, year);
    const types = await this.getTrainingTypes(userId);

    // Count per type
    const counts = new Map<string, number>();
    records.forEach(r => {
      if (r.trainingTypeId) {
        counts.set(r.trainingTypeId, (counts.get(r.trainingTypeId) || 0) + 1);
      }
    });

    return types.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      icon: t.icon,
      count: counts.get(t.id) || 0
    })).sort((a, b) => b.count - a.count);
  }

  async getMonthlyWorkoutTypeStats(userId: string, year: number, month: number): Promise<WorkoutTypeStat[]> {
    const records = await this.getMonthAttendance(userId, year, month);
    const types = await this.getTrainingTypes(userId);

    const counts = new Map<string, number>();
    records.forEach(r => {
      if (r.trainingTypeId) {
        counts.set(r.trainingTypeId, (counts.get(r.trainingTypeId) || 0) + 1);
      }
    });

    return types.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      icon: t.icon,
      count: counts.get(t.id) || 0
    })).sort((a, b) => b.count - a.count);
  }

  // ========================================
  // Duration Stats Methods
  // ========================================

  async getYearDurationStats(userId: string, year: number): Promise<{
    avgMinutes: number;
    trackedCount: number;
    untrackedCount: number;
  }> {
    const records = await this.getYearAttendance(userId, year);

    const trackedRecords = records.filter(r => r.durationMinutes != null && r.durationMinutes > 0);
    const untrackedCount = records.length - trackedRecords.length;

    const totalMinutes = trackedRecords.reduce((sum, r) => sum + (r.durationMinutes || 0), 0);
    const avgMinutes = trackedRecords.length > 0 ? Math.round(totalMinutes / trackedRecords.length) : 0;

    return {
      avgMinutes,
      trackedCount: trackedRecords.length,
      untrackedCount
    };
  }

  async getMonthDurationStats(userId: string, year: number, month: number): Promise<{
    avgMinutes: number;
    trackedCount: number;
    untrackedCount: number;
  }> {
    const records = await this.getMonthAttendance(userId, year, month);

    const trackedRecords = records.filter(r => r.durationMinutes != null && r.durationMinutes > 0);
    const untrackedCount = records.length - trackedRecords.length;

    const totalMinutes = trackedRecords.reduce((sum, r) => sum + (r.durationMinutes || 0), 0);
    const avgMinutes = trackedRecords.length > 0 ? Math.round(totalMinutes / trackedRecords.length) : 0;

    return {
      avgMinutes,
      trackedCount: trackedRecords.length,
      untrackedCount
    };
  }

  async getWorkoutTypeDurationStats(userId: string, year: number): Promise<WorkoutTypeDurationStat[]> {
    const records = await this.getYearAttendance(userId, year);
    const types = await this.getTrainingTypes(userId);

    // Group by type and calculate averages
    const durationData = new Map<string, { totalMinutes: number; count: number }>();

    records.forEach(r => {
      if (r.trainingTypeId && r.durationMinutes != null && r.durationMinutes > 0) {
        const existing = durationData.get(r.trainingTypeId) || { totalMinutes: 0, count: 0 };
        existing.totalMinutes += r.durationMinutes;
        existing.count++;
        durationData.set(r.trainingTypeId, existing);
      }
    });

    return types.map(t => {
      const data = durationData.get(t.id);
      return {
        id: t.id,
        name: t.name,
        color: t.color,
        icon: t.icon,
        count: data?.count || 0,
        avgMinutes: data ? Math.round(data.totalMinutes / data.count) : 0
      };
    }).filter(t => t.count > 0).sort((a, b) => b.avgMinutes - a.avgMinutes);
  }

  async getMonthlyWorkoutTypeDurationStats(userId: string, year: number, month: number): Promise<WorkoutTypeDurationStat[]> {
    const records = await this.getMonthAttendance(userId, year, month);
    const types = await this.getTrainingTypes(userId);

    const durationData = new Map<string, { totalMinutes: number; count: number }>();

    records.forEach(r => {
      if (r.trainingTypeId && r.durationMinutes != null && r.durationMinutes > 0) {
        const existing = durationData.get(r.trainingTypeId) || { totalMinutes: 0, count: 0 };
        existing.totalMinutes += r.durationMinutes;
        existing.count++;
        durationData.set(r.trainingTypeId, existing);
      }
    });

    return types.map(t => {
      const data = durationData.get(t.id);
      return {
        id: t.id,
        name: t.name,
        color: t.color,
        icon: t.icon,
        count: data?.count || 0,
        avgMinutes: data ? Math.round(data.totalMinutes / data.count) : 0
      };
    }).filter(t => t.count > 0).sort((a, b) => b.avgMinutes - a.avgMinutes);
  }

  // Alias for legacy support if needed, or update consumers to use getYearAttendance
  async getYearlyAttendance(userId: string, year: number): Promise<AttendanceRecord[]> {
    return this.getYearAttendance(userId, year);
  }

  async getYearAttendance(userId: string, year: number): Promise<AttendanceRecord[]> {
    console.log('🔍 Getting year attendance for:', year);

    // Load all 12 months in PARALLEL for speed
    const monthPromises = [];
    for (let month = 1; month <= 12; month++) {
      monthPromises.push(this.getMonthAttendance(userId, year, month));
    }

    const monthResults = await Promise.all(monthPromises);
    const allRecords = monthResults.flat();

    console.log('📊 Found', allRecords.length, 'records for year', year);
    return allRecords;
  }

  async toggleAttendance(userId: string, date: string): Promise<boolean> {
    console.log('🔄 Toggling attendance for user:', userId, 'date:', date);

    const yearMonth = this.getYearMonthKey(date);
    const [year, month] = yearMonth.split('-').map(Number);
    const monthRecords = await this.getMonthAttendance(userId, year, month);
    const exists = monthRecords.some(r => r.date === date);

    if (exists) {
      await this.removeAttendance(userId, date);
      console.log('📅 Result: Attendance REMOVED for', date);
      return false;
    } else {
      await this.markAttendance(userId, date);
      console.log('📅 Result: Attendance ADDED for', date);
      return true;
    }
  }

  // ========================================
  // Legacy Single-User Methods (For backward compatibility during migration)
  // ========================================

  private getLocalDates(): string[] {
    const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private setLocalDates(dates: string[]): void {
    localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(dates));
  }

  async getAllAttendanceLegacy(): Promise<string[]> {
    console.log('📥 Loading all attendance records (legacy)...');

    if (this.useLocalStorage) {
      return this.getLocalDates();
    }

    // Load from old flat collection for migration
    const attendanceRef = collection(this.db!, 'attendance');
    const snapshot = await getDocs(attendanceRef);

    const dates: string[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as AttendanceRecord;
      dates.push(data.date);
    });

    console.log('📊 Loaded', dates.length, 'records from legacy collection');
    return dates;
  }

  // ========================================
  // Utility Methods
  // ========================================

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  isUsingLocalStorage(): boolean {
    return this.useLocalStorage;
  }

  // ========================================
  // Migration Methods
  // ========================================

  async migrateAttendancesAddDuration(userId: string): Promise<{ migrated: number; total: number }> {
    console.log('🔄 Starting migration: Adding durationMinutes to attendance records...');

    let migrated = 0;
    let total = 0;

    if (this.useLocalStorage) {
      const key = `attendance_${userId}`;
      const data = localStorage.getItem(key);
      if (data) {
        const attendances: Record<string, AttendanceRecord> = JSON.parse(data);
        for (const date of Object.keys(attendances)) {
          total++;
          if (attendances[date].durationMinutes === undefined) {
            attendances[date].durationMinutes = undefined; // Add field as undefined
            migrated++;
          }
        }
        localStorage.setItem(key, JSON.stringify(attendances));
      }
      console.log(`✅ Migration complete (localStorage): ${migrated}/${total} records updated`);
      return { migrated, total };
    }

    // Get all months for current and past years
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear];

    for (const year of years) {
      for (let month = 1; month <= 12; month++) {
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
        const monthRef = collection(this.db!, 'users', userId, 'attendances', yearMonth, 'days');

        try {
          const snapshot = await getDocs(monthRef);
          for (const docSnap of snapshot.docs) {
            total++;
            const data = docSnap.data() as AttendanceRecord;
            if (data.durationMinutes === undefined) {
              await updateDoc(docSnap.ref, { durationMinutes: null });
              migrated++;
            }
          }
        } catch (error) {
          // Month might not exist, that's fine
          console.log(`No data for ${yearMonth}`);
        }
      }
    }

    console.log(`✅ Migration complete (Firebase): ${migrated}/${total} records updated`);
    return { migrated, total };
  }

  // ========================================
  // Ingredient Methods (Global)
  // ========================================

  async seedIngredients(): Promise<void> {
    const ingredients: Ingredient[] = [
      // Vitamins
      { id: 'vitamin_a', name: 'Vitamin A', defaultUnit: 'IU', category: 'Vitamin' },
      { id: 'vitamin_b1', name: 'Vitamin B1 (Thiamine)', defaultUnit: 'mg', category: 'Vitamin', aliases: ['Thiamine'] },
      { id: 'vitamin_b2', name: 'Vitamin B2 (Riboflavin)', defaultUnit: 'mg', category: 'Vitamin', aliases: ['Riboflavin'] },
      { id: 'vitamin_b3', name: 'Vitamin B3 (Niacin)', defaultUnit: 'mg', category: 'Vitamin', aliases: ['Niacin', 'Niacinamide'] },
      { id: 'vitamin_b5', name: 'Vitamin B5 (Pantothenic Acid)', defaultUnit: 'mg', category: 'Vitamin' },
      { id: 'vitamin_b6', name: 'Vitamin B6 (Pyridoxine)', defaultUnit: 'mg', category: 'Vitamin' },
      { id: 'vitamin_b7', name: 'Vitamin B7 (Biotin)', defaultUnit: 'mcg', category: 'Vitamin', aliases: ['Biotin'] },
      { id: 'vitamin_b9', name: 'Vitamin B9 (Folate)', defaultUnit: 'mcg', category: 'Vitamin', aliases: ['Folate', 'Folic Acid'] },
      { id: 'vitamin_b12', name: 'Vitamin B12', defaultUnit: 'mcg', category: 'Vitamin', aliases: ['Cobalamin'] },
      { id: 'vitamin_c', name: 'Vitamin C', defaultUnit: 'mg', category: 'Vitamin', aliases: ['Ascorbic Acid'] },
      { id: 'vitamin_d3', name: 'Vitamin D3', defaultUnit: 'IU', category: 'Vitamin', aliases: ['Cholecalciferol'] },
      { id: 'vitamin_e', name: 'Vitamin E', defaultUnit: 'IU', category: 'Vitamin' },
      { id: 'vitamin_k2', name: 'Vitamin K2', defaultUnit: 'mcg', category: 'Vitamin', aliases: ['Menaquinone'] },

      // Minerals
      { id: 'calcium', name: 'Calcium', defaultUnit: 'mg', category: 'Mineral' },
      { id: 'chromium', name: 'Chromium', defaultUnit: 'mcg', category: 'Mineral' },
      { id: 'copper', name: 'Copper', defaultUnit: 'mg', category: 'Mineral' },
      { id: 'iodine', name: 'Iodine', defaultUnit: 'mcg', category: 'Mineral' },
      { id: 'iron', name: 'Iron', defaultUnit: 'mg', category: 'Mineral' },
      { id: 'magnesium', name: 'Magnesium', defaultUnit: 'mg', category: 'Mineral', aliases: ['Magnesium Citrate', 'Magnesium Glycinate'] },
      { id: 'manganese', name: 'Manganese', defaultUnit: 'mg', category: 'Mineral' },
      { id: 'molybdenum', name: 'Molybdenum', defaultUnit: 'mcg', category: 'Mineral' },
      { id: 'potassium', name: 'Potassium', defaultUnit: 'mg', category: 'Mineral' },
      { id: 'selenium', name: 'Selenium', defaultUnit: 'mcg', category: 'Mineral' },
      { id: 'sodium', name: 'Sodium', defaultUnit: 'mg', category: 'Mineral' },
      { id: 'zinc', name: 'Zinc', defaultUnit: 'mg', category: 'Mineral', aliases: ['Zinc Picolinate', 'Zinc Gluconate'] },

      // Sports & Performance / Amino Acids
      { id: 'creatine', name: 'Creatine Monohydrate', defaultUnit: 'g', category: 'Performance' },
      { id: 'whey_protein', name: 'Whey Protein', defaultUnit: 'g', category: 'Performance' },
      { id: 'casein_protein', name: 'Casein Protein', defaultUnit: 'g', category: 'Performance' },
      { id: 'bcaas', name: 'BCAAs', defaultUnit: 'g', category: 'Amino Acid' },
      { id: 'eaas', name: 'EAAs', defaultUnit: 'g', category: 'Amino Acid' },
      { id: 'caffeine', name: 'Caffeine', defaultUnit: 'mg', category: 'Performance' },
      { id: 'beta_alanine', name: 'Beta Alanine', defaultUnit: 'g', category: 'Performance' },
      { id: 'citrulline', name: 'L-Citrulline', defaultUnit: 'g', category: 'Amino Acid', aliases: ['Citrulline Malate'] },
      { id: 'arginine', name: 'L-Arginine', defaultUnit: 'g', category: 'Amino Acid' },
      { id: 'glutamine', name: 'L-Glutamine', defaultUnit: 'g', category: 'Amino Acid' },
      { id: 'taurine', name: 'Taurine', defaultUnit: 'g', category: 'Amino Acid' },
      { id: 'tyrosine', name: 'L-Tyrosine', defaultUnit: 'mg', category: 'Amino Acid' },
      { id: 'electrolytes', name: 'Electrolytes', defaultUnit: 'servings', category: 'Performance' },

      // Fatty Acids
      { id: 'omega_3', name: 'Omega-3 (Fish Oil)', defaultUnit: 'mg', category: 'Fatty Acid', aliases: ['Fish Oil'] },
      { id: 'epa', name: 'EPA', defaultUnit: 'mg', category: 'Fatty Acid' },
      { id: 'dha', name: 'DHA', defaultUnit: 'mg', category: 'Fatty Acid' },
      { id: 'cla', name: 'CLA', defaultUnit: 'g', category: 'Fatty Acid' },

      // Sleep / Stress / Nootropics
      { id: 'melatonin', name: 'Melatonin', defaultUnit: 'mg', category: 'Hormone' },
      { id: 'ashwagandha', name: 'Ashwagandha', defaultUnit: 'mg', category: 'Herbal' },
      { id: 'l_theanine', name: 'L-Theanine', defaultUnit: 'mg', category: 'Amino Acid' },
      { id: 'glycine', name: 'Glycine', defaultUnit: 'g', category: 'Amino Acid' },
      { id: 'gaba', name: 'GABA', defaultUnit: 'mg', category: 'Amino Acid' },
      { id: '5htp', name: '5-HTP', defaultUnit: 'mg', category: 'Amino Acid' },
      { id: 'rhodiola', name: 'Rhodiola Rosea', defaultUnit: 'mg', category: 'Herbal' },
      { id: 'magnesium_glycinate', name: 'Magnesium Glycinate', defaultUnit: 'mg', category: 'Mineral' },

      // Joint / Connective Tissue
      { id: 'collagen', name: 'Collagen Peptides', defaultUnit: 'g', category: 'Other' },
      { id: 'glucosamine', name: 'Glucosamine', defaultUnit: 'mg', category: 'Other' },
      { id: 'chondroitin', name: 'Chondroitin', defaultUnit: 'mg', category: 'Other' },
      { id: 'msm', name: 'MSM', defaultUnit: 'g', category: 'Other' },

      // Longevity / Immune / General Health
      { id: 'coq10', name: 'CoQ10', defaultUnit: 'mg', category: 'Other' },
      { id: 'curcumin', name: 'Curcumin (Turmeric)', defaultUnit: 'mg', category: 'Herbal' },
      { id: 'quercetin', name: 'Quercetin', defaultUnit: 'mg', category: 'Herbal' },
      { id: 'nac', name: 'NAC (N-Acetyl Cysteine)', defaultUnit: 'mg', category: 'Amino Acid' },
      { id: 'resveratrol', name: 'Resveratrol', defaultUnit: 'mg', category: 'Herbal' },
      { id: 'glutathione', name: 'Glutathione', defaultUnit: 'mg', category: 'Other' },
      { id: 'probiotics', name: 'Probiotics', defaultUnit: 'CFU', category: 'Other' },
      { id: 'fiber', name: 'Fiber / Psyllium', defaultUnit: 'g', category: 'Other' },
      { id: 'greens', name: 'Greens Powder', defaultUnit: 'servings', category: 'Other' }
    ];

    if (this.useLocalStorage) {
      localStorage.setItem('ingredients_global', JSON.stringify(ingredients));
      return;
    }

    const batch: Promise<void>[] = [];
    ingredients.forEach(ing => {
      // Use sanitizeForFirestore just in case
      const cleanIng = this.sanitizeForFirestore(ing);
      // setDoc with merge: true to avoid overwriting if exists, but we want to ensure fields are up to date
      const ref = doc(this.db!, 'ingredients', ing.id);
      batch.push(setDoc(ref, cleanIng));
    });

    await Promise.all(batch);
    console.log('✅ Global ingredients seeded successfully');
  }

  async getIngredients(): Promise<Ingredient[]> {
    if (this.useLocalStorage) {
      const data = localStorage.getItem('ingredients_global');
      return data ? JSON.parse(data) : [];
    }

    const colRef = collection(this.db!, 'ingredients');
    // We could order by name
    const q = query(colRef, orderBy('name'));
    const snapshot = await getDocs(q);

    const ingredients: Ingredient[] = [];
    snapshot.forEach(doc => ingredients.push(doc.data() as Ingredient));
    return ingredients;
  }

  async searchIngredients(term: string): Promise<Ingredient[]> {
    const all = await this.getIngredients(); // For now, client-side filter since list is small (<100)
    const lower = term.toLowerCase();
    return all.filter(ing =>
      ing.name.toLowerCase().includes(lower) ||
      ing.id.includes(lower) ||
      ing.aliases?.some(a => a.toLowerCase().includes(lower))
    );
  }

  // ========================================
  // Product Methods (Global)
  // ========================================

  async getProducts(): Promise<SupplementProduct[]> {
    if (this.useLocalStorage) {
      const data = localStorage.getItem('supplement_products');
      return data ? JSON.parse(data) : [];
    }

    const colRef = collection(this.db!, 'supplementProducts');
    const snapshot = await getDocs(colRef);
    const products: SupplementProduct[] = [];
    snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() } as SupplementProduct));
    return products;
  }

  async addProduct(userId: string, data: Omit<SupplementProduct, 'id' | 'verified'>): Promise<string> {
    const id = this.generateId();
    const product: SupplementProduct = {
      id,
      ...data,
      createdBy: userId,
      verified: false
    };

    if (this.useLocalStorage) {
      const products = await this.getProducts();
      products.push(product);
      localStorage.setItem('supplement_products', JSON.stringify(products));
      return id;
    }

    const cleanProduct = this.sanitizeForFirestore(product);
    const docRef = doc(this.db!, 'supplementProducts', id);
    await setDoc(docRef, cleanProduct);
    return id;
  }

  async searchProducts(term: string): Promise<SupplementProduct[]> {
    // Basic search impl
    const all = await this.getProducts();
    const lower = term.toLowerCase();
    return all.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      p.brand.toLowerCase().includes(lower)
    );
  }

  async getProduct(productId: string): Promise<SupplementProduct | undefined> {
    if (this.useLocalStorage) {
      const all = await this.getProducts();
      return all.find(p => p.id === productId);
    }

    const docRef = doc(this.db!, 'supplementProducts', productId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as SupplementProduct;
    }
    return undefined;
  }

  async deleteProduct(productId: string): Promise<void> {
    if (this.useLocalStorage) {
      const products = await this.getProducts();
      const updatedProducts = products.filter(p => p.id !== productId);
      localStorage.setItem('supplement_products', JSON.stringify(updatedProducts));
      return;
    }

    if (!this.db) return;
    await deleteDoc(doc(this.db, 'supplementProducts', productId));
  }

  // ========================================
  async updateProduct(productId: string, data: Partial<Omit<SupplementProduct, 'id'>>): Promise<void> {
    if (this.useLocalStorage) {
      const products = await this.getProducts();
      const index = products.findIndex(p => p.id === productId);
      if (index !== -1) {
        products[index] = { ...products[index], ...data };
        localStorage.setItem('supplement_products', JSON.stringify(products));
      }
      return;
    }

    if (!this.db) return;

    // Sanitize data
    const cleanData: any = { ...data };
    if (cleanData.ingredients) {
      cleanData.ingredients = cleanData.ingredients.map((ing: any) => this.sanitizeForFirestore(ing));
    }

    await updateDoc(doc(this.db, 'supplementProducts', productId), cleanData);
  }

  // --- Supplement Logging (User Scoped) ---
  // ========================================

  async getSupplementLogs(userId: string, year: number, month: number): Promise<SupplementLog[]> {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

    if (this.useLocalStorage) {
      const key = `supplement_logs_${userId}`;
      const data = localStorage.getItem(key);
      const logsRecord: Record<string, any> = data ? JSON.parse(data) : {};
      // Include the ID (key) in each log object
      return Object.entries(logsRecord)
        .filter(([_, log]) => log.date.startsWith(yearMonth))
        .map(([id, log]) => ({ id, ...log }));
    }

    const colRef = collection(this.db!, 'users', userId, 'healthLogs', yearMonth, 'entries');
    const snapshot = await getDocs(colRef);
    const logs: any[] = [];
    snapshot.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
    return logs;
  }

  async logSupplement(userId: string, date: string, productId: string, servingsTaken: number, snapshotData?: { name: string; brand?: string }): Promise<void> {

    // I'll implement: `users/{userId}/healthLogs/{yearMonth}/entries/{logId}`

    const yearMonth = this.getYearMonthKey(date);
    const logId = this.generateId();

    const logEntry: SupplementLog = {
      date,
      productId,
      servingsTaken,
      timestamp: this.useLocalStorage ? new Date().toISOString() : Timestamp.now()
    };

    if (snapshotData) {
      logEntry.productName = snapshotData.name;
      if (snapshotData.brand) logEntry.productBrand = snapshotData.brand;
    }

    if (this.useLocalStorage) {
      const key = `supplement_logs_${userId}`;
      const data = localStorage.getItem(key);
      const logs: Record<string, SupplementLog> = data ? JSON.parse(data) : {};
      logs[logId] = logEntry; // Store by ID
      localStorage.setItem(key, JSON.stringify(logs));
      return;
    }

    const cleanLog = this.sanitizeForFirestore(logEntry);
    // Path: users/uid/healthLogs/YYYY-MM/entries/logId
    const docRef = doc(this.db!, 'users', userId, 'healthLogs', yearMonth, 'entries', logId);
    await setDoc(docRef, cleanLog);
  }

  async removeSupplementLog(userId: string, logId: string, date: string): Promise<void> {
    // We need date to find the folder
    if (this.useLocalStorage) {
      const key = `supplement_logs_${userId}`;
      const data = localStorage.getItem(key);
      if (data) {
        const logs = JSON.parse(data);
        delete logs[logId];
        localStorage.setItem(key, JSON.stringify(logs));
      }
      return;
    }

    const yearMonth = this.getYearMonthKey(date);
    const docRef = doc(this.db!, 'users', userId, 'healthLogs', yearMonth, 'entries', logId);
    await deleteDoc(docRef);
  }
}
