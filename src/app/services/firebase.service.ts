import { Injectable } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  getFirestore,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { environment } from '../../environments/environment';

export interface AttendanceRecord {
  date: string; // Format: YYYY-MM-DD
  timestamp: any;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private readonly COLLECTION_NAME = 'attendance';
  private readonly LOCAL_STORAGE_KEY = 'gym_attendance_dates';
  private useLocalStorage = false;

  constructor() {
    console.log('🏋️ Gym Tracker: Initializing...');
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    // Check if Firebase is properly configured
    const config = environment.firebase;
    if (!config.apiKey || config.apiKey === 'YOUR_API_KEY' || config.apiKey.startsWith('YOUR_')) {
      console.warn('⚠️ Firebase not configured. Using localStorage for data persistence.');
      console.info('💡 To enable Firebase, update src/environments/environment.ts with your Firebase config.');
      this.useLocalStorage = true;
      return;
    }

    try {
      this.app = initializeApp(config);
      this.db = getFirestore(this.app);
      console.log('✅ Firebase initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error);
      console.warn('⚠️ Falling back to localStorage for data persistence.');
      this.useLocalStorage = true;
    }
  }

  // LocalStorage methods
  private getLocalDates(): string[] {
    const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
    const dates = stored ? JSON.parse(stored) : [];
    console.log('📦 LocalStorage: Retrieved', dates.length, 'attendance records');
    return dates;
  }

  private setLocalDates(dates: string[]): void {
    localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(dates));
    console.log('💾 LocalStorage: Saved', dates.length, 'attendance records');
  }

  async markAttendance(date: string): Promise<void> {
    console.log('➕ Marking attendance for:', date);
    
    if (this.useLocalStorage) {
      const dates = this.getLocalDates();
      if (!dates.includes(date)) {
        dates.push(date);
        this.setLocalDates(dates);
        console.log('✅ Attendance marked (localStorage):', date);
      }
      return;
    }

    const docRef = doc(this.db!, this.COLLECTION_NAME, date);
    await setDoc(docRef, {
      date: date,
      timestamp: Timestamp.now()
    });
    console.log('✅ Attendance marked (Firebase):', date);
  }

  async removeAttendance(date: string): Promise<void> {
    console.log('➖ Removing attendance for:', date);
    
    if (this.useLocalStorage) {
      const dates = this.getLocalDates().filter(d => d !== date);
      this.setLocalDates(dates);
      console.log('✅ Attendance removed (localStorage):', date);
      return;
    }

    const docRef = doc(this.db!, this.COLLECTION_NAME, date);
    await deleteDoc(docRef);
    console.log('✅ Attendance removed (Firebase):', date);
  }

  async getAttendance(year: number, month?: number): Promise<string[]> {
    console.log('🔍 Getting attendance for:', month !== undefined ? `${year}-${month}` : year);
    const allDates = await this.getAllAttendance();
    
    const filtered = allDates.filter(date => {
      const [docYear, docMonth] = date.split('-').map(Number);
      
      if (month !== undefined) {
        return docYear === year && docMonth === month;
      }
      return docYear === year;
    });
    
    console.log('📊 Found', filtered.length, 'records for the period');
    return filtered;
  }

  async getAllAttendance(): Promise<string[]> {
    console.log('📥 Loading all attendance records...');
    
    if (this.useLocalStorage) {
      return this.getLocalDates();
    }

    const attendanceRef = collection(this.db!, this.COLLECTION_NAME);
    const snapshot = await getDocs(attendanceRef);
    
    const dates: string[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as AttendanceRecord;
      dates.push(data.date);
    });
    
    console.log('📊 Loaded', dates.length, 'records from Firebase');
    return dates;
  }

  async toggleAttendance(date: string): Promise<boolean> {
    console.log('🔄 Toggling attendance for:', date);
    const allDates = await this.getAllAttendance();
    const exists = allDates.includes(date);
    
    if (exists) {
      await this.removeAttendance(date);
      console.log('📅 Result: Attendance REMOVED for', date);
      return false;
    } else {
      await this.markAttendance(date);
      console.log('📅 Result: Attendance ADDED for', date);
      return true;
    }
  }

  isUsingLocalStorage(): boolean {
    return this.useLocalStorage;
  }
}
