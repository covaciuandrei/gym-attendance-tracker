import { Injectable, signal } from '@angular/core';
import { Firestore } from 'firebase/firestore';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  isDarkMode = signal<boolean>(false);
  private firestore: Firestore | null = null; // Will inject properly if I knew how you inject it, but looking at auth service it seems manual or not standard. Let's look at how to get firestore instance.

  constructor(private authService: AuthService) {
    // Initialize theme based on system preference initially
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.isDarkMode.set(prefersDark);
    this.applyTheme(prefersDark);

    // Watch for auth changes to load user preference
    this.authService.currentUser$.subscribe(async (user) => {
      if (user) {
        await this.loadUserTheme(user.uid);
      }
    });
  }
  
  // We need to inject Firestore. Since I didn't see it in auth service (it used getAuth), let's see if we can use getFirestore.
  // I will assume standard modular SDK usage. 
  
  private async loadUserTheme(uid: string) {
     try {
       // Lazy load firestore to avoid import issues if not initialized
       const { getFirestore, doc, getDoc } = await import('firebase/firestore');
       const { getApp } = await import('firebase/app');
       const app = getApp();
       const db = getFirestore(app);
       
       const docRef = doc(db, 'users', uid);
       const docSnap = await getDoc(docRef);
       
       if (docSnap.exists() && docSnap.data()['theme']) {
         const theme = docSnap.data()['theme'];
         const isDark = theme === 'dark';
         this.isDarkMode.set(isDark);
         this.applyTheme(isDark);
       } else {
          // If no preference, save current default
          await this.saveUserTheme(uid, this.isDarkMode());
       }
     } catch (error) {
       console.error('Error loading theme:', error);
     }
  }

  toggleTheme() {
    const newStatus = !this.isDarkMode();
    this.isDarkMode.set(newStatus);
    this.applyTheme(newStatus);
    
    const user = this.authService.currentUser;
    if (user) {
      this.saveUserTheme(user.uid, newStatus);
    }
  }

  private applyTheme(isDark: boolean) {
    if (isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  private async saveUserTheme(uid: string, isDark: boolean) {
    try {
       const { getFirestore, doc, setDoc } = await import('firebase/firestore');
       const { getApp } = await import('firebase/app');
       const app = getApp();
       const db = getFirestore(app);
       
       await setDoc(doc(db, 'users', uid), { 
         theme: isDark ? 'dark' : 'light' 
       }, { merge: true });
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  }
}
