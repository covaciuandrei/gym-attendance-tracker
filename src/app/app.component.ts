import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { NutritionAccessService } from './core/nutrition/services/nutrition-access.service';
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
  // The Food tab is only shown to accounts the admin has switched on
  readonly access = inject(NutritionAccessService);

  // Routes where bottom nav should be hidden
  private noNavRoutes = ['/login', '/register', '/forgot-password', '/auth/action'];
  // The meal editor needs the whole screen
  private noNavPatterns = [/^\/nutrition\/day\/[^/]+\/entry\//];

  constructor(
    private authService: AuthService,
    private router: Router,
    private themeService: ThemeService,
    private languageService: LanguageService,
    private swUpdate: SwUpdate
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

    // Handle PWA updates
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      ).subscribe(() => {
        if (confirm('A new version of the app is available. Update now?')) {
          window.location.reload();
        }
      });
    }
  }

  private updateNavVisibility() {
    const currentPath = this.router.url.split('?')[0];
    const isNoNavRoute = this.noNavRoutes.some(route => currentPath.startsWith(route))
      || this.noNavPatterns.some(pattern => pattern.test(currentPath));
    this.showNav = this.isAuthenticated && !isNoNavRoute;
  }
}
