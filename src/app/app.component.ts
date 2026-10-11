import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { TranslateModule } from '@ngx-translate/core';
import { fromEvent } from 'rxjs';
import { filter } from 'rxjs/operators';
import { NutritionAccessService } from './core/nutrition/services/nutrition-access.service';
import { AuthService } from './core/services/auth.service';
import { LanguageService } from './core/services/language.service';
import { ThemeService } from './core/services/theme.service';

const UNRECOVERABLE_RELOAD_KEY = 'sw.unrecoverableReload';

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
  private destroyRef = inject(DestroyRef);

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
          this.reload();
        }
      });

      // A phone keeps the installed app suspended for days, so look for a new version whenever it comes back.
      fromEvent(document, 'visibilitychange').pipe(
        filter(() => !document.hidden),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(() => {
        this.swUpdate.checkForUpdate().catch(() => undefined);
      });

      // After a deploy the cached files can stop matching the server. One reload fetches a consistent copy, and a
      // reload that did not help is not repeated within a minute.
      this.swUpdate.unrecoverable.subscribe(() => {
        const last = Number(sessionStorage.getItem(UNRECOVERABLE_RELOAD_KEY) ?? 0);
        if (Date.now() - last < 60_000) return;
        sessionStorage.setItem(UNRECOVERABLE_RELOAD_KEY, String(Date.now()));
        this.reload();
      });
    }
  }

  protected reload(): void {
    window.location.reload();
  }

  private updateNavVisibility() {
    const currentPath = this.router.url.split('?')[0];
    const isNoNavRoute = this.noNavRoutes.some(route => currentPath.startsWith(route))
      || this.noNavPatterns.some(pattern => pattern.test(currentPath));
    this.showNav = this.isAuthenticated && !isNoNavRoute;
  }
}
