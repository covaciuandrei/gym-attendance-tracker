import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
  appVersion = '2.0.0';

  showPasswordForm = false;
  
  passwordData = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  isLoading = false;
  message: { text: string; type: 'success' | 'error' } | null = null;

  constructor(
    public themeService: ThemeService,
    private authService: AuthService
  ) {}

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  togglePasswordForm() {
    this.showPasswordForm = !this.showPasswordForm;
    this.message = null;
    this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
  }

  async updatePassword() {
    if (!this.passwordData.currentPassword) {
      this.message = { text: 'Please enter your current password', type: 'error' };
      return;
    }

    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      this.message = { text: 'Passwords do not match', type: 'error' };
      return;
    }

    if (this.passwordData.newPassword.length < 6) {
      this.message = { text: 'New password must be at least 6 characters', type: 'error' };
      return;
    }

    this.isLoading = true;
    this.message = null;

    try {
      // First re-authenticate to allow sensitive operation
      await this.authService.reauthenticate(this.passwordData.currentPassword);
      
      // Then update the password
      await this.authService.updatePassword(this.passwordData.newPassword);
      
      this.message = { text: 'Password updated successfully', type: 'success' };
      this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
      setTimeout(() => {
        this.showPasswordForm = false;
        this.message = null;
      }, 2000);
    } catch (error: any) {
      console.error('Failed to update password:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        this.message = { text: 'Current password is incorrect.', type: 'error' };
      } else if (error.code === 'auth/requires-recent-login') {
        this.message = { 
          text: 'Security timeout. Please log out and log back in.', 
          type: 'error' 
        };
      } else {
        this.message = { text: 'Failed to update password. Please try again.', type: 'error' };
      }
    } finally {
      this.isLoading = false;
    }
  }
}
