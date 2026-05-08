import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterModule, RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ClusterStripComponent } from './_components/cluster-strip/cluster-strip.component';
import { ConnectionStatusComponent } from './_components/connection-status/connection-status.component';
import { UserMenuComponent } from './_components/user-menu/user-menu.component';
import { DynamicBackgroundDirective } from './_directives/dynamic-background';
import { EffectBackgroundDirective } from './_directives/effect-background';
import { SignalRService } from './_services/api/signalr.service';
import { AuthService } from './_services/auth-service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterModule,
    RouterLink,
    RouterLinkActive,
    LucideAngularModule,
    DynamicBackgroundDirective,
    EffectBackgroundDirective,
    UserMenuComponent,
    ConnectionStatusComponent,
    ClusterStripComponent,
  ],
  template: `
    <div class="app-container" appDynamicBackground>
      <div class="content-wrapper" appEffectBackground>
        <header class="app-header">
          <span class="app-logo" aria-hidden="true">
            <img src="assets/logo.png" alt="" />
          </span>

          <span class="subtitle">Kubernetes Dashboard</span>
          <nav class="app-nav">
            <a routerLink="/dashboard" routerLinkActive="active" class="nav-link">
              <lucide-icon name="layout-grid" />
              <span>Dashboard</span>
            </a>
            <a routerLink="/logs" routerLinkActive="active" class="nav-link">
              <lucide-icon name="server" />
              <span>Pod Logs</span>
            </a>
          </nav>
          @if (auth.isAuthenticated()) {
            <app-cluster-strip />
            <app-user-menu />
          }
        </header>
        <main class="app-main">
          <router-outlet />
        </main>
      </div>
      <app-connection-status />
    </div>
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'Portside';
  auth = inject(AuthService);
  private signalRService = inject(SignalRService);

  ngOnInit() {
    // Connect to the cluster hub once we have a token; reconnect on subsequent
    // logins, disconnect on logout.
    this.auth.isLoggedIn.subscribe((loggedIn) => {
      if (loggedIn) this.signalRService.startConnection();
      else this.signalRService.stopConnection();
    });
  }
}
