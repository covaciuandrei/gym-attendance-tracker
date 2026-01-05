import { Injectable } from '@angular/core';
import { FirebaseApp, getApp, initializeApp } from 'firebase/app';
import {
    Auth,
    EmailAuthProvider,
    User,
    applyActionCode,
    confirmPasswordReset,
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    reauthenticateWithCredential,
    sendEmailVerification,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
    verifyPasswordResetCode
} from 'firebase/auth';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth | null = null;
  private app: FirebaseApp | null = null;
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  private authReadySubject = new BehaviorSubject<boolean>(false);
  
  public currentUser$ = this.currentUserSubject.asObservable();
  public authReady$ = this.authReadySubject.asObservable();

  constructor() {
    console.log('🔐 AuthService: Initializing...');
    this.initializeAuth();
  }

  private initializeAuth(): void {
    const config = environment.firebase;
    if (!config.apiKey || config.apiKey === 'YOUR_API_KEY' || config.apiKey.startsWith('YOUR_')) {
      console.warn('⚠️ Firebase not configured. Authentication disabled.');
      this.authReadySubject.next(true);
      return;
    }

    try {
      // Use getApp to get existing app or initialize new one (shares with FirebaseService)
      try {
        this.app = getApp();
      } catch {
        this.app = initializeApp(config);
      }
      this.auth = getAuth(this.app);
      
      onAuthStateChanged(this.auth, (user) => {
        console.log('🔐 Auth state changed:', user ? user.email : 'No user');
        if (user) {
          this.currentUserSubject.next(this.mapUser(user));
        } else {
          this.currentUserSubject.next(null);
        }
        this.authReadySubject.next(true);
      });
      
      console.log('✅ Firebase Auth initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Auth:', error);
      this.authReadySubject.next(true);
    }
  }

  private mapUser(user: User): AuthUser {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified
    };
  }

  get currentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  async signUp(email: string, password: string): Promise<AuthUser> {
    if (!this.auth) throw new Error('Firebase Auth not initialized');
    
    console.log('📝 Creating account for:', email);
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    
    // Send verification email
    await sendEmailVerification(credential.user);
    console.log('📧 Verification email sent to:', email);
    
    return this.mapUser(credential.user);
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    if (!this.auth) throw new Error('Firebase Auth not initialized');
    
    console.log('🔑 Signing in:', email);
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    
    if (!credential.user.emailVerified) {
      console.warn('⚠️ Email not verified for:', email);
      // Don't throw error, let the app handle it
    }
    
    return this.mapUser(credential.user);
  }

  async signOutUser(): Promise<void> {
    if (!this.auth) return;
    
    console.log('👋 Signing out...');
    await signOut(this.auth);
    console.log('✅ Signed out successfully');
  }

  async resetPassword(email: string): Promise<void> {
    if (!this.auth) throw new Error('Firebase Auth not initialized');
    
    console.log('📧 Sending password reset email to:', email);
    await sendPasswordResetEmail(this.auth, email);
    console.log('✅ Password reset email sent');
  }

  async verifyEmail(oobCode: string): Promise<void> {
    if (!this.auth) throw new Error('Firebase Auth not initialized');
    
    console.log('✉️ Verifying email...');
    await applyActionCode(this.auth, oobCode);
    console.log('✅ Email verified successfully');
  }

  async verifyPasswordResetCode(oobCode: string): Promise<string> {
    if (!this.auth) throw new Error('Firebase Auth not initialized');
    
    console.log('🔍 Verifying password reset code...');
    const email = await verifyPasswordResetCode(this.auth, oobCode);
    console.log('✅ Password reset code valid for:', email);
    return email;
  }

  async confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
    if (!this.auth) throw new Error('Firebase Auth not initialized');
    
    console.log('🔒 Confirming password reset...');
    await confirmPasswordReset(this.auth, oobCode, newPassword);
    console.log('✅ Password reset completed');
  }

  async resendVerificationEmail(): Promise<void> {
    if (!this.auth || !this.auth.currentUser) {
      throw new Error('No user signed in');
    }
    
    console.log('📧 Resending verification email...');
    await sendEmailVerification(this.auth.currentUser);
    console.log('✅ Verification email resent');
  }

  async updatePassword(newPassword: string): Promise<void> {
    if (!this.auth || !this.auth.currentUser) {
      throw new Error('No user signed in');
    }

    console.log('🔐 Updating password...');
    await updatePassword(this.auth.currentUser, newPassword);
    console.log('✅ Password updated successfully');
  }

  async reauthenticate(password: string): Promise<void> {
    if (!this.auth || !this.auth.currentUser || !this.auth.currentUser.email) {
      throw new Error('No user signed in or email missing');
    }

    const credential = EmailAuthProvider.credential(this.auth.currentUser.email, password);
    console.log('🔐 Re-authenticating user...');
    await reauthenticateWithCredential(this.auth.currentUser, credential);
    console.log('✅ Re-authentication successful');
  }

  getFirebaseAuth(): Auth | null {
    return this.auth;
  }
}
