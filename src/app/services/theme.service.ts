import { Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  isDarkMode = signal<boolean>(false);

  constructor(private authService: AuthService) {
    this.initializeTheme();

    // Watch for auth changes to load user preference
    this.authService.currentUser$.subscribe(async (user) => {
      if (user) {
        await this.loadUserTheme(user.uid);
      }
    });
  }

  private initializeTheme() {
    // Check localStorage first
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let isDark = prefersDark;
    if (savedTheme) {
      isDark = savedTheme === 'dark';
    }

    this.isDarkMode.set(isDark);
    this.applyTheme(isDark);
  }
  
  private async loadUserTheme(uid: string) {
     try {
       const { getFirestore, doc, getDoc } = await import('firebase/firestore');
       const { getApp } = await import('firebase/app');
       const app = getApp();
       const db = getFirestore(app);
       
       const docRef = doc(db, 'users', uid);
       const docSnap = await getDoc(docRef);
       
       if (docSnap.exists() && docSnap.data()['theme']) {
         const theme = docSnap.data()['theme'];
         const isDark = theme === 'dark';
         
         // Only update if different from what we already have (which might be from localse storage)
         if (this.isDarkMode() !== isDark) {
            this.isDarkMode.set(isDark);
            this.applyTheme(isDark);
            // Sync local storage
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
         }
       } else {
          // If no preference in DB, save current default
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
    
    // Save to local storage
    localStorage.setItem('theme', newStatus ? 'dark' : 'light');
    
    const user = this.authService.currentUser;
    if (user) {
      this.saveUserTheme(user.uid, newStatus);
    }
  }

  private applyTheme(isDark: boolean) {
    if (isDark) {
      document.body.classList.add('dark-mode');
      this.updateSafeColor('#0f172a'); // Dark bg color
    } else {
      document.body.classList.remove('dark-mode');
      this.updateSafeColor('#f8fafc'); // Light bg color
    }
  }

  private updateSafeColor(color: string) {
    // Update both just to be safe and override system preference visual
    const metaTags = document.querySelectorAll('meta[name="theme-color"]');
    metaTags.forEach(meta => {
        meta.setAttribute('content', color);
    });
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
