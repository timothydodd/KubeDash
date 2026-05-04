import { Component, OnInit, inject } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { SignalRService } from './_services/api/signalr.service';
import { DynamicBackgroundDirective } from './_directives/dynamic-background';
import { EffectBackgroundDirective } from './_directives/effect-background';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule, DynamicBackgroundDirective, EffectBackgroundDirective],
  template: `
    <div class="app-container" appDynamicBackground>
      <div class="content-wrapper" appEffectBackground>
        <header class="app-header">
          <h1>KubeDash</h1>
          <span class="subtitle">Kubernetes Dashboard</span>
        </header>
        <main class="app-main">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'KubeDash';
  private signalRService = inject(SignalRService);

  ngOnInit() {
    // Initialize SignalR connection for real-time updates
    this.signalRService.startConnection();
  }
}
