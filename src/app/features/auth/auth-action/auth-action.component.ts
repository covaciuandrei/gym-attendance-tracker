import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

type ActionMode = 'verifyEmail' | 'resetPassword' | 'unknown';

@Component({
  selector: 'app-auth-action',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './auth-action.component.html',
  styleUrls: ['./auth-action.component.css']
})
export class AuthActionComponent implements OnInit {
  mode: ActionMode = 'unknown';
  oobCode = '';
  isLoading = true;
  errorMessage = '';
  successMessage = '';
  
  // Password reset specific
  newPassword = '';
  confirmPassword = '';
  showPassword = false;
  showConfirmPassword = false;
  resetEmail = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    // Parse query params from Firebase email link
    const params = this.route.snapshot.queryParams;
    this.mode = (params['mode'] as ActionMode) || 'unknown';
    this.oobCode = params['oobCode'] || '';

    console.log('🔗 Auth action mode:', this.mode);

    if (!this.oobCode) {
      this.errorMessage = 'Invalid action link. Please request a new one.';
      this.isLoading = false;
      return;
    }

    if (this.mode === 'verifyEmail') {
      await this.handleEmailVerification();
    } else if (this.mode === 'resetPassword') {
      await this.verifyResetCode();
    } else {
      this.errorMessage = 'Unknown action type.';
      this.isLoading = false;
    }
  }

  private async handleEmailVerification() {
    try {
      await this.authService.verifyEmail(this.oobCode);
      this.successMessage = 'Your email has been verified! You can now sign in.';
    } catch (error: any) {
      console.error('❌ Email verification error:', error);
      this.errorMessage = this.getErrorMessage(error.code);
    }
    this.isLoading = false;
  }

  private async verifyResetCode() {
    try {
      this.resetEmail = await this.authService.verifyPasswordResetCode(this.oobCode);
      console.log('✅ Reset code valid for:', this.resetEmail);
    } catch (error: any) {
      console.error('❌ Reset code verification error:', error);
      this.errorMessage = this.getErrorMessage(error.code);
    }
    this.isLoading = false;
  }

  async onPasswordReset() {
    this.errorMessage = '';

    if (!this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Please fill in all fields';
      return;
    }

    const passwordValidation = this.validatePassword(this.newPassword);
    if (!passwordValidation.valid) {
      this.errorMessage = passwordValidation.message;
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    this.isLoading = true;

    try {
      await this.authService.confirmPasswordReset(this.oobCode, this.newPassword);
      this.successMessage = 'Password reset successful! You can now sign in with your new password.';
    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      this.errorMessage = this.getErrorMessage(error.code);
    }

    this.isLoading = false;
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  private validatePassword(password: string): { valid: boolean; message: string } {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true, message: '' };
  }

  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/invalid-action-code':
        return 'This link has expired or already been used. Please request a new one.';
      case 'auth/expired-action-code':
        return 'This link has expired. Please request a new one.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
        return 'No account found for this action.';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password.';
      default:
        return 'An error occurred. Please try again or request a new link.';
    }
  }

  getPasswordStrength(): { level: number; label: string; color: string } {
    const password = this.newPassword;
    if (!password) return { level: 0, label: '', color: '' };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { level: 1, label: 'Weak', color: '#ef4444' };
    if (score <= 4) return { level: 2, label: 'Medium', color: '#f59e0b' };
    return { level: 3, label: 'Strong', color: '#10b981' };
  }
}
