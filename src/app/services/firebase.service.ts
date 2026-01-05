import { Injectable } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
    Firestore,
    Timestamp,
    collection,
    deleteDoc,
    doc,
    getDocs,
    getFirestore,
    setDoc
} from 'firebase/firestore';
import { environment } from '../../environments/environment';

export interface AttendanceRecord {
  date: string; // Format: YYYY-MM-DD
  timestamp: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private app: FirebaseApp;
  private db: Firestore;
  private readonly COLLECTION_NAME = 'attendance';

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.db = getFirestore(this.app);
  }

  async markAttendance(date: string): Promise<void> {
    const docRef = doc(this.db, this.COLLECTION_NAME, date);
    await setDoc(docRef, {
      date: date,
      timestamp: Timestamp.now()
    });
  }

  async removeAttendance(date: string): Promise<void> {
    const docRef = doc(this.db, this.COLLECTION_NAME, date);
    await deleteDoc(docRef);
  }

  async getAttendance(year: number, month?: number): Promise<string[]> {
    const attendanceRef = collection(this.db, this.COLLECTION_NAME);
    const snapshot = await getDocs(attendanceRef);
    
    const dates: string[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as AttendanceRecord;
      const [docYear, docMonth] = data.date.split('-').map(Number);
      
      if (month !== undefined) {
        // Filter by year and month
        if (docYear === year && docMonth === month) {
          dates.push(data.date);
        }
      } else {
        // Filter by year only
        if (docYear === year) {
          dates.push(data.date);
        }
      }
    });
    
    return dates;
  }

  async getAllAttendance(): Promise<string[]> {
    const attendanceRef = collection(this.db, this.COLLECTION_NAME);
    const snapshot = await getDocs(attendanceRef);
    
    const dates: string[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as AttendanceRecord;
      dates.push(data.date);
    });
    
    return dates;
  }

  async toggleAttendance(date: string): Promise<boolean> {
    const allDates = await this.getAllAttendance();
    const exists = allDates.includes(date);
    
    if (exists) {
      await this.removeAttendance(date);
      return false;
    } else {
      await this.markAttendance(date);
      return true;
    }
  }
}
