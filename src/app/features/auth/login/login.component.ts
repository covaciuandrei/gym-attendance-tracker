import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { FirebaseService } from '../../../core/services/firebase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = '';
  password = '';
  isLoading = false;
  errorMessage = '';
  showPassword = false;
  returnUrl = '/calendar';

  constructor(
    private authService: AuthService,
    private firebaseService: FirebaseService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/calendar';
  }

  async onSubmit() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please fill in all fields';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const user = await this.authService.signIn(this.email, this.password);
      
      if (!user.emailVerified) {
        this.errorMessage = 'Please verify your email before signing in. Check your inbox for the verification link.';
        await this.authService.signOutUser();
        this.isLoading = false;
        return;
      }
      
      // Create/update user profile in Firestore on successful login
      const profileData: any = {
        email: user.email || ''
      };
      
      if (user.displayName) {
        profileData.displayName = user.displayName;
      }
      
      await this.firebaseService.createUserProfile(user.uid, profileData);
      
      console.log('✅ Login successful, redirecting to:', this.returnUrl);
      this.router.navigateByUrl(this.returnUrl);
    } catch (error: any) {
      console.error('❌ Login error:', error);
      this.errorMessage = this.getErrorMessage(error.code);
    }
    
    this.isLoading = false;
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/user-disabled':
        return 'This account has been disabled';
      case 'auth/user-not-found':
        return 'No account found with this email';
      case 'auth/wrong-password':
        return 'Incorrect password';
      case 'auth/invalid-credential':
        return 'Invalid email or password';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later';
      default:
        return 'An error occurred. Please try again';
    }
  }
}
