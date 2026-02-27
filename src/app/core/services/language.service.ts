import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  currentLang = signal<string>('en');

  constructor(
    private translate: TranslateService,
    private authService: AuthService
  ) {
    this.initializeLanguage();

    // Watch for auth changes to load user preference
    this.authService.currentUser$.subscribe(async (user) => {
      if (user) {
        await this.loadUserLanguage(user.uid);
      }
    });
  }

  private initializeLanguage() {
    // Check localStorage first
    const savedLang = localStorage.getItem('language');
    // Check browser language
    const browserLang = this.translate.getBrowserLang();
    // Default to 'en'
    let langToUse = 'en';

    if (savedLang) {
      langToUse = savedLang;
    } else if (browserLang && browserLang.match(/en|ro/)) {
      langToUse = browserLang;
    }

    this.setLanguage(langToUse, false); // Don't save to DB yet, just set local state
  }

  private async loadUserLanguage(uid: string) {
    try {
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const { getApp } = await import('firebase/app');
      const app = getApp();
      const db = getFirestore(app);

      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && docSnap.data()['language']) {
        const lang = docSnap.data()['language'];
        
        // Only update if different
        if (this.currentLang() !== lang) {
          this.setLanguage(lang, true); // Sync local storage
        }
      } else {
        // If no preference in DB, save current default
        await this.saveUserLanguage(uid, this.currentLang());
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  }

  setLanguage(lang: string, saveToDb: boolean = true) {
    this.currentLang.set(lang);
    this.translate.use(lang);
    localStorage.setItem('language', lang);

    if (saveToDb) {
      const user = this.authService.currentUser;
      if (user) {
        this.saveUserLanguage(user.uid, lang);
      }
    }
  }

  private async saveUserLanguage(uid: string, lang: string) {
    try {
       const { getFirestore, doc, setDoc } = await import('firebase/firestore');
       const { getApp } = await import('firebase/app');
       const app = getApp();
       const db = getFirestore(app);
       
       await setDoc(doc(db, 'users', uid), { 
         language: lang 
       }, { merge: true });
    } catch (error) {
      console.error('Error saving language:', error);
    }
  }
}
