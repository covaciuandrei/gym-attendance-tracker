import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';
import { LanguageService } from './core/services/language.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Gym Attendance Tracker';
  isAuthenticated = false;
  showNav = false;

  // Routes where bottom nav should be hidden
  private noNavRoutes = ['/login', '/register', '/forgot-password', '/auth/action'];

  constructor(
    private authService: AuthService,
    private router: Router,
    private themeService: ThemeService,
    private languageService: LanguageService
  ) {}

  ngOnInit() {
    // Listen to auth state
    this.authService.currentUser$.subscribe(user => {
      this.isAuthenticated = !!user;
      this.updateNavVisibility();
    });

    // Listen to route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateNavVisibility();
    });
  }

  private updateNavVisibility() {
    const currentPath = this.router.url.split('?')[0];
    const isNoNavRoute = this.noNavRoutes.some(route => currentPath.startsWith(route));
    this.showNav = this.isAuthenticated && !isNoNavRoute;
  }
}
