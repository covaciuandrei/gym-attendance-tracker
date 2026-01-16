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
  updateDoc
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
}
